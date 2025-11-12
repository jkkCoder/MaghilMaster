import { Model } from '@nozbe/watermelondb';
import { field, date, text, relation } from '@nozbe/watermelondb/decorators';
import Order from './order';

export default class OrderItem extends Model {
  static table = 'order_items';
  static associations = {
    orders: { type: 'belongs_to' as const, key: 'order_id' },
  };

  @field('order_id') orderId!: string;
  @field('item_id') itemId!: string;
  @text('item_name') itemName!: string;
  @field('quantity') quantity!: number;
  @field('price') price!: number;
  @field('subtotal') subtotal!: number;
  @field('tax_fees') taxFees!: number;
  @field('order_item_id') orderItemId!: string;
  @field('remaining_quantity') remainingQuantity!: number;
  @field('remaining_amount') remainingAmount!: number;
  @text('void_reason') voidReason!: string;
  @field('last_updated') lastUpdated!: number;
  @field('is_active') isActive!: boolean;
  @field('synced_at') syncedAt!: number;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
  @field('is_voided') isVoided!: boolean;
  @field('voided_quantity') voidedQuantity!: number;
  @field('voided_amount') voidedAmount!: number;

  // This creates the belongs_to relation back to Order
  @relation('orders', 'order_id') order!: Order;
}
