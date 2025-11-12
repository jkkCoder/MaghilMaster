// src/database/models/Order.ts
import { Model, Query } from '@nozbe/watermelondb'
import { field, date, json, children } from '@nozbe/watermelondb/decorators'
import OrderDummy from './OrderDummy'
import OrderItem from './OrderItem'

export default class Order extends Model {
  static table = 'orders'
  static associations = {
    order_dummies: { type: 'has_many' as const, foreignKey: 'order_id' },
    order_items: { type: 'has_many' as const, foreignKey: 'order_id' }
  }
  @field('order_id') orderId!: string
  @field('order_no') orderNo!: string
  @field('location_id') locationId!: string
  @field('customer_id') customerId!: string
  @field('full_name') fullName!: string
  @field('phone') phone!: string
  @field('email') email!: string
  @field('order_type_id') orderTypeId!: string
  @field('order_type_group') orderTypeGroup!: string
  @field('order_source_name') orderSourceName!: string
  @field('order_date') orderDate!: string
  @field('order_time') orderTime!: string
  @field('order_total') orderTotal!: number
  @field('status_id') statusId!: string
  @field('table_id') tableId!: string
  @field('table_names') tableNames!: string // JSON string
  @field('is_paid') isPaid!: boolean
  @field('local_time') localTime!: string
  @field('order_source') orderSource!: string
  @field('mh_transactions_entities') mhTransactionsEntities!: string // JSON string
  @field('refund_status') refundStatus!: string
  @field('order_totals') orderTotals!: string // JSON string
  @field('next_status') nextStatus!: string
  @field('payment_failed') paymentFailed!: boolean
  @field('status') status!: string
  @field('sort_order') sortOrder!: number
  @field('order_source_detail') orderSourceDetail!: string // JSON string
  @field('is_order_cancelled') isOrderCancelled!: boolean
  @field('payment_type') paymentType!: string
  @field('unique_id') uniqueId!: string
  @field('is_tax_removed') isTaxRemoved!: number
  @field('is_schedule_order') isScheduleOrder!: boolean
  @field('current_formatted_date') currentFormattedDate!: string
  @field('order_type') orderType!: string
  @field('is_scheduled') isScheduled!: boolean
  @field('transactions_with_tip') transactionsWithTip!: string // JSON string
  @field('cp_payment_tip_amount') cpPaymentTipAmount!: number
  @field('is_customization_count_required') isCustomizationCountRequired!: boolean
  @field('cash_info') cashInfo!: string // JSON string
  @field('custom_note') customNote!: string
  @field('pre_authorized_card') preAuthorizedCard!: string // JSON string
  @field('kot_throttling_item_details') kotThrottlingItemDetails!: string // JSON string
  @field('order_summary_items') orderSummaryItems!: string // JSON string
  @field('hold_items') holdItems!: string // JSON string
  @field('split_details') splitDetails!: string // JSON string
  @field('is_split_bill') isSplitBill!: boolean
  @field('split_id') splitId!: string
  @field('open_cash_drawer') openCashDrawer!: boolean
  @field('items') items!: string // JSON string
  @field('totals') totals!: string // JSON string
  @field('payment_status') paymentStatus!: string // JSON string
  @field('transactions') transactions!: string // JSON string
  @field('active_valets') activeValets!: string // JSON string
  @field('delivery_staff_details') deliveryStaffDetails!: string
  @field('business_details') businessDetails!: string // JSON string
  @field('payment_link') paymentLink!: string
  @field('item_tax') itemTax!: string
  @field('service_tax') serviceTax!: string
  @field('is_payment_done') isPaymentDone!: boolean
  @field('refunded_items') refundedItems!: string // JSON string
  @field('refunded_amount') refundedAmount!: string
  @field('voided_items') voidedItems!: string // JSON string for offline voided items
  @field('discount') discount!: number
  @field('discount_type') discountType!: string
  @field('is_order_merged') isOrderMerged!: boolean
  @date('created_at') createdAt!: Date
  @date('updated_at') updatedAt!: Date

  // Children relation to OrderDummy
  @children('order_dummies') orderDummies!: Query<OrderDummy>
  
  // Children relation to OrderItem
  @children('order_items') orderItems!: Query<OrderItem>
}