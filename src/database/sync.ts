import { synchronize } from '@nozbe/watermelondb/sync';
import { Database } from '@nozbe/watermelondb';

const BASE_URL = 'http://192.168.0.27:3000';

export async function mySync(database: Database) {
  await synchronize({
    database,
    pullChanges: async ({ lastPulledAt }) => {
      console.log('🔽 PULL: Requesting changes from server...', {
        lastPulledAt,
        url: `${BASE_URL}/sync?last_pulled_at=${lastPulledAt || 0}`,
      });
      
      const res = await fetch(
        `${BASE_URL}/sync?last_pulled_at=${lastPulledAt || 0}`
      );
      
      if (!res.ok) throw new Error(await res.text());
      
      const result = await res.json();
      
      console.log('✅ PULL: Received from server:', {
        timestamp: result.timestamp,
        tables: Object.keys(result.changes || {}),
        orders: result.changes?.mh_off_orders ? {
          created: result.changes.mh_off_orders.created?.length || 0,
          updated: result.changes.mh_off_orders.updated?.length || 0,
          deleted: result.changes.mh_off_orders.deleted?.length || 0,
        } : 'not in response',
        products: result.changes?.mh_products ? {
          created: result.changes.mh_products.created?.length || 0,
          updated: result.changes.mh_products.updated?.length || 0,
          deleted: result.changes.mh_products.deleted?.length || 0,
        } : 'not in response',
      });
      
      return result;
    },
    pushChanges: async ({ changes, lastPulledAt }) => {
      console.log('🔼 PUSH: Sending changes to server...', {
        tables: Object.keys(changes),
        orders: changes.mh_off_orders ? {
          created: changes.mh_off_orders.created?.length || 0,
          updated: changes.mh_off_orders.updated?.length || 0,
          deleted: changes.mh_off_orders.deleted?.length || 0,
        } : 'no changes',
        products: changes.mh_products ? {
          created: changes.mh_products.created?.length || 0,
          updated: changes.mh_products.updated?.length || 0,
          deleted: changes.mh_products.deleted?.length || 0,
        } : 'no changes',
      });
      
      const res = await fetch(`${BASE_URL}/sync?last_pulled_at=${lastPulledAt}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('❌ PUSH failed:', errorText);
        throw new Error(errorText);
      }
      
      console.log('✅ PUSH: Successfully sent to server');
    },
    migrationsEnabledAtVersion: 0,
  });
}

