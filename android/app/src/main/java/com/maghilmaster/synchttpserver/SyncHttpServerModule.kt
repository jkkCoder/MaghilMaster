package com.maghilmaster.synchttpserver

import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.gson.Gson
import fi.iki.elonen.NanoHTTPD
import java.net.NetworkInterface
import java.util.concurrent.ConcurrentHashMap

class SyncHttpServerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "SyncHttpServer"
        private const val TAG = "SyncHttpServer"
    }

    private var server: SyncHttpServer? = null
    private val syncDataCache = ConcurrentHashMap<String, String>()
    private val gson = Gson()

    override fun getName() = NAME

    @ReactMethod
    fun startServer(port: Int, promise: Promise) {
        try {
            if (server != null && server!!.isAlive) {
                promise.reject("SERVER_RUNNING", "Server is already running")
                return
            }

            server = SyncHttpServer(port, reactApplicationContext, syncDataCache)
            server!!.start()

            val serverInfo = WritableNativeMap().apply {
                putString("ip", getLocalIpAddress())
                putInt("port", port)
                putString("url", "http://${getLocalIpAddress()}:$port")
                putBoolean("running", true)
                putString("version", "1.0.0")
                putString("server", "NanoHTTPD/2.3.1")
            }

            Log.d(TAG, "✅ HTTP Server started on port $port")
            promise.resolve(serverInfo)
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to start server", e)
            promise.reject("START_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopServer(promise: Promise) {
        try {
            server?.stop()
            server = null
            Log.d(TAG, "✅ HTTP Server stopped")
            promise.resolve("Server stopped")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to stop server", e)
            promise.reject("STOP_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun setSyncData(requestId: String, dataJson: String) {
        syncDataCache[requestId] = dataJson
        Log.d(TAG, "📦 Cached sync data for request: $requestId")
    }

    @ReactMethod
    fun isRunning(promise: Promise) {
        promise.resolve(server?.isAlive == true)
    }

    @ReactMethod
    fun getServerInfo(promise: Promise) {
        if (server == null || !server!!.isAlive) {
            promise.reject("SERVER_NOT_RUNNING", "Server is not running")
            return
        }

        val serverInfo = WritableNativeMap().apply {
            putString("ip", getLocalIpAddress())
            putInt("port", server!!.listeningPort)
            putString("url", "http://${getLocalIpAddress()}:${server!!.listeningPort}")
            putBoolean("running", true)
            putString("version", "1.0.0")
            putString("server", "NanoHTTPD/2.3.1")
        }

        promise.resolve(serverInfo)
    }

    private fun getLocalIpAddress(): String {
        try {
            val interfaces = NetworkInterface.getNetworkInterfaces()
            while (interfaces.hasMoreElements()) {
                val iface = interfaces.nextElement()
                if (!iface.isUp || iface.isLoopback) continue

                val addresses = iface.inetAddresses
                while (addresses.hasMoreElements()) {
                    val addr = addresses.nextElement()
                    if (!addr.isLoopbackAddress && addr.address.size == 4) {
                        return addr.hostAddress ?: "127.0.0.1"
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error getting IP address", e)
        }
        return "127.0.0.1"
    }

    private fun sendEvent(eventName: String, params: WritableMap?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    // Inner class for HTTP server
    private class SyncHttpServer(
        port: Int,
        private val reactContext: ReactApplicationContext,
        private val syncDataCache: ConcurrentHashMap<String, String>
    ) : NanoHTTPD(port) {

        private val gson = Gson()

        override fun serve(session: IHTTPSession): Response {
            val uri = session.uri
            val method = session.method

            Log.d(TAG, "📥 ${method.name} $uri from ${session.remoteIpAddress}")

            return when {
                uri == "/sync" && method == Method.GET -> handleSyncPull(session)
                uri == "/sync" && method == Method.POST -> handleSyncPush(session)
                uri == "/health" && method == Method.GET -> handleHealth()
                else -> newFixedLengthResponse(Response.Status.NOT_FOUND, "application/json",
                    """{"error":"Not found"}""")
            }
        }

        private fun handleSyncPull(session: IHTTPSession): Response {
            try {
                val params = session.parameters
                val lastPulledAt = params["last_pulled_at"]?.firstOrNull() ?: "0"
                val requestId = "pull_${System.currentTimeMillis()}"

                // Send event to React Native to prepare sync data
                val eventData = WritableNativeMap().apply {
                    putString("requestId", requestId)
                    putString("lastPulledAt", lastPulledAt)
                    putString("type", "pull")
                }

                reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("sync_request", eventData)

                // Wait for data (with timeout)
                var waitTime = 0
                while (!syncDataCache.containsKey(requestId) && waitTime < 5000) {
                    Thread.sleep(100)
                    waitTime += 100
                }

                val responseData = syncDataCache.remove(requestId) ?: """
                    {
                        "timestamp": ${System.currentTimeMillis()},
                        "changes": {}
                    }
                """.trimIndent()

                return newFixedLengthResponse(Response.Status.OK, "application/json", responseData)
            } catch (e: Exception) {
                Log.e(TAG, "❌ Sync pull error", e)
                return newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "application/json",
                    """{"error":"${e.message}"}""")
            }
        }

        private fun handleSyncPush(session: IHTTPSession): Response {
            try {
                val files = HashMap<String, String>()
                session.parseBody(files)
                val body = files["postData"] ?: ""

                val requestId = "push_${System.currentTimeMillis()}"

                // Send event to React Native to handle push
                val eventData = WritableNativeMap().apply {
                    putString("requestId", requestId)
                    putString("data", body)
                    putString("type", "push")
                }

                reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("sync_request", eventData)

                return newFixedLengthResponse(Response.Status.OK, "application/json",
                    """{"status":"ok"}""")
            } catch (e: Exception) {
                Log.e(TAG, "❌ Sync push error", e)
                return newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "application/json",
                    """{"error":"${e.message}"}""")
            }
        }

        private fun handleHealth(): Response {
            val healthData = """
                {
                    "status": "ok",
                    "timestamp": ${System.currentTimeMillis()},
                    "server": "NanoHTTPD/2.3.1"
                }
            """.trimIndent()
            return newFixedLengthResponse(Response.Status.OK, "application/json", healthData)
        }
    }
}