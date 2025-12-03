import { Model } from '@nozbe/watermelondb';
import { field, relation, date } from '@nozbe/watermelondb/decorators';
import type { Relation } from '@nozbe/watermelondb';
import OffOrder from './OffOrder';
import { DB_NAMES } from '../../constants';

export default class OffOrderTotal extends Model {
  static table = DB_NAMES.OFFLINE_ORDER_TOTALS;

  @relation(DB_NAMES.OFFLINE_ORDERS, 'order_id') order!: Relation<OffOrder>;
  @field('order_id') orderId!: string;
  @field('code') code!: number;
  @field('title') title!: string;
  @field('value') value!: number;
  @field('sort_order') sortOrder!: number;
  @date('event_time') eventTime!: Date | null;
  @date('created_time') createdTime!: Date | null;
  @date('synced_at') syncedAt!: Date | null;
}


