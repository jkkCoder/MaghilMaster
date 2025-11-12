package com.maghilmaster.MqqtBroker;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.maghilmaster.MainActivity;
import com.maghilmaster.R;

public class MqttForegroundService extends Service {
    private static final String TAG = "MqttForegroundService";
    private static final String CHANNEL_ID = "MQTT_SERVICE_CHANNEL";
    private static final int NOTIFICATION_ID = 1001;
    
    private MqttBroker mqttBroker;
    private boolean isServiceRunning = false;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.i(TAG, "🔧 MQTT Foreground Service created");
        createNotificationChannel();
        
        // Note: MqttBroker requires ReactApplicationContext which is not available in Service
        // The service should be started from React Native side where ReactApplicationContext is available
        // For now, we'll keep the service running but MqttBroker should be initialized from React Native
        mqttBroker = null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.i(TAG, "🚀 Starting MQTT Foreground Service");
        
        if (!isServiceRunning) {
            startForeground(NOTIFICATION_ID, createNotification());
            isServiceRunning = true;
            
            // Start MQTT broker/client based on device role
            String action = intent != null ? intent.getStringExtra("action") : "start";
            if ("start".equals(action)) {
                startMqttServices();
            }
        }
        
        return START_STICKY; // Restart service if killed
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.i(TAG, "🛑 MQTT Foreground Service destroyed");
        isServiceRunning = false;
        
        // Stop MQTT services
        if (mqttBroker != null) {
            try {
                mqttBroker.stopBroker();
                mqttBroker.disconnect();
            } catch (Exception e) {
                Log.e(TAG, "Error stopping MQTT services", e);
            }
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "MQTT Service",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Keeps MQTT broker and client running in background");
            
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification createNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, notificationIntent, 
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? 
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE :
                PendingIntent.FLAG_UPDATE_CURRENT
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("MQTT Service Running")
            .setContentText("Keeping broker and client active")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build();
    }

    private void startMqttServices() {
        try {
            Log.i(TAG, "🖥️ MQTT Service is running in foreground");
            // Note: MqttBroker should be started from React Native side
            // This service just keeps the app alive in the background
            if (mqttBroker != null) {
                mqttBroker.startBroker();
                mqttBroker.subscribe("test/topic");
                mqttBroker.subscribe("sync/request");
                mqttBroker.subscribe("sync/data");
            } else {
                Log.w(TAG, "⚠️ MqttBroker not initialized. Start MQTT from React Native side.");
            }
        } catch (Exception e) {
            Log.e(TAG, "❌ Error starting MQTT services", e);
        }
    }
}
