import { Model } from '@nozbe/watermelondb';
import { field, relation, date } from '@nozbe/watermelondb/decorators';
import type { Relation } from '@nozbe/watermelondb';
import OffOrderItem from './OffOrderItem';
import OffOrder from './OffOrder';
import { DB_NAMES } from '../../constants';

export default class OffOrderItemOption extends Model {
  static table = DB_NAMES.OFFLINE_ORDER_ITEM_OPTIONS;

  @relation(DB_NAMES.OFFLINE_ORDER_ITEMS, 'order_item_id') orderItem!: Relation<OffOrderItem>;
  @field('order_item_id') orderItemId!: string;
  @relation(DB_NAMES.OFFLINE_ORDERS, 'order_id') order!: Relation<OffOrder>;
  @field('order_id') orderId!: string;
  @field('modifier_option_id') modifierOptionId!: string | null;
  @field('option_name') optionName!: string;
  @field('quantity') quantity!: number;
  @field('price') price!: number | null;
  @field('sort_order') sortOrder!: number | null;
  @date('event_time') eventTime!: Date | null;
  @date('created_time') createdTime!: Date | null;
  @date('synced_at') syncedAt!: Date | null;
}


