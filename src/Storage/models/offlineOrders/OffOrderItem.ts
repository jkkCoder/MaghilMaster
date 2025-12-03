import { Model } from '@nozbe/watermelondb';
import { field, relation, children, date } from '@nozbe/watermelondb/decorators';
import type { Relation, Q } from '@nozbe/watermelondb';
import OffOrder from './OffOrder';
import OffOrderItemOption from './OffOrderItemOption';
import { DB_NAMES } from '../../constants';

export default class OffOrderItem extends Model {
  static table = DB_NAMES.OFFLINE_ORDER_ITEMS;

  @relation(DB_NAMES.OFFLINE_ORDERS, 'order_id') order!: Relation<OffOrder>;
  @field('order_id') orderId!: string;
  @field('item_id') itemId!: string;
  @field('device_id') deviceId!: string;
  @field('staff_id') staffId!: string;
  @field('item_name') itemName!: string | null;
  @field('price') price!: number | null;
  @field('discount_fee_type') discountFeeType!: string;
  @field('discount_fee_rate') discountFeeRate!: number;
  @field('quantity') quantity!: number;
  @field('comment') comment!: string | null;
  @field('cancel_reason') cancelReason!: string | null; // ✅ Add cancel reason field
  @date('event_time') eventTime!: Date | null;
  @date('created_time') createdTime!: Date | null;
  @date('synced_at') syncedAt!: Date | null;

  @children(DB_NAMES.OFFLINE_ORDER_ITEM_OPTIONS) options!: Q.Query<OffOrderItemOption>;
}


