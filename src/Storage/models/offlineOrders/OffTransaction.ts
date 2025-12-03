import { Model } from '@nozbe/watermelondb';
import { field, relation } from '@nozbe/watermelondb/decorators';
import type { Relation } from '@nozbe/watermelondb';
import OffOrder from './OffOrder';
import { DB_NAMES } from '../../constants';

export default class OffTransaction extends Model {
  static table = DB_NAMES.OFFLINE_TRANSACTIONS;

  @relation(DB_NAMES.OFFLINE_ORDERS, 'order_id') order!: Relation<OffOrder>;
  @field('order_id') orderId!: string;
  @field('location_id') locationId!: string;
  @field('payment_provider_id') paymentProviderId!: string;
  @field('message') message!: string;
  @field('request') request!: string | null; // JSON stored as string, can be null
  @field('status_code') statusCode!: string;
  @field('transaction_amount') transactionAmount!: number;
  @field('tender_type') tenderType!: string;
  @field('cash_drawer_device_id') cashDrawerDeviceId!: string | null;
  @field('cashier_log_id') cashierLogId!: string | null;
  @field('transaction_type') transactionType!: string | null; // Can be null
  @field('card_type') cardType!: string | null;
  @field('card_last4') cardLast4!: string | null;
  @field('card_name') cardName!: string | null;
}

