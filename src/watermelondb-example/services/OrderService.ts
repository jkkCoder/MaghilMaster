import database from '../database';
import Order from '../models/order';
import { Q } from '@nozbe/watermelondb';

export class OrderService {
  /**
   * Cancel an order by setting isOrderCancelled to true
   */
  static async cancelOrder(orderId: string, reason: string = 'Order cancelled - all items voided'): Promise<void> {
    try {
      await database.write(async () => {
        const order = await database
          .get<Order>('orders')
          .query(Q.where('order_id', orderId))
          .fetch();

        if (order.length === 0) {
          throw new Error(`Order with ID ${orderId} not found`);
        }

        const orderRecord = order[0];
        await orderRecord.update((record) => {
          record.isOrderCancelled = true;
          record.updatedAt = Date.now();
          // Reset syncedAt to ensure it gets synced
          if (record.syncedAt && record.syncedAt > 0) {
            record.syncedAt = 0;
          }
          
          // Set order total to 0 when all items are cancelled
          record.orderTotal = 0;
          
          // Update all items in the order to show quantity 0 (voided)
          try {
            const itemsArray = JSON.parse(record.items || '[]');
            const updatedItems = itemsArray.map((item: any) => ({
              ...item,
              quantity: '0',
              subtotal: '0.00'
            }));
            record.items = JSON.stringify(updatedItems);
          } catch (error) {
            console.log('Failed to update items array:', error);
          }
        });

        console.log(`✅ Order ${orderId} cancelled: ${reason}`);
      });
    } catch (error) {
      console.error('❌ Failed to cancel order:', error);
      throw error;
    }
  }

  /**
   * Check if an order has any remaining active items
   */
  static async hasActiveItems(orderId: string): Promise<boolean> {
    try {
      const orderItems = await database
        .get('order_items')
        .query(
          Q.where('order_id', orderId),
          Q.where('is_active', true),
          Q.where('remaining_quantity', Q.gt(0))
        )
        .fetch();

      return orderItems.length > 0;
    } catch (error) {
      console.error('❌ Failed to check active items:', error);
      return false;
    }
  }

  /**
   * Get order by ID
   */
  static async getOrderById(orderId: string): Promise<Order | null> {
    try {
      const orders = await database
        .get<Order>('orders')
        .query(Q.where('order_id', orderId))
        .fetch();

      return orders.length > 0 ? orders[0] : null;
    } catch (error) {
      console.error('❌ Failed to get order by ID:', error);
      return null;
    }
  }
}
