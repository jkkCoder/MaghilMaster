package com.maghilmaster.MqqtBroker;
 
import android.content.Intent;
import android.util.Log;
 
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.modules.core.DeviceEventManagerModule;
 
import java.util.Properties;
import java.net.NetworkInterface;
import java.net.InetAddress;
import java.util.Collections;
import java.util.Enumeration;
 
import io.moquette.broker.Server;
import io.moquette.broker.config.MemoryConfig;
 
import org.eclipse.paho.client.mqttv3.IMqttDeliveryToken;
import org.eclipse.paho.client.mqttv3.MqttCallback;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.MqttMessage;
 
public class MqttBroker extends ReactContextBaseJavaModule {

    private static final String TAG = "MqttBroker";
    private Server server;
    private MqttClient client;
    private final ReactApplicationContext reactContext;
    private int qos = 1; // Default QoS level
 
    public MqttBroker(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }
 
    @Override
    public String getName() {
        return "MqttBroker";
    }
 
    // ------------------------------
    // 🔹 Helper: Send events to JS
    // ------------------------------
    private void sendEvent(String eventName, String data) {
        if (reactContext != null) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(eventName, data);
        }
    }
 
    // ------------------------------
    // 🔹 Broker Management
    // ------------------------------
    @ReactMethod
    public void startBroker() {
        try {
            if (server != null) {
                Log.i(TAG, "🔄 Broker already running");
                sendEvent("mqtt_broker_status", "Broker already running");
                return;
            }

            Log.i(TAG, "🚀 Starting MQTT Broker...");
            sendEvent("mqtt_broker_status", "Starting broker...");
 
            Properties configProps = new Properties();
            configProps.put("port", "1883");
            configProps.put("host", "0.0.0.0"); // Bind to all interfaces
            configProps.put("allow_anonymous", "true");
            configProps.put("netty.mqtt.message_size_limit", "5242880"); // 5 MB
            configProps.put("netty.mqtt.connection_timeout", "60"); // 60 seconds timeout
            configProps.put("netty.mqtt.max_bytes_in_message", "5242880"); // 5 MB max message
            
            MemoryConfig memoryConfig = new MemoryConfig(configProps);
            server = new Server();
            server.startServer(memoryConfig);
 
            Log.i(TAG, "✅ MQTT Broker started successfully on port 1883, binding to all interfaces");
            sendEvent("mqtt_broker_started", "Broker started on port 1883");
            
            // Test broker with a local client connection
            testBrokerConnection();
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Broker start error", e);
            sendEvent("mqtt_broker_error", "Failed to start broker: " + e.getMessage());
        }
    }

    // Test broker connection locally
    private void testBrokerConnection() {
        new Thread(() -> {
            try {
                Thread.sleep(2000); // Wait for broker to fully start
                Log.i(TAG, "🧪 Testing broker connection...");
                
                String testClientId = "broker_test_" + System.currentTimeMillis();
                MqttClient testClient = new MqttClient("tcp://127.0.0.1:1883", testClientId, null);
                
                MqttConnectOptions testOptions = new MqttConnectOptions();
                testOptions.setCleanSession(true);
                testOptions.setConnectionTimeout(10);
                
                testClient.connect(testOptions);
                Log.i(TAG, "✅ Broker test connection successful");
                
                testClient.disconnect();
                testClient.close();
                
                sendEvent("mqtt_broker_test", "Broker test successful");
                
            } catch (Exception e) {
                Log.e(TAG, "❌ Broker test connection failed", e);
                sendEvent("mqtt_broker_test", "Broker test failed: " + e.getMessage());
            }
        }).start();
    }

    // Get device's local IP address
    @ReactMethod
    public void getLocalIpAddress(Promise promise) {
        try {
            String ipAddress = getLocalIpAddressInternal();
            promise.resolve(ipAddress);
        } catch (Exception e) {
            Log.e(TAG, "Error getting local IP", e);
            promise.reject("IP_ERROR", e);
        }
    }

    public String getLocalIpAddressInternal() {
        try {
            Enumeration<NetworkInterface> networkInterfaces = NetworkInterface.getNetworkInterfaces();
            for (NetworkInterface networkInterface : Collections.list(networkInterfaces)) {
                if (!networkInterface.isLoopback() && networkInterface.isUp()) {
                    Enumeration<InetAddress> addresses = networkInterface.getInetAddresses();
                    for (InetAddress address : Collections.list(addresses)) {
                        if (!address.isLoopbackAddress() && address.getHostAddress().indexOf(':') < 0) {
                            String ip = address.getHostAddress();
                            Log.i(TAG, "🔍 Found local IP: " + ip);
                            return ip;
                        }
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error getting local IP", e);
        }
        return "127.0.0.1";
    }

    // Enhanced connection debugging
    @ReactMethod
    public void debugConnection(String brokerUrl, Promise promise) {
        new Thread(() -> {
            try {
                Log.i(TAG, "🔍 Starting connection debug for: " + brokerUrl);
                sendEvent("mqtt_debug", "Starting connection debug for: " + brokerUrl);
                
                // Get local IP
                String localIp = getLocalIpAddressInternal();
                Log.i(TAG, "🔍 Local device IP: " + localIp);
                sendEvent("mqtt_debug", "Local device IP: " + localIp);
                
                // Test network connectivity
                String[] ipParts = brokerUrl.replace("tcp://", "").split(":");
                String targetIp = ipParts[0];
                int targetPort = Integer.parseInt(ipParts[1]);
                
                Log.i(TAG, "🔍 Target broker: " + targetIp + ":" + targetPort);
                sendEvent("mqtt_debug", "Target broker: " + targetIp + ":" + targetPort);
                
                // Try to connect with detailed error reporting
                String clientId = "debug_" + System.currentTimeMillis();
                MqttClient debugClient = new MqttClient(brokerUrl, clientId, null);
                
                MqttConnectOptions debugOptions = new MqttConnectOptions();
                debugOptions.setCleanSession(true);
                debugOptions.setConnectionTimeout(10);
                debugOptions.setKeepAliveInterval(60);
                
                Log.i(TAG, "🔍 Attempting debug connection...");
                sendEvent("mqtt_debug", "Attempting debug connection...");
                
                debugClient.connect(debugOptions);
                Log.i(TAG, "✅ Debug connection successful!");
                sendEvent("mqtt_debug", "Debug connection successful!");
                
                debugClient.disconnect();
                debugClient.close();
                
                promise.resolve("Debug connection successful");
                
            } catch (Exception e) {
                Log.e(TAG, "❌ Debug connection failed", e);
                sendEvent("mqtt_debug", "Debug connection failed: " + e.getMessage());
                promise.reject("DEBUG_CONNECTION_FAILED", e);
            }
        }).start();
    }
 
    @ReactMethod
    public void stopBroker() {
        try {
            if (server != null) {
                server.stopServer();
                server = null;
                Log.i(TAG, "🛑 MQTT Broker stopped");
            }
        } catch (Exception e) {
            Log.e(TAG, "Broker stop error", e);
        }
    }
 
    // ------------------------------
    // 🔹 Client Management
    // ------------------------------
    @ReactMethod
    public void connectToBroker(String brokerUrl, Promise promise) {
        connectToBrokerSync(brokerUrl, promise);
    }

    // Synchronous version for background service
    public void connectToBrokerSync(String brokerUrl, Promise promise) {
        try {
            if (client != null && client.isConnected()) {
                if (promise != null) promise.resolve("Already connected to broker");
                return;
            }

            String clientId = MqttClient.generateClientId();
            client = new MqttClient(brokerUrl, clientId, null);

            MqttConnectOptions options = new MqttConnectOptions();
            options.setCleanSession(true);
            options.setAutomaticReconnect(true);
            options.setConnectionTimeout(20);
            options.setKeepAliveInterval(120);
            options.setMaxInflight(100);       // 🚀 allow more parallel QoS messages
            options.setSocketFactory(null);    // default

            System.setProperty("org.eclipse.paho.client.mqttv3.maxMessageSize", "5242880"); // 5 MB
            client.connect(options);

            client.setCallback(new MqttCallback() {
                @Override
                public void connectionLost(Throwable cause) {
                    Log.e(TAG, "Connection lost", cause);
                    sendEvent("mqtt_connection_lost", "Connection lost");
                }

                @Override
                public void messageArrived(String topic, MqttMessage message) {
                    String msg = new String(message.getPayload());
                    Log.i(TAG, "Message arrived [" + topic + "]: " + msg);
                    sendEvent("mqtt_message", topic + "|" + msg);
                }

                @Override
                public void deliveryComplete(IMqttDeliveryToken token) {
                    Log.i(TAG, "Delivery complete");
                }
            });

            if (promise != null) promise.resolve("✅ Connected to broker: " + brokerUrl);
        } catch (MqttException e) {
            Log.e(TAG, "Client connection error", e);
            if (promise != null) promise.reject("MQTT_CONNECT_ERROR", e);
        }
    }

    // Simple synchronous version for background service (no Promise needed)
    public boolean connectToBrokerSimple(String brokerUrl) {
        return connectToBrokerWithRetry(brokerUrl, 3);
    }

    // Connect with retry mechanism and exponential backoff
    public boolean connectToBrokerWithRetry(String brokerUrl, int maxRetries) {
        for (int attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                Log.i(TAG, "🔄 Connection attempt " + attempt + "/" + maxRetries + " to: " + brokerUrl);
                
            if (client != null && client.isConnected()) {
                    Log.i(TAG, "✅ Already connected to broker");
                return true;
            }

                // Clean up previous client if exists
                if (client != null) {
                    try {
                        client.disconnect();
                        client.close();
                    } catch (Exception e) {
                        Log.d(TAG, "Error cleaning up previous client", e);
                    }
                    client = null;
                }

                String clientId = MqttClient.generateClientId() + "_attempt_" + attempt;
            client = new MqttClient(brokerUrl, clientId, null);

            MqttConnectOptions options = new MqttConnectOptions();
            options.setCleanSession(true);
            options.setAutomaticReconnect(true);
                options.setConnectionTimeout(30); // Increased timeout
                options.setKeepAliveInterval(60); // Reduced keep alive
                options.setMaxInflight(50); // Reduced max inflight
            options.setSocketFactory(null);
                options.setMqttVersion(MqttConnectOptions.MQTT_VERSION_3_1_1); // Explicit version

            System.setProperty("org.eclipse.paho.client.mqttv3.maxMessageSize", "5242880");
            client.connect(options);

            client.setCallback(new MqttCallback() {
                @Override
                public void connectionLost(Throwable cause) {
                        Log.e(TAG, "❌ Connection lost", cause);
                        sendEvent("mqtt_connection_lost", "Connection lost: " + (cause != null ? cause.getMessage() : "Unknown"));
                }

                @Override
                public void messageArrived(String topic, MqttMessage message) {
                    String msg = new String(message.getPayload());
                        Log.i(TAG, "📨 Message arrived [" + topic + "]: " + msg);
                    sendEvent("mqtt_message", topic + "|" + msg);
                }

                @Override
                public void deliveryComplete(IMqttDeliveryToken token) {
                        Log.d(TAG, "✅ Delivery complete");
                }
            });

                Log.i(TAG, "✅ Successfully connected to broker: " + brokerUrl);
                sendEvent("mqtt_connected", "Connected to broker: " + brokerUrl);
            return true;

        } catch (MqttException e) {
                Log.e(TAG, "❌ Connection attempt " + attempt + " failed", e);
                
                if (attempt < maxRetries) {
                    int delay = (int) Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s
                    Log.i(TAG, "⏳ Waiting " + delay + "ms before retry...");
                    try {
                        Thread.sleep(delay);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        Log.e(TAG, "Sleep interrupted", ie);
            return false;
                    }
                } else {
                    Log.e(TAG, "❌ All connection attempts failed");
                    sendEvent("mqtt_connection_failed", "Failed to connect after " + maxRetries + " attempts");
                }
            } catch (Exception e) {
                Log.e(TAG, "❌ Unexpected error during connection attempt " + attempt, e);
                if (attempt == maxRetries) {
                    sendEvent("mqtt_connection_error", "Unexpected error: " + e.getMessage());
                }
            }
        }
        return false;
    }

    private void publishLargeMessage(String topic, String data, int qos) throws MqttException {
        int maxChunkSize = 5000; // 512 KB chunks, total up to 5 MB
        int totalLength = data.length();
        int chunks = (int) Math.ceil((double) totalLength / maxChunkSize);

        Log.i(TAG, "📦 Sending large payload (" + totalLength + " bytes) in " + chunks + " chunks");

        for (int i = 0; i < chunks; i++) {
            int start = i * maxChunkSize;
            int end = Math.min(start + maxChunkSize, totalLength);
            String part = data.substring(start, end);
            String header = "chunk:" + (i + 1) + "/" + chunks + "|";
            MqttMessage mqttMessage = new MqttMessage((header + part).getBytes());
            mqttMessage.setQos(qos);
            mqttMessage.setRetained(false);
            client.publish(topic, mqttMessage);
            Log.i(TAG, "Chunk " + (i + 1) + "/" + chunks + " sent (" + (end - start) + " bytes)");
        }
    }

 
    @ReactMethod
    public void publish(String topic, String message, int qos) {
        try {
            if (client != null && client.isConnected()) {
                if (message.length() > 5000) { // >512KB
                    publishLargeMessage(topic, message, qos);
                    return;
                }
                MqttMessage mqttMessage = new MqttMessage(message.getBytes());
                mqttMessage.setQos(qos);
                mqttMessage.setRetained(false);
                client.publish(topic, mqttMessage);
                Log.i(TAG, "📤 Published message (" + message.length() + " bytes) to " + topic + " with QoS " + qos);
            } else {
                Log.e(TAG, "❌ Client not connected - cannot publish");
                sendEvent("mqtt_publish_failed", "Client not connected");
            }
        } catch (MqttException e) {
            Log.e(TAG, "❌ Publish error", e);
            sendEvent("mqtt_publish_error", "Publish failed: " + e.getMessage());
        }
    }

    // Check connection health
    @ReactMethod
    public void checkConnectionHealth(Promise promise) {
        try {
            boolean isConnected = (client != null && client.isConnected());
            String status = isConnected ? "Connected" : "Disconnected";
            Log.i(TAG, "🔍 Connection health check: " + status);
            promise.resolve(status);
        } catch (Exception e) {
            Log.e(TAG, "❌ Error checking connection health", e);
            promise.reject("HEALTH_CHECK_ERROR", e);
        }
    }

    // Get detailed connection status
    @ReactMethod
    public void getConnectionStatus(Promise promise) {
        try {
            boolean hasClient = (client != null);
            boolean isConnected = hasClient && client.isConnected();
            String clientId = hasClient ? client.getClientId() : "No client";
            String brokerUrl = hasClient ? client.getServerURI() : "No broker URL";
            
            String status = String.format("Client: %s, Connected: %s, Broker: %s", 
                clientId, isConnected, brokerUrl);
            
            Log.i(TAG, "🔍 Detailed connection status: " + status);
            
            promise.resolve(status);
        } catch (Exception e) {
            Log.e(TAG, "❌ Error getting connection status", e);
            promise.reject("CONNECTION_STATUS_ERROR", e);
        }
    }

    // Enhanced connection monitoring with automatic reconnection
    private boolean isConnectionMonitoring = false;
    private Thread connectionMonitorThread;
    private String lastBrokerUrl = null;
    
    // Start connection monitoring
    @ReactMethod
    public void startConnectionMonitoring(String brokerUrl) {
        if (isConnectionMonitoring) {
            Log.i(TAG, "🔄 Connection monitoring already active");
            return;
        }
        
        lastBrokerUrl = brokerUrl;
        isConnectionMonitoring = true;
        
        connectionMonitorThread = new Thread(() -> {
            while (isConnectionMonitoring) {
                try {
                    Thread.sleep(10000); // Check every 10 seconds
                    
                    boolean isConnected = (client != null && client.isConnected());
                    Log.d(TAG, "🔍 Connection monitor check: " + (isConnected ? "Connected" : "Disconnected"));
                    
                    if (!isConnected && lastBrokerUrl != null) {
                        Log.w(TAG, "⚠️ Connection lost, attempting automatic reconnection...");
                        sendEvent("mqtt_connection_lost", "Connection lost, attempting reconnection");
                        
                        // Try to reconnect
                        boolean reconnected = connectToBrokerWithRetry(lastBrokerUrl, 3);
                        if (reconnected) {
                            Log.i(TAG, "✅ Automatic reconnection successful");
                            sendEvent("mqtt_reconnected", "Automatic reconnection successful");
                        } else {
                            Log.e(TAG, "❌ Automatic reconnection failed");
                            sendEvent("mqtt_reconnection_failed", "Automatic reconnection failed");
                        }
                    }
                } catch (InterruptedException e) {
                    Log.i(TAG, "🛑 Connection monitoring stopped");
                    break;
                } catch (Exception e) {
                    Log.e(TAG, "❌ Error in connection monitoring", e);
                }
            }
        });
        
        connectionMonitorThread.start();
        Log.i(TAG, "✅ Connection monitoring started");
    }
    
    // Stop connection monitoring
    @ReactMethod
    public void stopConnectionMonitoring() {
        isConnectionMonitoring = false;
        if (connectionMonitorThread != null) {
            connectionMonitorThread.interrupt();
        }
        Log.i(TAG, "🛑 Connection monitoring stopped");
    }
    
    // Enhanced publish with retry and connection check
    @ReactMethod
    public void publishWithRetry(String topic, String message, int qos, Promise promise) {
        new Thread(() -> {
            int maxRetries = 3;
            for (int attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    // Check connection first
                    if (client == null || !client.isConnected()) {
                        Log.w(TAG, "⚠️ Client not connected, attempting to reconnect...");
                        if (lastBrokerUrl != null) {
                            boolean reconnected = connectToBrokerWithRetry(lastBrokerUrl, 2);
                            if (!reconnected) {
                                throw new Exception("Failed to reconnect");
                            }
                        } else {
                            throw new Exception("No broker URL available for reconnection");
                        }
                    }
                    
                    // Try to publish
                    MqttMessage mqttMessage = new MqttMessage(message.getBytes());
                    mqttMessage.setQos(qos);
                    mqttMessage.setRetained(false);
                    client.publish(topic, mqttMessage);
                    
                    Log.i(TAG, "✅ Message published successfully to " + topic + " (attempt " + attempt + ")");
                    promise.resolve("Message published successfully");
                    return;
                    
                } catch (Exception e) {
                    Log.e(TAG, "❌ Publish attempt " + attempt + " failed", e);
                    
                    if (attempt < maxRetries) {
                        try {
                            Thread.sleep(2000 * attempt); // Exponential backoff
                        } catch (InterruptedException ie) {
                            Thread.currentThread().interrupt();
                            break;
                        }
                    } else {
                        promise.reject("PUBLISH_FAILED", "Failed to publish after " + maxRetries + " attempts");
                    }
                }
            }
        }).start();
    }

    // Test publish capability
    @ReactMethod
    public void testPublish(String topic, String message, Promise promise) {
        try {
            if (client != null && client.isConnected()) {
                MqttMessage mqttMessage = new MqttMessage(message.getBytes());
                mqttMessage.setQos(1);
                mqttMessage.setRetained(false);
                client.publish(topic, mqttMessage);
                
                Log.i(TAG, "✅ Test publish successful to topic: " + topic);
                promise.resolve("Publish test successful");
            } else {
                Log.e(TAG, "❌ Cannot test publish - client not connected");
                promise.reject("PUBLISH_TEST_FAILED", "Client not connected");
            }
        } catch (Exception e) {
            Log.e(TAG, "❌ Test publish failed", e);
            promise.reject("PUBLISH_TEST_ERROR", e);
        }
    }

    // Force reconnection
    @ReactMethod
    public void forceReconnect(String brokerUrl, Promise promise) {
        new Thread(() -> {
            try {
                Log.i(TAG, "🔄 Force reconnection requested");
                
                // Disconnect current client
                if (client != null) {
                    try {
                        client.disconnect();
                        client.close();
                    } catch (Exception e) {
                        Log.d(TAG, "Error disconnecting client", e);
                    }
                    client = null;
                }
                
                // Wait a moment
                Thread.sleep(1000);
                
                // Try to reconnect with retry
                boolean connected = connectToBrokerWithRetry(brokerUrl, 5);
                if (connected) {
                    promise.resolve("Reconnected successfully");
                } else {
                    promise.reject("RECONNECT_FAILED", "Failed to reconnect after multiple attempts");
                }
            } catch (Exception e) {
                Log.e(TAG, "❌ Force reconnect error", e);
                promise.reject("FORCE_RECONNECT_ERROR", e);
            }
        }).start();
    }
 
@ReactMethod
    public void subscribe(String topic) {
        try {
            // If no client, create a local one (useful when this device is the server)
            if (client == null) {
                String clientId = MqttClient.generateClientId();
                client = new MqttClient("tcp://127.0.0.1:1883", clientId, null);
 
                MqttConnectOptions options = new MqttConnectOptions();
                options.setCleanSession(true);
                options.setAutomaticReconnect(true);
                options.setConnectionTimeout(20);
                options.setKeepAliveInterval(120);
                options.setMaxInflight(100);
                System.setProperty("org.eclipse.paho.client.mqttv3.maxMessageSize", "5242880"); // 5 MB
                client.connect(options);
 
                client.setCallback(new MqttCallback() {
                    @Override
                    public void connectionLost(Throwable cause) {
                        Log.e(TAG, "Server client connection lost", cause);
                        sendEvent("mqtt_connection_lost", "Server connection lost");
                    }
 
                    @Override
                    public void messageArrived(String topic, MqttMessage message) {
                        String msg = new String(message.getPayload());
                        Log.i(TAG, "Server received [" + topic + "]: " + msg);
                        sendEvent("mqtt_message", topic + "|" + msg);
                    }
 
                    @Override
                    public void deliveryComplete(IMqttDeliveryToken token) {
                        Log.i(TAG, "Server delivery complete");
                    }
                });
            }
 
            // Subscribe if connected
            if (client.isConnected()) {
                client.subscribe(topic, 1);
                Log.i(TAG, "Server subscribed to: " + topic);
                sendEvent("mqtt_subscribed", topic);
            } else {
                Log.e(TAG, "Client not connected");
            }
        } catch (MqttException e) {
            Log.e(TAG, "Subscribe error", e);
        }
    }
 
    @ReactMethod
    public void disconnect() {
        try {
            if (client != null && client.isConnected()) {
                client.disconnect();
                Log.i(TAG, "Disconnected from broker");
            }
        } catch (MqttException e) {
            Log.e(TAG, "Disconnect error", e);
        }
    }

    // ------------------------------
    // 🔹 Background Service Methods
    // ------------------------------
    @ReactMethod
    public void startBackgroundService() {
        try {
            Intent serviceIntent = new Intent(reactContext, MqttForegroundService.class);
            serviceIntent.putExtra("action", "start");
            reactContext.startForegroundService(serviceIntent);
            Log.i(TAG, "✅ Background MQTT service started");
        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to start background service", e);
        }
    }

    @ReactMethod
    public void stopBackgroundService() {
        try {
            Intent serviceIntent = new Intent(reactContext, MqttForegroundService.class);
            reactContext.stopService(serviceIntent);
            Log.i(TAG, "🛑 Background MQTT service stopped");
        } catch (Exception e) {
            Log.e(TAG, "❌ Failed to stop background service", e);
        }
    }

    @ReactMethod
    public void isBackgroundServiceRunning(Promise promise) {
        try {
            // Check if service is running by checking if broker/client is active
            boolean isRunning = (server != null) || (client != null && client.isConnected());
            promise.resolve(isRunning);
        } catch (Exception e) {
            Log.e(TAG, "❌ Error checking service status", e);
            promise.reject("SERVICE_CHECK_ERROR", e);
        }
    }
}