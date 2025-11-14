/**
 * CLIENT DEVICE SYNC MANAGER
 * 
 * This file should be used in CLIENT devices (not the master).
 * It connects to the master device's HTTP server and syncs data.
 */

import { synchronize } from '@nozbe/watermelondb/sync';
import { Database } from '@nozbe/watermelondb';
import { NativeEventEmitter, NativeModules } from 'react-native';

const MqttBroker = NativeModules.MqttBroker;
const mqttEmitter = new NativeEventEmitter(MqttBroker);

let MASTER_URL: string | null = null;
let MASTER_IP: string | null = null;

/**
 * Initialize Client Sync
 * Call this on app startup for client devices
 */
export function initializeClientSync(database: Database) {
  console.log('📱 Initializing client sync...');
  
  // Listen for master server announcements via MQTT
  mqttEmitter.addListener('mqtt_message', (data: string) => {
    const [topic, msg] = data.split('|');
    
    // Master server announces itself
    if (topic === 'sync/server/announce') {
      try {
        const announcement = JSON.parse(msg);
        MASTER_URL = announcement.url;
        MASTER_IP = announcement.ip;
        console.log('📡 Master discovered:', MASTER_URL);
        
        // Perform initial sync when master is discovered
        syncWithMaster(database).catch(err => 
          console.error('Initial sync failed:', err)
        );
      } catch (error) {
        console.error('Error parsing announcement:', error);
      }
    }
    
    // Master notifies that data was updated
    if (topic === 'sync/master/updated') {
      try {
        const update = JSON.parse(msg);
        console.log('🔔 Master has new data:', update.tables);
        
        // Auto-sync when master has updates
        syncWithMaster(database).catch(err => 
          console.error('Auto-sync failed:', err)
        );
      } catch (error) {
        console.error('Error parsing update notification:', error);
      }
    }
  });
  
  // Subscribe to master events
  try {
    MqttBroker.subscribe('sync/server/announce');
    MqttBroker.subscribe('sync/master/updated');
    console.log('✅ Subscribed to master events');
    
    // Request master to announce itself
    MqttBroker.publish('sync/ping', 'client_ready', 0);
  } catch (error) {
    console.error('❌ Failed to subscribe to MQTT:', error);
  }
}

/**
 * Manually sync with master server
 */
export async function syncWithMaster(database: Database): Promise<void> {
  if (!MASTER_URL) {
    throw new Error('Master server not discovered yet. Waiting for MQTT announcement...');
  }
  
  console.log('🔄 Syncing with master:', MASTER_URL);
  
  try {
    await synchronize({
      database,
      pullChanges: async ({ lastPulledAt }) => {
        const url = `${MASTER_URL}/sync?last_pulled_at=${lastPulledAt || 0}`;
        console.log('🔽 Pulling from:', url);
        
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Pull failed: ${errorText}`);
        }
        
        const result = await res.json();
        console.log('✅ Pulled data:', {
          timestamp: result.timestamp,
          tables: Object.keys(result.changes || {})
        });
        
        return result;
      },
      pushChanges: async ({ changes, lastPulledAt }) => {
        const url = `${MASTER_URL}/sync?last_pulled_at=${lastPulledAt}`;
        console.log('🔼 Pushing to:', url);
        
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(changes),
        });
        
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Push failed: ${errorText}`);
        }
        
        console.log('✅ Pushed changes successfully');
      },
      migrationsEnabledAtVersion: 0,
    });
    
    console.log('✅ Sync complete!');
  } catch (error) {
    console.error('❌ Sync error:', error);
    throw error;
  }
}

/**
 * Connect to master MQTT broker
 * Call this to connect client to master's MQTT broker
 */
export async function connectToMasterMQTT(masterIP?: string): Promise<void> {
  const ip = masterIP || MASTER_IP;
  
  if (!ip) {
    throw new Error('Master IP not known. Wait for announcement or provide manually.');
  }
  
  const brokerUrl = `tcp://${ip}:1883`;
  console.log('🔌 Connecting to master MQTT:', brokerUrl);
  
  try {
    await MqttBroker.connectToBroker(brokerUrl);
    console.log('✅ Connected to master MQTT broker');
  } catch (error) {
    console.error('❌ Failed to connect to MQTT:', error);
    throw error;
  }
}

/**
 * Get current master server info
 */
export function getMasterInfo() {
  return {
    url: MASTER_URL,
    ip: MASTER_IP,
    connected: !!MASTER_URL
  };
}

/**
 * Manually set master URL (if you know it)
 */
export function setMasterURL(url: string) {
  MASTER_URL = url;
  const match = url.match(/http:\/\/([^:]+):/);
  if (match) {
    MASTER_IP = match[1];
  }
  console.log('✅ Master URL set:', MASTER_URL);
}

