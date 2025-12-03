import { synchronize } from '@nozbe/watermelondb/sync';
import { database } from '../database';
import API from '../../features/common/api';
import { getAuthHeader } from '../../utils/api-utils';
import { getState } from '../../features/getStore';
import NetInfo from '@react-native-community/netinfo';
import axios from 'axios';

// Create a separate axios instance for sync endpoint with different base URL
const SyncAPI = axios.create({
  baseURL: 'http://34.93.13.63:4000/api',
  // baseURL: 'http://192.168.1.7:4000/api',
  timeout: 60000,
});

// Add auth header interceptor
SyncAPI.interceptors.request.use((config) => {
  const authHeaders = getAuthHeader();
  if (config.headers) {
    Object.assign(config.headers, authHeaders);
  }
  return config;
});

/**
 * Full WatermelonDB sync for cash drawer data
 * This requires backend endpoints that support WatermelonDB sync protocol:
 * 
 * GET /cash-drawers/sync?last_pulled_at=...&schema_version=...&location_id=...
 * POST /cash-drawers/sync?last_pulled_at=...
 * 
 * Backend must return/push data in WatermelonDB format:
 * {
 *   changes: {
 *     mh_cashier_log: { created: [...], updated: [...], deleted: [...] },
 *     mh_expense_log: { created: [...], updated: [...], deleted: [...] }
 *   },
 *   timestamp: number
 * }
 */
export async function syncCashDrawerData(): Promise<{
  success: boolean;
  error?: string;
}> {
  console.log('🔄 [syncCashDrawerData] Starting WatermelonDB sync...');

  try {
    // Check network status
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log('⚠️ [syncCashDrawerData] No network connection, skipping sync');
      return { success: false, error: 'No network connection' };
    }

    const locationId = (getState() as any)?.restaurant?.currentRestaurantDetail?.id;
    if (!locationId) {
      console.error('❌ [syncCashDrawerData] Location ID not found');
      return { success: false, error: 'Location ID not found' };
    }

    await synchronize({
      database,
      
      /**
       * Pull changes from server
       * Backend should return all changes since lastPulledAt
       */
      pullChanges: async ({ lastPulledAt, schemaVersion, migration }) => {
        // Detailed logging for lastPulledAt structure
        console.log('📥 [syncCashDrawerData] ========== PULL CHANGES START ==========');
        console.log('📥 [syncCashDrawerData] lastPulledAt DETAILS:');
        console.log('  - Type:', typeof lastPulledAt);
        console.log('  - Value:', lastPulledAt);
        console.log('  - Is null:', lastPulledAt === null);
        console.log('  - Is undefined:', lastPulledAt === undefined);
        console.log('  - String representation:', String(lastPulledAt || 'null/undefined'));
        console.log('  - Number representation:', lastPulledAt ? Number(lastPulledAt) : 'N/A');
        console.log('  - Date representation:', lastPulledAt ? new Date(lastPulledAt).toISOString() : 'N/A');
        console.log('📥 [syncCashDrawerData] schemaVersion:', schemaVersion, '(type:', typeof schemaVersion, ')');
        console.log('📥 [syncCashDrawerData] migration:', migration);
        console.log('📥 [syncCashDrawerData] locationId:', locationId);
        console.log('📥 [syncCashDrawerData] ========================================');

        const urlParams = new URLSearchParams({
          last_pulled_at: lastPulledAt?.toString() || '0',
          schema_version: schemaVersion.toString(),
          location_id: locationId,
        });

        // Add migration info if present
        if (migration) {
          urlParams.append('migration', JSON.stringify(migration));
        }

        console.log('📥 [syncCashDrawerData] URL Params:', urlParams.toString());

        try {
          console.log("inside try");
          
          const response = await SyncAPI({
            method: 'get',
            url: `/v1/offline-sync?${urlParams.toString()}`,
          });

          if (response.status !== 200) {
            throw new Error(`Pull failed: ${response.statusText}`);
          }

          const { changes, timestamp } = response.data;

          // Filter out app_pref from received changes (if needed)
          // Note: mh_staff is allowed in pullChanges (GET), only excluded from pushChanges (POST)
          if (changes && changes.app_pref) {
            delete changes.app_pref;
          }

          return {
            changes: changes || {},
            timestamp: timestamp || Date.now(),
          };
        } catch (error: any) {
          console.error('❌ [syncCashDrawerData] Pull error:', error);
          throw error;
        }
      },

      /**
       * Push local changes to server
       * Backend should process and return success/error
       */
      pushChanges: async ({ changes, lastPulledAt }) => {
        // Create a copy of changes to avoid mutating the original
        const jsonData = { ...changes };
        
        // Delete app_pref and mh_staff tables from sync data (read-only tables)
        if (jsonData.app_pref) {
          delete jsonData.app_pref;
          console.log('📤 [syncCashDrawerData] Filtered out app_pref table from sync');
        }
        if (jsonData.mh_restaurant_details) {
          delete jsonData.mh_restaurant_details;
          console.log('📤 [syncCashDrawerData] Filtered out mh_restaurant_details table from sync');
        }
        // mh_staff is GET only, exclude from POST sync
        if (jsonData.mh_staff) {
          delete jsonData.mh_staff;
          console.log('📤 [syncCashDrawerData] Filtered out mh_staff table from sync (GET only)');
        }

        if (jsonData.mh_menu_details) {
          delete jsonData.mh_menu_details;
          console.log('📤 [syncCashDrawerData] Filtered out mh_menu_details table from sync');
        }

        // Detailed logging for push changes
        console.log('📤 [syncCashDrawerData] ========== PUSH CHANGES START ==========');
        console.log('📤 [syncCashDrawerData] lastPulledAt DETAILS:',lastPulledAt);
        console.log('  - Type:', typeof lastPulledAt);
        console.log('  - Value:', lastPulledAt);
        console.log('  - Is null:', lastPulledAt === null);
        console.log('  - Is undefined:', lastPulledAt === undefined);
        console.log('  - String representation:', String(lastPulledAt || 'null/undefined'));
        console.log('  - Number representation:', lastPulledAt ? Number(lastPulledAt) : 'N/A');
        console.log('  - Date representation:', lastPulledAt ? new Date(lastPulledAt).toISOString() : 'N/A');
        console.log('📤 [syncCashDrawerData] ========================================');
        console.log('');
        
        // Log changes structure (using jsonData which has app_pref removed)
        console.log('📤 [syncCashDrawerData] ========== CHANGES TO PUSH ==========');
        console.log('📤 [syncCashDrawerData] Original changes tables:', Object.keys(changes || {}));
        console.log('📤 [syncCashDrawerData] Filtered changes tables (app_pref excluded):', Object.keys(jsonData || {}));
        console.log('📤 [syncCashDrawerData] Total tables with changes:', Object.keys(jsonData || {}).length);
        console.log('');
        
        // Log each table's changes (using jsonData)
        if (jsonData && Object.keys(jsonData).length > 0) {
          Object.keys(jsonData).forEach(tableName => {
            const tableChanges = jsonData[tableName];
            console.log(`📤 [syncCashDrawerData] Table: ${tableName}`);
            console.log(`  - Created records: ${tableChanges.created?.length || 0}`);
            console.log(`  - Updated records: ${tableChanges.updated?.length || 0}`);
            console.log(`  - Deleted records: ${tableChanges.deleted?.length || 0}`);
            
            if (tableChanges.created && tableChanges.created.length > 0) {
              console.log(`  - Created records sample (first record):`, JSON.stringify(tableChanges.created[0], null, 2));
            }
            if (tableChanges.updated && tableChanges.updated.length > 0) {
              console.log(`  - Updated records sample (first record):`, JSON.stringify(tableChanges.updated[0], null, 2));
            }
            if (tableChanges.deleted && tableChanges.deleted.length > 0) {
              console.log(`  - Deleted record IDs:`, tableChanges.deleted);
            }
            console.log('');
          });
        } else {
          console.log('📤 [syncCashDrawerData] No changes to push (empty changes object)');
        }
        console.log('📤 [syncCashDrawerData] ========================================');
        console.log('');
        
        // Log the full request details (using jsonData)
        console.log('📤 [syncCashDrawerData] ========== REQUEST TO BACKEND ==========');
        console.log('📤 [syncCashDrawerData] Method: POST');
        console.log('📤 [syncCashDrawerData] Endpoint: /v1/offline-sync');
        console.log('📤 [syncCashDrawerData] Base URL: http://34.93.13.63:4000/api');
        console.log('📤 [syncCashDrawerData] Query Parameter:');
        console.log('  - last_pulled_at:', lastPulledAt || 0);
        console.log('📤 [syncCashDrawerData] Full URL:', `http://34.93.13.63:4000/api/v1/offline-sync?last_pulled_at=${lastPulledAt || 0}`);
        console.log('');
        console.log('📤 [syncCashDrawerData] ========== REQUEST BODY FORMAT ==========');
        console.log('📤 [syncCashDrawerData] This is the EXACT format that will be sent to backend:');
        console.log('📤 [syncCashDrawerData] NOTE: app_pref table is excluded from sync');
        console.log('📤 [syncCashDrawerData] NOTE: Request body will be wrapped with { changes: {...}, timestamp: number }');
        console.log('');
        console.log('📤 [syncCashDrawerData] POST /v1/offline-sync?last_pulled_at=' + (lastPulledAt || 0));
        console.log('📤 [syncCashDrawerData] Content-Type: application/json');
        console.log('📤 [syncCashDrawerData] Request Body (app_pref excluded):');
        console.log(JSON.stringify(jsonData, null, 2));
        console.log('');
        console.log('📤 [syncCashDrawerData] Expected Structure (matching your comment format):');
        console.log('{');
        console.log('  "mh_cashier_log": {');
        console.log('    "created": [...],  // Array of new cashier log records');
        console.log('    "updated": [...],  // Array of updated cashier log records');
        console.log('    "deleted": [...]   // Array of deleted record IDs');
        console.log('  },');
        console.log('  "mh_expense_log": {');
        console.log('    "created": [...],  // Array of new expense log records');
        console.log('    "updated": [...],  // Array of updated expense log records');
        console.log('    "deleted": [...]   // Array of deleted record IDs');
        console.log('  }');
        console.log('  // NOTE: app_pref table is NOT included in sync');
        console.log('}');
        console.log('');
        console.log('📤 [syncCashDrawerData] Actual Data Being Sent:');
        if (jsonData && Object.keys(jsonData).length > 0) {
          console.log(JSON.stringify(jsonData, null, 2));
        } else {
          console.log('{}  // Empty - no local changes to sync');
        }
        console.log('📤 [syncCashDrawerData] ========================================');
        console.log('');
        console.log('📤 [syncCashDrawerData] CHANGES STRUCTURE EXPLANATION:');
        console.log('  Each table (mh_cashier_log, mh_expense_log) contains:');
        console.log('    - created: Array of new records to create on server');
        console.log('    - updated: Array of records to update on server');
        console.log('    - deleted: Array of record IDs to delete on server');
        console.log('  NOTE: app_pref table is excluded from sync');
        console.log('📤 [syncCashDrawerData] ========================================');

        try {
          // Wrap changes in the structure backend expects
          const requestBody = {
            changes: jsonData,  // Wrap changes object
            timestamp: Date.now()  // Add Unix timestamp in milliseconds
          };

          const response = await SyncAPI({
            method: 'post',
            url: `/v1/offline-sync?last_pulled_at=${lastPulledAt || 0}`,
            data: requestBody,  // Send wrapped structure with changes and timestamp
          });
          // {console.log("resp------------------------onse", requestBody)}

          if (response.status !== 200) {
            throw new Error(`Push failed: ${response.statusText}`);
          }

          console.log('✅ [syncCashDrawerData] ========== PUSH SUCCESS ==========');
          console.log('✅ [syncCashDrawerData] Response Status:', response.status);
          console.log('✅ [syncCashDrawerData] Response Data:', JSON.stringify(response.data, null, 2));
          console.log('✅ [syncCashDrawerData] ========================================');
        } catch (error: any) {
          console.error('❌ [syncCashDrawerData] Push error:', error);
          throw error;
        }
      },

      // NOTE: Removed migrationsEnabledAtVersion since migrations are not configured
      // If you need migrations, configure them in database.ts first
    });

    console.log('✅ [syncCashDrawerData] Sync completed successfully');
    return { success: true };
  } catch (error: any) {
    console.error('❌ [syncCashDrawerData] Sync failed:', error);
    return {
      success: false,
      error: error.message || 'Unknown sync error',
    };
  }
}

