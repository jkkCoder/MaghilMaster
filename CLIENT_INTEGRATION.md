# Client Device Integration Guide

This guide shows how to integrate client devices with the MaghilMaster server.

## Overview

- **Master Device**: Runs MQTT broker + HTTP server (this app)
- **Client Devices**: Connect to master and sync data

## Architecture

```
Master Device (MaghilMaster)
├── MQTT Broker (port 1883)
├── HTTP Server (port 3001)
└── WatermelonDB

Client Device
├── MQTT Client → connects to master
├── HTTP Client → syncs with master
└── WatermelonDB (local copy)
```

## Client Device Setup

### Step 1: Copy Required Files

Copy these files from MaghilMaster to your client app:

```
src/sync/ClientSyncManager.ts
src/database/ (WatermelonDB setup)
src/models/ (data models)
```

### Step 2: Install Dependencies

```bash
npm install @nozbe/watermelondb
```

Make sure you have the MQTT module (MqttBroker) in your client app.

### Step 3: Initialize Client in App

```typescript
// ClientApp.tsx
import React from 'react';
import { initializeClientSync, syncWithMaster } from './src/sync/ClientSyncManager';
import { database } from './src/database';
import MqttBroker from './src/nativeModules/MqttBrokerModule';

const App = () => {
  React.useEffect(() => {
    (async () => {
      console.log('📱 Starting client device...');
      
      // 1. Connect to master MQTT broker
      // Replace with your master device IP
      const masterIP = '192.168.1.100'; // Change this!
      await MqttBroker.connectToBroker(`tcp://${masterIP}:1883`);
      
      // 2. Initialize sync system
      initializeClientSync(database);
      
      console.log('✅ Client ready - waiting for master...');
    })();
  }, []);
  
  return (
    <View>
      <Text>Client Device</Text>
      <Button 
        title="Sync Now" 
        onPress={() => syncWithMaster(database)} 
      />
    </View>
  );
};
```

### Step 4: Auto-Discovery (Optional)

If you don't know the master IP, the client will auto-discover it via MQTT announcements:

```typescript
// Just initialize - no IP needed
initializeClientSync(database);

// Client will log: "📡 Master discovered: http://192.168.1.100:3001"
```

## Usage

### Manual Sync

```typescript
import { syncWithMaster } from './src/sync/ClientSyncManager';

// Trigger sync manually
await syncWithMaster(database);
```

### Auto Sync

The client automatically syncs when:
1. Master announces itself (on startup)
2. Master publishes updates (`sync/master/updated` topic)

### Check Connection Status

```typescript
import { getMasterInfo } from './src/sync/ClientSyncManager';

const info = getMasterInfo();
console.log('Master URL:', info.url);
console.log('Connected:', info.connected);
```

## Network Configuration

### Master Device

- **MQTT Broker**: `tcp://0.0.0.0:1883` (accepts connections from LAN)
- **HTTP Server**: `http://0.0.0.0:3001` (accepts connections from LAN)

### Client Device

- **MQTT Client**: Connects to `tcp://MASTER_IP:1883`
- **HTTP Client**: Syncs with `http://MASTER_IP:3001`

### Finding Master IP

On the master device, check the logs:
```
✅ Master device ready!
   MQTT Broker: tcp://127.0.0.1:1883
   HTTP Server: http://192.168.1.100:3001
```

Use `192.168.1.100` as the master IP for clients.

## Testing

### Test 1: Check Master Server

From client device or computer on same network:

```bash
# Test health endpoint
curl http://MASTER_IP:3001/health

# Should return:
{
  "status": "healthy",
  "server": "Ktor 3.3.2 Turbo Module",
  "device": "...",
  "timestamp": 1234567890
}
```

### Test 2: Test Sync Endpoint

```bash
# Test sync (pull)
curl http://MASTER_IP:3001/sync?last_pulled_at=0

# Should return:
{
  "timestamp": 1234567890,
  "changes": {
    "mh_off_orders": { "created": [], "updated": [], "deleted": [] },
    "mh_products": { "created": [], "updated": [], "deleted": [] }
  }
}
```

### Test 3: MQTT Connection

Use MQTT Explorer or similar tool:
- Host: `MASTER_IP`
- Port: `1883`
- Subscribe to: `sync/#`

You should see:
- `sync/server/announce` (every 30 seconds)
- `sync/master/updated` (when data changes)

## Sync Flow

```
1. Client starts → connects to master MQTT
2. Client subscribes to sync topics
3. Master announces itself → client discovers master URL
4. Client performs initial sync via HTTP
5. Master updates data → publishes MQTT notification
6. Client receives notification → triggers sync
7. Client pulls changes via HTTP GET /sync
8. Client applies changes to local DB
```

## Troubleshooting

### "Master server not discovered yet"

**Problem**: Client can't find master
**Solution**: 
- Check both devices are on same WiFi network
- Verify master device is running
- Check firewall settings (ports 1883, 3001)
- Manually set master URL: `setMasterURL('http://192.168.1.100:3001')`

### "Connection refused"

**Problem**: Can't connect to master
**Solution**:
- Verify master IP is correct
- Ping master device: `ping MASTER_IP`
- Check master logs for HTTP server startup
- Try accessing `http://MASTER_IP:3001/health` in browser

### "Sync timeout"

**Problem**: Sync takes too long
**Solution**:
- Check network speed
- Reduce data size
- Check master device logs for errors

### "No data syncing"

**Problem**: Sync completes but no data appears
**Solution**:
- Check `lastPulledAt` timestamp
- Verify data exists on master
- Check table names match between master/client
- Look for errors in logs

## Performance

| Devices | Data Size | Sync Time | Network |
|---------|-----------|-----------|---------|
| 1-5     | < 1MB     | 1-2 sec   | WiFi    |
| 5-10    | 1-10MB    | 3-5 sec   | WiFi    |
| 10-20   | 10-50MB   | 10-20 sec | WiFi    |
| 20+     | 50MB+     | 20-60 sec | WiFi    |

## Security Considerations

**Current Setup**: No authentication (LAN only)

**For Production**:
1. Add authentication tokens
2. Use HTTPS for HTTP server
3. Use TLS for MQTT
4. Implement device whitelisting
5. Add rate limiting

## API Reference

### ClientSyncManager

```typescript
// Initialize sync system
initializeClientSync(database: Database): void

// Manual sync
syncWithMaster(database: Database): Promise<void>

// Connect to master MQTT
connectToMasterMQTT(masterIP?: string): Promise<void>

// Get master info
getMasterInfo(): { url: string | null, ip: string | null, connected: boolean }

// Manually set master URL
setMasterURL(url: string): void
```

## Example: Complete Client App

```typescript
import React, { useState } from 'react';
import { View, Text, Button, ActivityIndicator } from 'react-native';
import { initializeClientSync, syncWithMaster, getMasterInfo } from './src/sync/ClientSyncManager';
import { database } from './src/database';
import MqttBroker from './src/nativeModules/MqttBrokerModule';

const ClientApp = () => {
  const [syncing, setSyncing] = useState(false);
  const [masterInfo, setMasterInfo] = useState(getMasterInfo());
  
  React.useEffect(() => {
    // Initialize client
    (async () => {
      try {
        // Option 1: Auto-discover (recommended)
        initializeClientSync(database);
        
        // Option 2: Manual IP (if auto-discover fails)
        // await MqttBroker.connectToBroker('tcp://192.168.1.100:1883');
        // initializeClientSync(database);
        
        // Update UI when master is discovered
        const interval = setInterval(() => {
          setMasterInfo(getMasterInfo());
        }, 1000);
        
        return () => clearInterval(interval);
      } catch (error) {
        console.error('Initialization error:', error);
      }
    })();
  }, []);
  
  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncWithMaster(database);
      alert('Sync complete!');
    } catch (error) {
      alert('Sync failed: ' + error.message);
    } finally {
      setSyncing(false);
    }
  };
  
  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 24 }}>Client Device</Text>
      
      <View style={{ marginTop: 20 }}>
        <Text>Master Status:</Text>
        <Text>Connected: {masterInfo.connected ? '✅' : '❌'}</Text>
        <Text>URL: {masterInfo.url || 'Discovering...'}</Text>
      </View>
      
      <Button 
        title={syncing ? "Syncing..." : "Sync Now"}
        onPress={handleSync}
        disabled={!masterInfo.connected || syncing}
      />
      
      {syncing && <ActivityIndicator style={{ marginTop: 20 }} />}
    </View>
  );
};

export default ClientApp;
```

## Support

For issues or questions:
1. Check master device logs
2. Check client device logs
3. Verify network connectivity
4. Test endpoints with curl
5. Check MQTT with MQTT Explorer

