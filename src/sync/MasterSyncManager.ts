import KtorSyncServer, { syncServerEmitter } from '../nativeModules/KtorSyncServer';
import MqttBroker from '../nativeModules/MqttBrokerModule';
import { Q } from '@nozbe/watermelondb';
import { database } from '../Storage/database';

const SYNC_PORT = 3001;
let serverInfo: any = null;

/**
 * Start the Master Sync System (MQTT + HTTP Server)
 */
export async function startMasterSync() {
  try {
    console.log('🚀 Starting Master Sync System...');
    
    // 1. Start MQTT Broker (already working)
    await MqttBroker.startBroker();
    MqttBroker.subscribe('sync/request');
    MqttBroker.subscribe('sync/ping');
    console.log('✅ MQTT Broker ready');
    
    // 2. Start Ktor HTTP Server
    serverInfo = await KtorSyncServer.startServer(SYNC_PORT);
    console.log('✅ HTTP Server:', serverInfo.url);
    
    // 3. Setup event listeners
    setupSyncListeners();
    
    // 4. Announce to network via MQTT
    announceServer();
    
    // 5. Periodic heartbeat (every 30 seconds)
    setInterval(announceServer, 30000);
    
    return serverInfo;
  } catch (error) {
    console.error('❌ Failed to start master sync:', error);
    throw error;
  }
}

/**
 * Announce server availability via MQTT
 */
function announceServer() {
  if (!serverInfo) return;
  
  MqttBroker.publish('sync/server/announce', JSON.stringify({
    ip: serverInfo.ip,
    port: serverInfo.port,
    url: serverInfo.url,
    timestamp: Date.now(),
    device: 'MASTER',
    version: '1.0.0'
  }), 1);
  
  console.log('📡 Server announced:', serverInfo.url);
}

/**
 * Setup event listeners for sync requests
 */
function setupSyncListeners() {
  // Handle HTTP sync requests from client devices (both pull and push)
  syncServerEmitter.addListener('sync_request', async (data: any) => {
    const { type, requestId, lastPulledAt, data: pushData } = data;
    
    if (type === 'pull') {
      // Handle HTTP pull requests from client devices
      console.log('🔽 Pull request from client:', lastPulledAt);
      
      try {
        const changes = await getChangesFromDB(parseInt(lastPulledAt || '0'));
        const response = {
          timestamp: Date.now(),
          changes: changes
        };
        
        // Send back to native module
        await KtorSyncServer.setSyncData(requestId, JSON.stringify(response));
        console.log('✅ Pull data prepared:', Object.keys(changes).length, 'tables');
      } catch (error: any) {
        console.error('❌ Pull error:', error);
        await KtorSyncServer.setSyncData(requestId, JSON.stringify({
          error: error.message,
          timestamp: Date.now(),
          changes: {}
        }));
      }
    } else if (type === 'push') {
      // Handle HTTP push requests from client devices
      console.log('🔼 Push received from client');
      
      try {
        const changesObj = JSON.parse(pushData);
        await applyChangesToDB(changesObj);
        
        // Notify other clients via MQTT
        MqttBroker.publish('sync/master/updated', JSON.stringify({
          timestamp: Date.now(),
          tables: Object.keys(changesObj)
        }), 1);
        
        console.log('✅ Push applied & clients notified');
      } catch (error) {
        console.error('❌ Push error:', error);
      }
    }
  });
}

/**
 * Get changes from WatermelonDB since lastPulledAt timestamp
 */
async function getChangesFromDB(lastPulledAt: number) {
  const tables = ['mh_off_orders', 'mh_products', 'printers'];
  const changes: any = {};
  
  for (const tableName of tables) {
    try {
      const collection = database.get(tableName);
      const allRecords = await collection.query().fetch();
      
      // Filter by timestamp
      const created = allRecords.filter((r: any) => 
        r.createdAt > lastPulledAt
      );
      
      const updated = allRecords.filter((r: any) => 
        r.updatedAt > lastPulledAt && r.createdAt <= lastPulledAt
      );
      
      changes[tableName] = {
        created: created.map(serializeRecord),
        updated: updated.map(serializeRecord),
        deleted: []
      };
      
      console.log(`  ${tableName}: ${created.length} created, ${updated.length} updated`);
    } catch (error) {
      console.error(`Error in ${tableName}:`, error);
      changes[tableName] = { created: [], updated: [], deleted: [] };
    }
  }
  
  return changes;
}

/**
 * Serialize WatermelonDB record for transmission
 */
function serializeRecord(record: any): any {
  const raw = record._raw;
  return {
    id: raw.id,
    ...raw,
    _status: 'synced',
    _changed: ''
  };
}

/**
 * Apply changes from client device to master DB
 */
async function applyChangesToDB(changes: any) {
  try {
    await database.write(async () => {
      for (const [tableName, tableChanges] of Object.entries(changes)) {
        const collection = database.get(tableName);
        
        // Create new records
        for (const recordData of (tableChanges as any).created || []) {
          try {
            // Check if exists first
            const exists = await collection.find(recordData.id).catch(() => null);
            if (!exists) {
              await collection.create((record: any) => {
                Object.keys(recordData).forEach(key => {
                  if (key !== 'id' && key !== '_status' && key !== '_changed') {
                    record[key] = recordData[key];
                  }
                });
              });
            }
          } catch (error) {
            console.error(`Error creating in ${tableName}:`, error);
          }
        }
        
        // Update existing records
        for (const recordData of (tableChanges as any).updated || []) {
          try {
            const existing = await collection.find(recordData.id);
            await existing.update((record: any) => {
              Object.keys(recordData).forEach(key => {
                if (key !== 'id' && key !== '_status' && key !== '_changed') {
                  record[key] = recordData[key];
                }
              });
            });
          } catch (error) {
            console.error(`Error updating in ${tableName}:`, error);
          }
        }
      }
    });
    
    console.log('✅ Changes applied to database');
  } catch (error) {
    console.error('❌ Failed to apply changes:', error);
    throw error;
  }
}

/**
 * Stop the Master Sync System
 */
export async function stopMasterSync() {
  try {
    await KtorSyncServer.stopServer();
    serverInfo = null;
    console.log('🛑 Master sync stopped');
  } catch (error) {
    console.error('❌ Failed to stop sync:', error);
  }
}

/**
 * Get current server info
 */
export function getServerInfo() {
  return serverInfo;
}

