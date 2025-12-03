import { Model } from '@nozbe/watermelondb';
import { field, relation, date } from '@nozbe/watermelondb/decorators';
import type { Relation } from '@nozbe/watermelondb';
import OffOrder from './OffOrder';
import { DB_NAMES } from '../../constants';

export default class OffOrderStatus extends Model {
  static table = DB_NAMES.OFFLINE_ORDER_STATUS;

  @relation(DB_NAMES.OFFLINE_ORDERS, 'order_id') order!: Relation<OffOrder>;
  @field('order_id') orderId!: string;
  @field('status') status!: number;
  @date('event_time') eventTime!: Date | null;
  @date('created_time') createdTime!: Date | null;
  @field('updated_by') updatedBy!: string;
  @date('synced_at') syncedAt!: Date | null;
}


