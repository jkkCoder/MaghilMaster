import database from '../database';
import OrderItem from '../models/OrderItem';

export class OrderItemService {
  /**
   * Store remaining items and voided items in the order_items table for offline processing
   */
  static async storeRemainingItems(
    orderId: string,
    remainingItems: Array<{
      itemId: string;
      itemName: string;
      quantity: number;
      price: number;
      subtotal: number;
      taxFees: number;
      orderItemId: string;
      remainingQuantity: number;
      remainingAmount: number;
      voidReason?: string;
    }>,
    voidedItems?: Array<{
      itemId: string;
      itemName: string;
      quantity: number;
      price: number;
      subtotal: number;
      taxFees: number;
      orderItemId: string;
      voidReason?: string;
    }>
  ): Promise<void> {
    try {
      
      await database.write(async () => {
        // First, clear existing items for this order to avoid duplicates
        const existingItems = await database
          .get<OrderItem>('order_items')
          .query()
          .fetch();
        
        const existingItemsForOrder = existingItems.filter(item => item.orderId === orderId);

        // Process voided items first - only update the specific voided item
        if (voidedItems && voidedItems.length > 0) {
          for (const item of voidedItems) {
            // Check if this item already exists (prioritize orderItemId as it's the stable identifier)
            let existingItem = null;
            
            // First try to match by orderItemId (most reliable)
            if (item.orderItemId) {
              existingItem = existingItemsForOrder.find(existing => 
                existing.orderItemId === item.orderItemId
              );
            }
            
            // If not found by orderItemId, try by itemId
            if (!existingItem && item.itemId) {
              existingItem = existingItemsForOrder.find(existing => 
                existing.itemId === item.itemId
              );
            }
            
            if (existingItem) {
              // Update existing item to voided status
              await existingItem.update((record) => {
                // Store original values before voiding
                const originalQuantity = record.quantity;
                const originalSubtotal = record.subtotal;
                
                // Only update fields that actually changed
                if (record.quantity !== 0) {
                  record.quantity = 0; // Voided items have 0 quantity
                }
                if (record.subtotal !== 0) {
                  record.subtotal = 0; // Voided items have 0 subtotal
                }
                if (record.remainingQuantity !== 0) {
                  record.remainingQuantity = 0;
                }
                if (record.remainingAmount !== 0) {
                  record.remainingAmount = 0;
                }
                if (record.isActive !== false) {
                  record.isActive = false; // Mark as inactive (voided)
                }
                if (record.voidReason !== (item.voidReason || 'Item voided offline')) {
                  record.voidReason = item.voidReason || 'Item voided offline';
                }
                
                // Always update these fields for voided items
                record.lastUpdated = Date.now();
                record.updatedAt = Date.now();
                // Only reset syncedAt if the item was previously synced
                if (record.syncedAt && record.syncedAt > 0) {
                  record.syncedAt = 0;
                }
                
                // Set voided fields with safety check
                try {
                  if (record.isVoided !== true) {
                    record.isVoided = true;
                  }
                  // Use original values for voided quantities
                  if (record.voidedQuantity !== originalQuantity) {
                    record.voidedQuantity = originalQuantity;
                  }
                  if (record.voidedAmount !== originalSubtotal) {
                    record.voidedAmount = originalSubtotal;
                  }
                } catch (error) {
                  // If fields don't exist yet, ignore the error
                  console.log('Voided fields not available yet, skipping...');
                }
              });
            } else {
              // Only create new voided item if it doesn't exist at all
              console.warn(`Creating new voided item for ${item.itemId} - this should not happen during voiding`);
              await database.get<OrderItem>('order_items').create((record) => {
                record.orderId = orderId;
                record.itemId = item.itemId;
                record.itemName = item.itemName;
                record.quantity = 0; // Voided items have 0 quantity
                record.price = item.price;
                record.subtotal = 0; // Voided items have 0 subtotal
                record.taxFees = item.taxFees;
                record.orderItemId = item.orderItemId;
                record.remainingQuantity = 0;
                record.remainingAmount = 0;
                record.voidReason = item.voidReason || 'Item voided offline';
                record.lastUpdated = Date.now();
                record.isActive = false; // Voided items are not active
                record.syncedAt = 0; // Initialize as unsynced
                record.createdAt = Date.now();
                record.updatedAt = Date.now();
                // Set voided fields with safety check
                try {
                  record.isVoided = true;
                  record.voidedQuantity = item.quantity;
                  record.voidedAmount = item.subtotal;
                } catch (error) {
                  // If fields don't exist yet, ignore the error
                  console.log('Voided fields not available yet, skipping...');
                }
              });
            }
          }
        }

        // Process remaining items - only update if they actually changed
        for (const item of remainingItems) {
          // Check if this item already exists (prioritize orderItemId as it's the stable identifier)
          const existingItem = existingItemsForOrder.find(existing => 
            (item.orderItemId && existing.orderItemId === item.orderItemId) ||
            existing.itemId === item.itemId
          );
          
          if (existingItem) {
            // Only update if there are actual changes to avoid unnecessary updates
            const hasChanges = 
              existingItem.quantity !== item.quantity ||
              existingItem.subtotal !== item.subtotal ||
              existingItem.remainingQuantity !== item.remainingQuantity ||
              existingItem.remainingAmount !== item.remainingAmount ||
              existingItem.isActive !== true;
            
            if (hasChanges) {
              await existingItem.update((record) => {
                // Only update fields that actually changed
                if (record.quantity !== item.quantity) {
                  record.quantity = item.quantity;
                }
                if (record.subtotal !== item.subtotal) {
                  record.subtotal = item.subtotal;
                }
                if (record.remainingQuantity !== item.remainingQuantity) {
                  record.remainingQuantity = item.remainingQuantity;
                }
                if (record.remainingAmount !== item.remainingAmount) {
                  record.remainingAmount = item.remainingAmount;
                }
                if (record.isActive !== true) {
                  record.isActive = true; // Mark as active (remaining)
                }
                
                // Only update updatedAt if there were actual changes
                record.updatedAt = Date.now();
                // Only reset syncedAt if the item was previously synced
                if (record.syncedAt && record.syncedAt > 0) {
                  record.syncedAt = 0;
                }
                
                // Set voided fields with default values
                try {
                  if (record.isVoided !== false) {
                    record.isVoided = false;
                  }
                  if (record.voidedQuantity !== 0) {
                    record.voidedQuantity = 0;
                  }
                  if (record.voidedAmount !== 0) {
                    record.voidedAmount = 0;
                  }
                } catch (error) {
                  // If fields don't exist yet, ignore the error
                  console.log('Voided fields not available yet, skipping...');
                }
              });
            }
          } else {
            // Create new remaining item
            await database.get<OrderItem>('order_items').create((record) => {
              record.orderId = orderId;
              record.itemId = item.itemId;
              record.itemName = item.itemName;
              record.quantity = item.quantity;
              record.price = item.price;
              record.subtotal = item.subtotal;
              record.taxFees = item.taxFees;
              record.orderItemId = item.orderItemId;
              record.remainingQuantity = item.remainingQuantity;
              record.remainingAmount = item.remainingAmount;
              record.voidReason = item.voidReason || 'Item voided offline';
              record.lastUpdated = Date.now();
              record.isActive = true;
              record.syncedAt = 0; // Initialize as unsynced
              record.createdAt = Date.now();
              record.updatedAt = Date.now();
              // Set voided fields with default values
              try {
                record.isVoided = false;
                record.voidedQuantity = 0;
                record.voidedAmount = 0;
              } catch (error) {
                // If fields don't exist yet, ignore the error
                console.log('Voided fields not available yet, skipping...');
              }
            });
          }
        }

      });
      
    } catch (error) {
      console.error('❌ Failed to store remaining items:', error);
      throw error;
    }
  }

  /**
   * Get voided items for an order
   */
  static async getVoidedItems(orderId: string): Promise<any[]> {
    try {
      const allItems = await database
        .get<OrderItem>('order_items')
        .query()
        .fetch();
      
      const voidedItems = allItems.filter((item: OrderItem) => 
        item.orderId === orderId && (item as any).isVoided === true
      );

      return voidedItems.map((item: OrderItem) => ({
        id: item.id,
        itemId: item.itemId,
        itemName: item.itemName,
        quantity: (item as any).voidedQuantity?.toString() || '0',
        price: item.price.toString(),
        subTotal: (item as any).voidedAmount?.toString() || '0',
        taxFees: item.taxFees?.toString() || '0',
        voidReason: item.voidReason,
        isVoided: true,
        orderItemId: item.orderItemId,
        options: [], // Voided items don't have options
        customNote: null,
        comment: null,
        itemModified: false,
        cancelReason: item.voidReason,
        imageRequired: 0,
        isCustomizationItem: false,
        uniqueId: item.id,
      }));
    } catch (error) {
      console.error('❌ Failed to get voided items:', error);
      return [];
    }
  }

  /**
   * Get all remaining items for a specific order
   */
  static async getRemainingItemsByOrderId(orderId: string): Promise<OrderItem[]> {
    try {
      const allItems = await database
        .get<OrderItem>('order_items')
        .query()
        .fetch();
      
      const remainingItems = allItems.filter(item => 
        item.orderId === orderId && item.isActive === true
      );

      return remainingItems;
    } catch (error) {
      console.error('❌ Failed to get remaining items:', error);
      return [];
    }
  }

  /**
   * Get all items for a specific order (both active and voided)
   */
  static async getAllItemsForOrder(orderId: string): Promise<OrderItem[]> {
    try {
      const allItems = await database
        .get<OrderItem>('order_items')
        .query()
        .fetch();

      // Filter manually for now to avoid query issues
      const orderItems = allItems.filter(item => item.orderId === orderId);

      return orderItems;
    } catch (error) {
      console.error('❌ Failed to get all items for order:', error);
      return [];
    }
  }

  /**
   * Get items for sync - only items that need syncing
   */
  static async getItemsForSync(): Promise<OrderItem[]> {
  try {
    const allItems = await database
      .get<OrderItem>('order_items')
      .query()
      .fetch();

    // Only get items that need to be synced
    // Items need syncing if:
    // 1. They have never been synced (syncedAt is null/undefined/0)
    // 2. They have been synced before but have been modified since the last sync
    const itemsToSync = allItems.filter(item => {
      const neverSynced = !item.syncedAt || item.syncedAt === 0;
      const wasSyncedButChanged = item.syncedAt && item.syncedAt > 0 && item.updatedAt > item.syncedAt;
      
      return neverSynced || wasSyncedButChanged;
    });
    
    return itemsToSync;
  } catch (error) {
    console.error('❌ Failed to get items for sync:', error);
    return [];
  }
}}
