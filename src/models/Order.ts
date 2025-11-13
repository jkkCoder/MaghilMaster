import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export default class Order extends Model {
  static table = 'mh_off_orders';

  @field('location_id') locationId!: string;
  @field('customer_id') customerId?: string;
  @field('order_no') orderNo!: string;
  @field('order_type_id') orderTypeId!: string;
  @date('order_date') orderDate!: Date;
  @field('order_time') orderTime!: string;
  @field('ip_address') ipAddress!: string;
  @field('user_agent') userAgent!: string;
  @readonly @date('updated_at') updatedAt!: Date;
}

