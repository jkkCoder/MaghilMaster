import { Model } from '@nozbe/watermelondb';
import { field, relation, children, date } from '@nozbe/watermelondb/decorators';
import type { Relation, Q } from '@nozbe/watermelondb';
import OffOrderStatus from './OffOrderStatus';
import OffOrderTotal from './OffOrderTotal';
import OffOrderItem from './OffOrderItem';
import { DB_NAMES } from '../../constants';

export default class OffOrder extends Model {
  static table = DB_NAMES.OFFLINE_ORDERS;

  @field('location_id') locationId!: string;
  @field('customer_id') customerId!: string | null;
  @field('customer_fullname') customerFullname!: string | null;
  @field('customer_phone_number') customerPhoneNumber!: string | null;
  @field('customer_email') customerEmail!: string | null;
  @field('address_id') addressId!: string | null;
  @field('device_id') deviceId!: string | null;
  @field('staff_id') staffId!: string | null;
  @field('comment') comment!: string | null;
  @field('order_no') orderNo!: string;
  @field('order_type_id') orderTypeId!: string;
  @date('order_date') orderDate!:  Date | null;
  @date('order_time') orderTime!: Date | null;
  @field('is_service_charge_removed') isServiceChargeRemoved!: number;
  @field('is_tax_removed') isTaxRemoved!: number;
  @date('pickup_date') pickupDate!: Date | null;
  @date('pickup_time') pickupTime!: Date | null;
  @date('eta_date') etaDate!: Date | null;
  @date('eta_time') etaTime!: Date | null;
  @date('event_time') eventTime!: Date | null;
  @date('created_time') createdTime!: Date | null;
  @field('order_source_detail') orderSourceDetail!: string | null;
  @field('ip_address') ipAddress!: string;
  @field('user_agent') userAgent!: string;
  @field('section_id') sectionId!: string | null;
  @date('synced_at') syncedAt!: Date | null;

  @children(DB_NAMES.OFFLINE_ORDER_STATUS) statuses!: Q.Query<OffOrderStatus>;
  @children(DB_NAMES.OFFLINE_ORDER_TOTALS) totals!: Q.Query<OffOrderTotal>;
  @children(DB_NAMES.OFFLINE_ORDER_ITEMS) items!: Q.Query<OffOrderItem>;

  getOrderSourceDetail(): any {
    if (!this.orderSourceDetail) return null;
    try {
      return JSON.parse(this.orderSourceDetail);
    } catch {
      return null;
    }
  }

  setOrderSourceDetail(detail: any): void {
    this.orderSourceDetail = detail ? JSON.stringify(detail) : null;
  }
}


