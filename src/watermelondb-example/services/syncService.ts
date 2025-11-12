import { useState, useCallback } from 'react';
import { SyncDatabaseChangeSet, synchronize } from '@nozbe/watermelondb/sync';
import database from '../database';
import { getState } from '../../features/getStore';
import { getOrdersFromDB } from '../../utils/watermelonDBUtils';
import { OrderDetail } from '../../features/order/orderModels';
import generateDummyOrder from '../utils/dummyOrder';
import { OrderItemService } from './OrderItemService';

export const useWatermelonDBSync = () => {
  const [isSyncing, setIsSyncing] = useState(false);

  const sync = useCallback(async (options = {}) => {
    if (isSyncing) {
      return {
        success: false,
        syncedOrders: 0,
        syncedOrderItems: 0,
        errors: ['Sync already in progress'],
      };
    }

    setIsSyncing(true);
    const errors: string[] = [];
    let syncedOrders = 0;
    let syncedOrderItems = 0;
    let logData = '';
    let offlineOrders = await getOrdersFromDB();
    offlineOrders = offlineOrders.filter((order) =>
      order.orderId?.startsWith('offline_pickup'),
    );

    // Get items for sync with smart logic (first sync: all items, subsequent: only changed)
    const offlineOrderItems = await OrderItemService.getItemsForSync();

    try {
      const state = getState();
      const locationId =
        options.locationId || state.restaurant?.currentRestaurantDetail?.id;
      if (!locationId) {
        throw new Error('Location ID not available for sync');
      }

      const syncData = {
        locationId,
        offlineOrders,
        offlineOrderItems,
        syncTime: new Date().toISOString(),
        localOrdersCount: options.localOrdersCount || 0,
        localOrderItemsCount: offlineOrderItems.length,
        syncType: 'SYNC',
      };

      // Track the number of items and orders that will be synced
      syncedOrderItems = offlineOrderItems.length;
      syncedOrders = offlineOrders.length; // Count all offline orders as they will be synced
      
      // If no items to sync, return early
      if (offlineOrderItems.length === 0 && offlineOrders.length === 0) {
        return {
          success: true,
          syncedOrders: 0,
          syncedOrderItems: 0,
          errors: [],
          logData: 'No items to sync'
        };
      }


      await synchronize({
        database,
        pullChanges: async ({ lastPulledAt }) => {
          const { changes, serverTime } = await pullChangesFromServer(
            lastPulledAt || 0,
            locationId
          );
          return {
            changes,
            timestamp: serverTime || Date.now(),
          };
        },
        pushChanges: async ({ changes, lastPulledAt }) => {
          const date = new Date(lastPulledAt);
          const formatted = date.toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });

          await pushChangesToServer(
            changes,
            locationId,
            syncData,
            offlineOrders,
            errors
          );
        },
        sendCreatedAsUpdated: true, // This flag helps with sync categorization
      });

      return { 
        success: true, 
        syncedOrders, 
        syncedOrderItems,
        errors, 
        logData 
      };
    } catch (error) {
      console.error('Failed to fetch syncData from WatermelonDB:', error);
      return {
        success: false,
        syncedOrders: 0,
        syncedOrderItems: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        logData: '',
      };
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  /**
   * Simulates pulling changes from server
   * Respects lastPulledAt and returns serverTime for next sync
   */
  const pullChangesFromServer = async (
    lastPulledAt: string | number | Date,
    locationId: string
  ) => {
    const date = new Date(lastPulledAt);
    const formatted = date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const { newOrder, staticOrder, serverTime } = generateDummyOrder();

    return {
      changes: {
        orders: {
          created: [newOrder],
          updated: [staticOrder],
          deleted: [],
        },
        order_items: {
          created: [],
          updated: [],
          deleted: [],
        },
      },
      serverTime, 
    };
  };


  /**
   * Simulates pushing local changes to server
   */
  const pushChangesToServer = async (
    changes: SyncDatabaseChangeSet,
    locationId: string,
    syncData: {
      locationId: string;
      offlineOrders: OrderDetail[];
      offlineOrderItems: any[];
      syncTime: string;
      localOrdersCount: any;
      localOrderItemsCount: number;
      syncType: string;
    },
    offlineOrders: OrderDetail[],
    errors: string[]
  ) => {
    console.log('changes.orders',JSON.stringify(changes.orders,null,2),'changes.order_items',JSON.stringify(changes.order_items,null,2));
    
    try {
      // Process offline orders before sending
      for (const order of offlineOrders) {
        try {
          if (!order) continue;
        } catch (orderErr) {
          console.error(`Failed to sync offline order:`, orderErr);
        }
      }

      // Process offline order items before sending
      for (const orderItem of syncData.offlineOrderItems) {
        try {
          if (!orderItem) continue;
        } catch (orderItemErr) {
          console.error(`Failed to sync offline order item:`, orderItemErr);
        }
      }



      // Mark orders as synced after successful push
    } catch (err) {
      console.error('Failed to push changes or send log:', err);
    }
  };

  return { sync, isSyncing };
};
