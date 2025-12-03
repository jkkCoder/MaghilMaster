import { database } from '../database';
import { DB_NAMES } from '../constants';
import { OffOrder, OffOrderItem, OffOrderItemOption, OffOrderStatus, OffOrderTotal, OffTransaction, Staff } from '../models';
import { Cart, CartItem, CartTotal } from '../../features/cart/cartModels';
import { OrderDetail, OrderItem, OrderTotal, Transaction, PaymentStatus, ValetDetail, BusinessDetails, orderStatusAndTags } from '../../features/order/orderModels';
import { v4 as uuidv4 } from 'uuid';
import { Q, Collection } from '@nozbe/watermelondb';
import { OrdersRequestTransaction, OrderTransaction, OTPaginationResponse } from '../../features/orderTransactions/orderTransactionModels';
import moment from 'moment';
import { getState } from '../../features/getStore';
import { OrderType } from '../../features/menu/menuModels';
import { getOrderCureentStatusText, getOrderLabelText } from '../../utils/order-utils';
import { getTotalByCode, getTaxBasedOnDiscount } from '../../utils/cart-utils'; // ✅ Add this import
import { ORDER_STATUS_CODES } from '../../features/common/constants';

/**
 * Order Status Enums based on Order Type
 */
export const ORDER_STATUS_BY_TYPE = {
  // Dine In Orders (Order source: I, Order type: D)
  DINE_IN: {
    IN_QUEUE: 0, // In Queue
    ACCEPTED: 11,
    IN_PREPARATION: 12,
    KOT_READY: 43,
    ORDER_READY: 13,
    ORDER_SERVED: 59,
    COMPLETED: 17,
  },
  // Instore Orders (Order source: I, Order type: I)
  INSTORE: {
    IN_QUEUE: 0, // In Queue
    ACCEPTED: 11,
    IN_PREPARATION: 12,
    KOT_READY: 43,
    ORDER_READY: 13,
    COMPLETED: 16,
  },
  // Phone Orders (Order source: P, Order type: I)
  PHONE: {
    IN_QUEUE: 0, // In Queue
    ACCEPTED: 11,
    IN_PREPARATION: 12,
    KOT_READY: 43,
    ORDER_READY: 13,
    COMPLETED: 16,
  },
  // QSR Orders (Order source: D, Order type: D)
  QSR: {
    IN_QUEUE: 0, // In Queue
    ACCEPTED: 11,
    IN_PREPARATION: 12,
    KOT_READY: 43,
    ORDER_READY: 13,
    ORDER_SERVED: 59,
    COMPLETED: 17,
  },
  // Third Party Orders (Order source: I, Order type: I)
  THIRD_PARTY: {
    IN_QUEUE: 0, // In Queue
    ACCEPTED: 0, // Accepted (empty in requirements)
    IN_PREPARATION: 12,
    KOT_READY: 43,
    ORDER_READY: 13,
    COMPLETED: 16,
  },
};

/**
 * Get initial status based on order source and order type
 * Returns the ACCEPTED status number (11) for most order types, except Third Party which uses 0
 */
export function getInitialOrderStatus(orderSource: string, orderTypeId: string, orderTypeGroup?: string): number {
  // Determine order type group from orderSource or orderTypeGroup
  const source = orderSource || '';
  const typeGroup = orderTypeGroup || '';
  
  // QSR: Order source D, Order type D
  if (source === 'D' && typeGroup === 'D') {
    return ORDER_STATUS_BY_TYPE.QSR.ACCEPTED; // 11
  }
  
  // Dine In: Order source I, Order type D
  if (source === 'I' && typeGroup === 'D') {
    return ORDER_STATUS_BY_TYPE.DINE_IN.ACCEPTED; // 11
  }
  
  // Phone: Order source P, Order type I
  if (source === 'P' && typeGroup === 'I') {
    return ORDER_STATUS_BY_TYPE.PHONE.ACCEPTED; // 11
  }
  
  // Third Party: Order source I, Order type I (ACCEPTED is 0 for Third Party)
  // Note: Third Party might be identified by orderSourceName, but for now we check typeGroup
  if (source === 'I' && typeGroup === 'I') {
    // Check if it's Third Party (would need orderSourceName to be sure, but defaulting to INSTORE)
    return ORDER_STATUS_BY_TYPE.INSTORE.ACCEPTED; // 11
  }
  
  // Instore: Order source I, Order type I (default)
  return ORDER_STATUS_BY_TYPE.INSTORE.ACCEPTED; // 11
}

/**
 * Get next status based on current status and order type
 * Returns the next status code in the order flow
 */
function getNextStatus(
  currentStatus: number,
  orderSource: string,
  orderTypeGroup: string
): string | undefined {
  // Determine which status flow to use
  let statusFlow: typeof ORDER_STATUS_BY_TYPE.DINE_IN;
  
  // QSR: Order source D, Order type D
  if (orderSource === 'D' && orderTypeGroup === 'D') {
    statusFlow = ORDER_STATUS_BY_TYPE.QSR;
  }
  // Dine In: Order source I, Order type D
  else if (orderSource === 'I' && orderTypeGroup === 'D') {
    statusFlow = ORDER_STATUS_BY_TYPE.DINE_IN;
  }
  // Phone: Order source P, Order type I
  else if (orderSource === 'P' && orderTypeGroup === 'I') {
    statusFlow = ORDER_STATUS_BY_TYPE.PHONE;
  }
  // Instore or Third Party: Order source I, Order type I
  else {
    // Default to INSTORE (can be enhanced to detect Third Party)
    statusFlow = ORDER_STATUS_BY_TYPE.INSTORE;
  }
  
  // Map current status to next status
  if (currentStatus === statusFlow.ACCEPTED) {
    return statusFlow.IN_PREPARATION.toString();
  } else if (currentStatus === statusFlow.IN_PREPARATION) {
    return statusFlow.KOT_READY.toString();
  } else if (currentStatus === statusFlow.KOT_READY) {
    return statusFlow.ORDER_READY.toString();
  } else if (currentStatus === statusFlow.ORDER_READY) {
    if (statusFlow.ORDER_SERVED !== undefined) {
      return statusFlow.ORDER_SERVED.toString();
    } else {
      return statusFlow.COMPLETED.toString();
    }
  } else if (currentStatus === statusFlow.ORDER_SERVED) {
    return statusFlow.COMPLETED.toString();
  }
  
  // Default: no next status (order is completed or cancelled)
  return undefined;
}

/**
 * Build orderStatusAndTags array for offline orders
 * This enables the "long press to view options" functionality
 * Returns ALL available forward statuses from the current status (like online flow)
 */
function buildOrderStatusAndTags(
  currentStatus: number,
  orderSource: string,
  orderTypeGroup: string,
  isPaid: boolean
): orderStatusAndTags[] {
  // Determine which status flow to use
  let statusFlow: typeof ORDER_STATUS_BY_TYPE.DINE_IN;
  
  if (orderSource === 'D' && orderTypeGroup === 'D') {
    statusFlow = ORDER_STATUS_BY_TYPE.QSR;
  } else if (orderSource === 'I' && orderTypeGroup === 'D') {
    statusFlow = ORDER_STATUS_BY_TYPE.DINE_IN;
  } else if (orderSource === 'P' && orderTypeGroup === 'I') {
    statusFlow = ORDER_STATUS_BY_TYPE.PHONE;
  } else {
    statusFlow = ORDER_STATUS_BY_TYPE.INSTORE;
  }

  const statusTags: orderStatusAndTags[] = [];
  let sortOrder = 1;

  // Helper to add status tag
  const addStatusTag = (statusCode: number, name: string, switchStatus: boolean) => {
    statusTags.push({
      name,
      sortOrder: sortOrder.toString(),
      status: [statusCode.toString()],
      switchStatus,
    });
    sortOrder++;
  };

  // Build ALL available forward statuses from current status
  // This matches the online flow behavior where all forward statuses are shown
  
  if (currentStatus === statusFlow.IN_QUEUE || currentStatus === 0) {
    // In Queue - show all forward statuses
    addStatusTag(statusFlow.ACCEPTED, 'Accepted', true);
    addStatusTag(statusFlow.IN_PREPARATION, 'In Preparation', true);
    addStatusTag(statusFlow.KOT_READY, 'KOT Ready', true);
    addStatusTag(statusFlow.ORDER_READY, 'Ready', true);
    if ('ORDER_SERVED' in statusFlow && statusFlow.ORDER_SERVED !== undefined) {
      const orderServedCode = (statusFlow as any).ORDER_SERVED;
      addStatusTag(orderServedCode, 'Served', isPaid);
    }
    addStatusTag(statusFlow.COMPLETED, 'Completed', isPaid);
  } else if (currentStatus === statusFlow.ACCEPTED) {
    // Accepted - show all forward statuses
    addStatusTag(statusFlow.IN_PREPARATION, 'In Preparation', true);
    addStatusTag(statusFlow.KOT_READY, 'KOT Ready', true);
    addStatusTag(statusFlow.ORDER_READY, 'Ready', true);
    if ('ORDER_SERVED' in statusFlow && statusFlow.ORDER_SERVED !== undefined) {
      const orderServedCode = (statusFlow as any).ORDER_SERVED;
      addStatusTag(orderServedCode, 'Served', isPaid);
    }
    addStatusTag(statusFlow.COMPLETED, 'Completed', isPaid);
  } else if (currentStatus === statusFlow.IN_PREPARATION) {
    // In Preparation - show all forward statuses
    addStatusTag(statusFlow.KOT_READY, 'KOT Ready', true);
    addStatusTag(statusFlow.ORDER_READY, 'Ready', true);
    if ('ORDER_SERVED' in statusFlow && statusFlow.ORDER_SERVED !== undefined) {
      const orderServedCode = (statusFlow as any).ORDER_SERVED;
      addStatusTag(orderServedCode, 'Served', isPaid);
    }
    addStatusTag(statusFlow.COMPLETED, 'Completed', isPaid);
  } else if (currentStatus === statusFlow.KOT_READY) {
    // KOT Ready - show all forward statuses
    addStatusTag(statusFlow.ORDER_READY, 'Ready', true);
    if ('ORDER_SERVED' in statusFlow && statusFlow.ORDER_SERVED !== undefined) {
      const orderServedCode = (statusFlow as any).ORDER_SERVED;
      addStatusTag(orderServedCode, 'Served', isPaid);
    }
    addStatusTag(statusFlow.COMPLETED, 'Completed', isPaid);
  } else if (currentStatus === statusFlow.ORDER_READY) {
    // Order Ready - show remaining forward statuses
    if ('ORDER_SERVED' in statusFlow && statusFlow.ORDER_SERVED !== undefined) {
      const orderServedCode = (statusFlow as any).ORDER_SERVED;
      addStatusTag(orderServedCode, 'Served', isPaid);
    }
    addStatusTag(statusFlow.COMPLETED, 'Completed', isPaid);
  } else if ('ORDER_SERVED' in statusFlow && currentStatus === (statusFlow as any).ORDER_SERVED) {
    // Order Served - show remaining forward statuses
    addStatusTag(statusFlow.COMPLETED, 'Completed', true);
  }

  return statusTags;
}

/**
 * Order Total Codes and Titles
 */
export const ORDER_TOTAL_CODES = {
  ITEM_TOTAL: { code: 1, title: 'itemTotal', sortOrder: 1 },
  TAX: { code: 2, title: 'tax', sortOrder: 2 },
  GRATUITY: { code: 8, title: 'Gratutity', sortOrder: 3 },
  CONVENIENT_FEES: { code: 7, title: 'Convenient Fees', sortOrder: 4 },
  DELIVERY_CHARGES: { code: 4, title: 'DeliveryCharges', sortOrder: 5 },
  TIP: { code: 3, title: 'tip', sortOrder: 6 },
  DISCOUNT: { code: 6, title: 'Discount', sortOrder: 7 },
  GRAND_TOTAL: { code: 5, title: 'GrandTotal', sortOrder: 9 },
};

/**
 * Generate a random 6-digit order number
 */
export function generateOrderNumber(): string {
  const min = 100000;
  const max = 999999;
  const randomNum = Math.floor(Math.random() * (max - min + 1)) + min;
  return randomNum.toString();
}

function createDefaultOrderTotal(orderId: string, eventTime: string, createdTime: string, totalsObject: {
    grandTotal: string;
    discount: string;
    tax: string;
    itemTotal: string;
}
): OrderTotalJSON[] {
  const { discount, tax, itemTotal} = totalsObject
  const newGrandTotal =  Number(tax) + Number(itemTotal) - Number(discount)
  const returnTotals = [
    {
      id: uuidv4(),
      order_id: orderId,
      code: 1,
      title: 'Item Total',
      value: Number(totalsObject.itemTotal),
      sort_order: 1,
      event_time: eventTime,
      created_time: createdTime,
    },
    {
      id: uuidv4(),
      order_id: orderId,
      code: 2,
      title: 'Tax',
      value:  Number(totalsObject.tax),
      sort_order: 2,
      event_time: eventTime,
      created_time: createdTime,
    },
    {
      id: uuidv4(),
      order_id: orderId,
      code: 8,
      title: 'Gratuity',
      value: 0,
      sort_order: 3,
      event_time: eventTime,
      created_time: createdTime,
    },
    {
      id: uuidv4(),
      order_id: orderId,
      code: 7,
      title: 'Convenient Fees',
      value: 0,
      sort_order: 4,
      event_time: eventTime,
      created_time: createdTime,
    },
    {
      id: uuidv4(),
      order_id: orderId,
      code: 4,
      title: 'Delivery Charges',
      value: 0,
      sort_order: 5,
      event_time: eventTime,
      created_time: createdTime,
    },
    {
      id: uuidv4(),
      order_id: orderId,
      code: 3,
      title: 'Tip',
      value: 0,
      sort_order: 6,
      event_time: eventTime,
      created_time: createdTime,
    },
    {
      id: uuidv4(),
      order_id: orderId,
      code: 6,
      title: 'Discount',
      value: Number(totalsObject.discount),
      sort_order: 7,
      event_time: eventTime,
      created_time: createdTime,
    },
    {
      id: uuidv4(),
      order_id: orderId,
      code: 5,
      title: 'Grand Total',
      value: Number(newGrandTotal),
      sort_order: 1,
      event_time: eventTime,
      created_time: createdTime,
    },
  ];

  const returningData = JSON.parse(JSON.stringify(returnTotals))
  return returningData
}

/**
 * Type definitions for JSON data structure matching backend schema
 */
export interface OrderJSON {
  id: string;
  location_id: string;
  customer_id?: string | null;
  customer_fullname?: string | null;
  customer_phone_number?: string | null;
  customer_email?: string | null;
  address_id?: string | null;
  device_id?: string | null;
  staff_id?: string | null;
  comment?: string | null;
  order_no: string;
  order_type_id: string;
  order_date: string; // ISO date string
  order_time?: string | null; // ISO time string
  is_service_charge_removed?: number;
  is_tax_removed?: number;
  pickup_date?: string | null;
  pickup_time?: string | null;
  eta_date?: string | null;
  eta_time?: string | null;
  event_time?: string | null;
  created_time?: string | null;
  order_source_detail?: any | null; // JSON object
  ip_address: string;
  user_agent: string;
  section_id?: string | null;
  statuses?: OrderStatusJSON[];
  totals?: OrderTotalJSON[];
  items?: OrderItemJSON[];
  transactions?: TransactionJSON[];
}

export interface OrderStatusJSON {
  id: string;
  order_id: string;
  status: number;
  event_time?: string | null;
  created_time?: string | null;
  updated_by: string;
}

export interface OrderTotalJSON {
  id: string;
  order_id: string;
  code: number;
  title: string;
  value: number;
  sort_order: number;
  event_time?: string | null;
  created_time?: string | null;
}

export interface OrderItemJSON {
  id: string;
  order_id: string;
  item_id: string;
  device_id: string;
  staff_id: string;
  item_name?: string | null;
  price?: number | null;
  discount_fee_type: string;
  discount_fee_rate: number;
  quantity: number;
  comment?: string | null;
  event_time?: string | null;
  created_time?: string | null;
  options?: OrderItemOptionJSON[];
}

export interface OrderItemOptionJSON {
  id: string;
  order_item_id: string;
  order_id: string;
  modifier_option_id?: string | null;
  option_name: string;
  quantity: number;
  price?: number | null;
  sort_order?: number | null;
  event_time?: string | null;
  created_time?: string | null;
}

export interface TransactionJSON {
  id: string;
  order_id: string;
  location_id: string;
  payment_provider_id: string;
  message: string;
  request: string | null; // JSON stored as string, can be null
  status_code: string;
  transaction_amount: number;
  tender_type: string;
  cashDrawerDeviceId?: string | null;
  cashierLogId?: string | null;
  transaction_type: string | null;
  card_type?: string | null;
  card_last4?: string | null;
  card_name?: string | null;
}

/**
 * Helper function to parse date string to Date object (UTC)
 * Ensures dates are always in UTC format
 */
function parseDate(dateString: string | null | undefined): Date | null {
  if (!dateString) return null;
  try {
    // If it's an ISO string, it's already in UTC
    const date = new Date(dateString);
    // Ensure we're working with UTC
    return date;
  } catch {
    return null;
  }
}

/**
 * Helper function to parse time string to Date object (UTC)
 * Time strings are typically in format "HH:mm:ss" or ISO format
 * All times are converted to UTC
 */
function parseTime(timeString: string | null | undefined): Date | null {
  if (!timeString) return null;
  try {
    // If it's a full ISO string, parse directly (already UTC)
    if (timeString.includes('T') || timeString.includes(' ')) {
      return new Date(timeString);
    }
    // If it's just time (HH:mm:ss), combine with today's date in UTC
    const now = new Date();
    const [hours, minutes, seconds] = timeString.split(':');
    // Create UTC date using UTC methods
    const utcDate = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      parseInt(hours || '0', 10),
      parseInt(minutes || '0', 10),
      parseInt(seconds || '0', 10)
    ));
    return utcDate;
  } catch {
    return null;
  }
}

/**
 * Insert complete order data from JSON into WatermelonDB
 * This function handles the entire order hierarchy: order, statuses, totals, items, and item options
 */
export async function insertOrderFromJSON(orderData: OrderJSON): Promise<OffOrder> {
  return await database.write(async () => {
    const ordersCollection = database.collections.get<OffOrder>(DB_NAMES.OFFLINE_ORDERS);
    const statusesCollection = database.collections.get<OffOrderStatus>(DB_NAMES.OFFLINE_ORDER_STATUS);
    const totalsCollection = database.collections.get<OffOrderTotal>(DB_NAMES.OFFLINE_ORDER_TOTALS);
    const itemsCollection = database.collections.get<OffOrderItem>(DB_NAMES.OFFLINE_ORDER_ITEMS);
    const optionsCollection = database.collections.get<OffOrderItemOption>(DB_NAMES.OFFLINE_ORDER_ITEM_OPTIONS);
    const transactionsCollection = database.collections.get<OffTransaction>(DB_NAMES.OFFLINE_TRANSACTIONS);
    console.log({orderData})
    // Create the main order record
    const order = await ordersCollection.create(
      record => {
        record._raw.id = orderData.id;
        record.locationId = orderData.location_id;
        record.customerId = orderData.customer_id || null;
        record.customerFullname = orderData.customer_fullname || null;
        record.customerPhoneNumber = orderData.customer_phone_number || null;
        record.customerEmail = orderData.customer_email || null;
        record.addressId = orderData.address_id || null;
        record.deviceId = orderData.device_id || null;
        record.staffId = orderData.staff_id || null;
        record.comment = orderData.comment || null;
        record.orderNo = orderData.order_no;
        record.orderTypeId = orderData.order_type_id;
        record.orderDate = parseDate(orderData.order_date) || new Date();
        record.orderTime = parseTime(orderData.order_time) || new Date();
        record.isServiceChargeRemoved = orderData.is_service_charge_removed || 0;
        record.isTaxRemoved = orderData.is_tax_removed || 0;
        record.pickupDate = parseDate(orderData.pickup_date);
        record.pickupTime = parseTime(orderData.pickup_time);
        record.etaDate = parseDate(orderData.eta_date);
        record.etaTime = parseTime(orderData.eta_time);
        record.eventTime = parseDate(orderData.event_time);
        record.createdTime = parseDate(orderData.created_time);
        record.orderSourceDetail = orderData.order_source_detail
          ? JSON.stringify(orderData.order_source_detail)
          : null;
        record.ipAddress = orderData.ip_address;
        record.userAgent = orderData.user_agent;
        record.sectionId = orderData.section_id || null;
        record.syncedAt = null; // Not synced yet
      },
    );

    // Get the actual order ID that WatermelonDB assigned
    const actualOrderId = order._raw.id;

    // Create order statuses
    if (orderData.statuses && orderData.statuses.length > 0) {
      for (const statusData of orderData.statuses) {
        await statusesCollection.create(
          record => {
            record.orderId = actualOrderId; // Use actual order ID
            record.status = statusData.status;
            record.eventTime = parseDate(statusData.event_time);
            record.createdTime = parseDate(statusData.created_time);
            record.updatedBy = statusData.updated_by;
            record.syncedAt = null;
          }
        );
      }
    }

    // Create order totals
    if (orderData.totals && orderData.totals.length > 0) {
      for (const totalData of orderData.totals) {
        await totalsCollection.create(
          record => {
            record.orderId = actualOrderId; // Use actual order ID
            record.code = totalData.code;
            record.title = totalData.title;
            record.value = totalData.value;
            record.sortOrder = totalData.sort_order;
            record.eventTime = parseDate(totalData.event_time);
            record.createdTime = parseDate(totalData.created_time);
            record.syncedAt = null;
          }
        );
      }
    }

    // Create order items
    if (orderData.items && orderData.items.length > 0) {
      for (const itemData of orderData.items) {
        const orderItem = await itemsCollection.create(
          record => {
            record.orderId = actualOrderId; // Use actual order ID
            record.itemId = itemData.item_id;
            record.deviceId = itemData.device_id;
            record.staffId = itemData.staff_id;
            record.itemName = itemData.item_name || null;
            record.price = itemData.price || null;
            record.discountFeeType = itemData.discount_fee_type;
            record.discountFeeRate = itemData.discount_fee_rate;
            record.quantity = itemData.quantity;
            record.comment = itemData.comment || null;
            record.eventTime = parseDate(itemData.event_time);
            record.createdTime = parseDate(itemData.created_time);
            record.syncedAt = null;
          }
        );

        // Get the actual order item ID that WatermelonDB assigned
        // IMPORTANT: We use this actual ID instead of optionData.order_item_id from JSON
        // because WatermelonDB generates its own IDs, and we need to match the actual database ID
        const actualOrderItemId = orderItem._raw.id;

        // Create item options
        if (itemData.options && itemData.options.length > 0) {
          for (const optionData of itemData.options) {
            await optionsCollection.create(
              record => {
                // Use actual order item ID from database, NOT optionData.order_item_id from JSON
                record.orderItemId = actualOrderItemId;
                // Use actual order ID from database, NOT optionData.order_id from JSON
                record.orderId = actualOrderId;
                record.modifierOptionId = optionData.modifier_option_id || null;
                record.optionName = optionData.option_name;
                record.quantity = optionData.quantity;
                record.price = optionData.price || null;
                record.sortOrder = optionData.sort_order || null;
                record.eventTime = parseDate(optionData.event_time);
                record.createdTime = parseDate(optionData.created_time);
                record.syncedAt = null;
              }
            );
          }
        }
      }
    }

    // Create transactions
    if (orderData.transactions && orderData.transactions.length > 0) {
      for (const transactionData of orderData.transactions) {
        await transactionsCollection.create(
          record => {
            record.orderId = actualOrderId; // Use actual order ID
            record.locationId = transactionData.location_id;
            record.paymentProviderId = transactionData.payment_provider_id;
            record.message = transactionData.message;
            record.request = transactionData.request || null;
            record.statusCode = transactionData.status_code;
            record.transactionAmount = transactionData.transaction_amount;
            record.tenderType = transactionData.tender_type;
            record.cashDrawerDeviceId = transactionData.cashDrawerDeviceId || null;
            record.cashierLogId = transactionData.cashierLogId || null;
            record.transactionType = transactionData.transaction_type || null;
            record.cardType = transactionData.card_type || null;
            record.cardLast4 = transactionData.card_last4 || null;
            record.cardName = transactionData.card_name || null;
          }
        );
      }
    }

    return order;
  });
}

/**
 * Create transaction
 */
export async function createTransactionWithId(
  id: string,
  transactionData: Partial<TransactionJSON>
): Promise<OffTransaction> {
  return await database.write(async () => {
    const transactionsCollection = database.collections.get<OffTransaction>(DB_NAMES.OFFLINE_TRANSACTIONS);

    return await transactionsCollection.create(
      record => {
        if (transactionData.order_id) record.orderId = transactionData.order_id;
        if (transactionData.location_id) record.locationId = transactionData.location_id;
        if (transactionData.payment_provider_id) record.paymentProviderId = transactionData.payment_provider_id;
        if (transactionData.message) record.message = transactionData.message;
        if (transactionData.request) record.request = transactionData.request;
        if (transactionData.status_code) record.statusCode = transactionData.status_code;
        if (transactionData.transaction_amount !== undefined) record.transactionAmount = transactionData.transaction_amount;
        if (transactionData.tender_type) record.tenderType = transactionData.tender_type;
        if (transactionData.transaction_type) record.transactionType = transactionData.transaction_type;
        if (transactionData.card_type !== undefined) record.cardType = transactionData.card_type;
        if (transactionData.card_last4 !== undefined) record.cardLast4 = transactionData.card_last4;
        if (transactionData.card_name !== undefined) record.cardName = transactionData.card_name;
      }
    );
  });
}

/**
 * Convert Cart object to OrderJSON format for WatermelonDB
 * This function transforms the Cart object from Redux state to the OrderJSON format
 */
export function convertCartToOrderJSON(
  cart: Cart,
  staffId: string,
  deviceId: string,
  ipAddress: string,
  orderTypeGroup: string | null | undefined,
  defaultETA: number = 0,
  totalsObject: {
    grandTotal: string;
    discount: string;
    tax: string;
    itemTotal: string;
  },
  cashDrawerId?: string | null,
  cashierLogId?: string | null,
  dynamicPaymentMethod?: string, // For dynamic payment methods, store method name in tenderType
): OrderJSON {
  // Get current time in UTC
  const now = new Date();
  const orderId = uuidv4();
  const orderNo = generateOrderNumber();
  
  // Convert order date and time to UTC ISO strings
  // Note: toISOString() always returns UTC time in ISO 8601 format
  const orderDate = now.toISOString().split('T')[0]; // YYYY-MM-DD (UTC)
  const orderTime = now.toISOString(); // Full ISO string in UTC (e.g., "2025-01-20T10:30:00.000Z")

  // Calculate pickup date/time (orderDate + defaultETA minutes) in UTC
  const pickupDateTime = new Date(now.getTime() + defaultETA * 60000);
  const pickupDate = pickupDateTime.toISOString().split('T')[0]; // UTC date
  const pickupTime = pickupDateTime.toISOString(); // UTC ISO string

  // Calculate eta date/time (orderDate + defaultETA minutes) in UTC
  const etaDateTime = new Date(now.getTime() + defaultETA * 60000);
  const etaDate = etaDateTime.toISOString().split('T')[0]; // UTC date
  const etaTime = etaDateTime.toISOString(); // UTC ISO string
  
  // Determine order source and type group
  const orderSource = cart.orderSource || 'I';
  const typeGroup = orderTypeGroup || 'I';
  
  // Get initial status based on order type
  const initialStatus = getInitialOrderStatus(orderSource, cart.orderTypeId, typeGroup);
  
  // Build order source detail
  const orderSourceDetail: any = {};
  if (cart.orderSourceName) orderSourceDetail.orderSourceName = cart.orderSourceName;
  if (cart.orderSourceNo) orderSourceDetail.orderSourceNo = cart.orderSourceNo;
  if (cart.discountType) orderSourceDetail.discountType = cart.discountType;
  if (cart.discount !== undefined) orderSourceDetail.discountAmount = cart.discount;
  if (cart.offerReason) orderSourceDetail.discountRemark = cart.offerReason;
  if (cart.offerId) orderSourceDetail.offerId = cart.offerId;
  if (cart.payType) orderSourceDetail.payType = cart.payType;
  
  // ✅ For offline orders created in-store, isPayByLinkOrder should always be false
  // Offline orders are paid with cash, card, or pay at store - not through pay by link
  orderSourceDetail.isPayByLinkOrder = false;
  orderSourceDetail.unrealizedOrder = false;
  orderSourceDetail.unrealizedComment = null;
  
  // Create statuses array - Add ORDER_CREATED (6) first, then ACCEPTED (11) to match online flow
  const statuses: OrderStatusJSON[] = [
    {
      id: uuidv4(),
      order_id: orderId,
      status: 6, // ORDER_CREATED - First status when order is created
      event_time: orderTime,
      created_time: orderTime,
      updated_by: staffId || '',
    },
    {
      id: uuidv4(),
      order_id: orderId,
      status: initialStatus, // MERCHANT_ACCEPTED (11) or other initial status
      event_time: orderTime,
      created_time: orderTime,
      updated_by: staffId || '',
    },
  ];
  // Create totals (7 entries)
  const totals = createDefaultOrderTotal(orderId, orderTime, orderTime, totalsObject);
  
  // Convert items
  const items: OrderItemJSON[] = (cart.items || []).map((item: CartItem) => {
    const itemId = uuidv4();
    return {
      id: itemId,
      order_id: orderId,
      item_id: item.itemId,
      device_id: deviceId,
      staff_id: staffId,
      item_name: item.itemName || null,
      price: item.price ? parseFloat(item.price) : null,
      discount_fee_type: 'FLATFEE', // Default
      customer_fullname: cart.fullName,
      customer_phone_number: cart.phone,
      customer_email: cart.email,
      discount_fee_rate: 0,
      quantity: item.quantity ? parseInt(item.quantity) : 1,
      comment: item.comment || null,
      event_time: orderTime,
      created_time: orderTime,
      options: (item.options || []).map((option, index) => ({
        id: uuidv4(),
        order_item_id: itemId,
        order_id: orderId,
        modifier_option_id: option.modifierOptionId || null,
        option_name: option.modifier || option.optionName || '',
        quantity: option.quantity ? parseInt(option.quantity) : 1,
        price: option.price ? parseFloat(option.price) : null,
        sort_order: index,
        event_time: orderTime,
        created_time: orderTime,
      })),
    };
  });
  
  // Create transactions based on payment type
  const transactions: TransactionJSON[] = [];
  
  // Get payment type from cart
  const paymentType = cart.payType?.toLowerCase() || '';
  const isCashPayment = paymentType === 'cash';
  const isPayAtStore = paymentType === 'pay_at_store' || paymentType === 'payatstore';
  const isCardPayment = paymentType === 'card';
  const isDuePayment = paymentType === 'due' || dynamicPaymentMethod?.toUpperCase() === 'DUE';
  
  // Get transaction amount from grand total (code 5)
  const grandTotal = totals.find(t => t.code === 5);
  const transactionAmount = grandTotal?.value || 0;
  
  // Create transaction for cash payment
  if (isCashPayment) {
    // Build request JSON (for cash payments, include cash drawer device ID)
    let requestData: any = null;
    if (cashDrawerId) {
      requestData = {
        cash_drawer_device_id: cashDrawerId,
        cashier_log_id: cashierLogId,
      };
    }
    
    const transaction: TransactionJSON = {
      id: uuidv4(),
      order_id: orderId,
      location_id: cart.locationId,
      payment_provider_id: 'OFFLINE_CASH_TRANSACTION',
      message: 'offline Payment is successful',
      request: requestData ? JSON.stringify(requestData) : null,
      status_code: '24',
      transaction_amount: transactionAmount,
      tender_type: 'CASH',
      cashDrawerDeviceId: cashDrawerId ?? '',
      cashierLogId: cashierLogId ?? '',
      transaction_type: null,
      card_type: null,
      card_last4: null,
      card_name: null,
    };
    
    transactions.push(transaction);
  }
  
  // Create transaction for DUE payment
  if (isDuePayment) {
    const transaction: TransactionJSON = {
      id: uuidv4(),
      order_id: orderId,
      location_id: cart.locationId,
      payment_provider_id: 'OFFLINE_CASH_TRANSACTION',
      message: 'Offline Payment is successful',
      request: null,
      status_code: '24',
      transaction_amount: transactionAmount,
      tender_type: 'DUE',
      cashDrawerDeviceId: null,
      cashierLogId: null,
      transaction_type: null,
      card_type: null,
      card_last4: null,
      card_name: null,
    };
    
    transactions.push(transaction);
  }
  
  // Create transaction for pay at store (pay later)
  if (isPayAtStore) {
    const transaction: TransactionJSON = {
      id: uuidv4(),
      order_id: orderId,
      location_id: cart.locationId,
      payment_provider_id: 'OFFLINE_CASH_TRANSACTION',
      message: 'offline Payment is initiated',
      request: null,
      status_code: '25',
      transaction_amount: transactionAmount,
      tender_type: 'POS',
      cashDrawerDeviceId: null,
      cashierLogId: null,
      transaction_type: null,
      card_type: null,
      card_last4: null,
      card_name: null,
    };
    
    transactions.push(transaction);
  }
  
  // Create transaction for card payment (dummy data)
  if (isCardPayment) {
    const transaction: TransactionJSON = {
      id: uuidv4(),
      order_id: orderId,
      location_id: cart.locationId,
      payment_provider_id: 'OFFLINE_CARD_TRANSACTION',
      message: 'offline Card Payment is successful',
      request: JSON.stringify({
        card_type: 'VISA',
        card_last4: '1234',
      }),
      status_code: '24',
      transaction_amount: transactionAmount,
      tender_type: 'CARD',
      cashDrawerDeviceId: null,
      cashierLogId: null,
      transaction_type: 'SALE',
      card_type: 'VISA',
      card_last4: '1234',
      card_name: 'Dummy Card',
    };
    
    transactions.push(transaction);
  }
  
  // Create transaction for dynamic payment methods (other than cash, card, pay_at_store, DUE)
  if (!isCashPayment && !isCardPayment && !isPayAtStore && !isDuePayment && dynamicPaymentMethod) {
    const transaction: TransactionJSON = {
      id: uuidv4(),
      order_id: orderId,
      location_id: cart.locationId,
      payment_provider_id: 'OFFLINE_DYNAMIC_TRANSACTION',
      message: 'offline Payment is successful',
      request: null,
      status_code: '24',
      transaction_amount: transactionAmount,
      tender_type: dynamicPaymentMethod, // Use the dynamic payment method name as tenderType
      cashDrawerDeviceId: null,
      cashierLogId: null,
      transaction_type: null,
      card_type: null,
      card_last4: null,
      card_name: null,
    };
    
    transactions.push(transaction);
  }
  
  // Build the OrderJSON object
  const orderJSON: OrderJSON = {
    id: orderId,
    location_id: cart.locationId,
    customer_id: cart.customerId as string,
    customer_fullname: cart.fullName || null,
    customer_phone_number: cart.phone || null,
    customer_email: cart.email || null,
    address_id: null,
    device_id: deviceId,
    staff_id: staffId,
    comment: cart.comment || null,
    order_no: orderNo,
    order_type_id: cart.orderTypeId,
    order_date: orderDate,
    order_time: orderTime,
    is_service_charge_removed: 0,
    is_tax_removed: cart.isTaxRemoved || 0,
    pickup_date: pickupDate,
    pickup_time: pickupTime,
    eta_date: etaDate || null,
    eta_time: etaTime || null,
    event_time: now.toISOString(),
    created_time: null,
    order_source_detail: Object.keys(orderSourceDetail).length > 0 ? orderSourceDetail : null,
    ip_address: ipAddress,
    user_agent: 'MERCHANT_APP',
    section_id: cart.sectionId || null,
    statuses,
    totals,
    items,
    transactions: transactions.length > 0 ? transactions : undefined,
  };
  console.log('orderJSON', orderJSON);
  return orderJSON;
}

/**
 * Helper function to format Date to ISO string
 */
function formatDateToISO(date: Date | null | undefined): string | null {
  if (!date) return null;
  try {
    return date.toISOString();
  } catch {
    return null;
  }
}

/**
 * Helper function to format Date to date string (YYYY-MM-DD)
 */
function formatDateToString(date: Date | null | undefined): string | null {
  if (!date) return null;
  try {
    return date.toISOString()//.split('T')[0];
  } catch {
    return null;
  }
}

/**
 * Get order by ID and return as OrderJSON
 * Retrieves the complete order hierarchy from WatermelonDB
 */
/**
 * Get order by ID and return as OrderDetail (matching API response structure)
 * Retrieves the complete order hierarchy from WatermelonDB and converts it to OrderDetail format
 */
export async function getOrderJSON(orderId: string): Promise<OrderDetail | null> {
  try {
    const ordersCollection = database.collections.get<OffOrder>(DB_NAMES.OFFLINE_ORDERS);
    
    // Find the order by ID
    const order = await ordersCollection.find(orderId);
    
    if (!order) {
      return null;
    }
    
    // Fetch all related data
    const [statuses, totals, items, transactions] = await Promise.all([
      database.collections
        .get<OffOrderStatus>(DB_NAMES.OFFLINE_ORDER_STATUS)
        .query(Q.where('order_id', orderId))
        .fetch(),
      database.collections
        .get<OffOrderTotal>(DB_NAMES.OFFLINE_ORDER_TOTALS)
        .query(Q.where('order_id', orderId))
        .fetch(),
      database.collections
        .get<OffOrderItem>(DB_NAMES.OFFLINE_ORDER_ITEMS)
        .query(Q.where('order_id', orderId))
        .fetch(),
      database.collections
        .get<OffTransaction>(DB_NAMES.OFFLINE_TRANSACTIONS)
        .query(Q.where('order_id', orderId))
        .fetch(),
    ]);
    
    // Fetch options for each item
    const itemsWithOptions = await Promise.all(
      items.map(async (item) => {
        const options = await database.collections
          .get<OffOrderItemOption>(DB_NAMES.OFFLINE_ORDER_ITEM_OPTIONS)
          .query(Q.where('order_item_id', item.id))
          .fetch();
        return { item, options };
      })
    );
    
    // Parse order source detail
    let orderSourceDetail: any = null;
    if (order.orderSourceDetail) {
      try {
        orderSourceDetail = JSON.parse(order.orderSourceDetail);
      } catch {
        orderSourceDetail = null;
      }
    }
    
    // Calculate totalItems (sum of all item quantities)
    const totalItems = itemsWithOptions.reduce((sum, { item }) => sum + item.quantity, 0);
    
    // Calculate orderTotal from totals (code 5: Grand Total)
    const orderTotalEntry = totals.find(t => t.code === 5);
    const orderTotal = orderTotalEntry?.value || 0;
    
    // Get latest status
    const latestStatus = statuses.length > 0 ? statuses[statuses.length - 1] : null;
    const status = latestStatus?.status.toString() || '0';
    
    // Determine paymentStatus from latest transaction
    let paymentStatus: PaymentStatus | null = null;
    let isTransactionCompleted = false;
    if (transactions.length > 0) {
      const latestTransaction = transactions[transactions.length - 1];
      paymentStatus = {
        id: latestTransaction.id,
        locationId: latestTransaction.locationId,
        paymentProviderId: latestTransaction.paymentProviderId,
        orderId: latestTransaction.orderId,
        message: latestTransaction.message,
        request: latestTransaction.request || '',
        response: '', // Not stored in offline transactions
        statusCode: latestTransaction.statusCode,
        authorizationCode: '', // Not applicable for offline
        transactionAmount: latestTransaction.transactionAmount,
        amountTendered: latestTransaction.transactionAmount,
        tenderType: latestTransaction.tenderType,
        cardType: latestTransaction.cardType || '',
        cardInfo: latestTransaction.cardLast4 || '',
        transactionType: latestTransaction.transactionType || '',
        createdTime: formatDateToISO(order.createdTime) || '',
        modifiedTime: formatDateToISO(order.eventTime) || '',
      };
      // Status code 24 typically means success in offline transactions
      isTransactionCompleted = latestTransaction.statusCode === '24';
    }
    
    // Map items to OrderItem format
    const orderItems: OrderItem[] = itemsWithOptions.map(({ item, options }) => ({
      id: item.id,
      itemId: item.itemId,
      itemName: item.itemName || '',
      cuisineId: '', // Not stored in offline
      itemAltName: '', // Not stored in offline
      quantity: item.quantity.toString(),
      price: item.price?.toString() || '0',
      subTotal: (item.price * item.quantity).toFixed(2),
      customNote: item.comment || null,
      comment: item.comment || null,
      options: options.map((option) => ({
        id: option.id,
        modifierOptionId: option.modifierOptionId || '',
        optionName: option.optionName,
        quantity: option.quantity.toString(),
        price: option.price?.toString() || '0',
        comment: null,
        cartIndex: null,
      })),
      taxFees: null,
      itemModified: false,
      cancelReason: null,
      category: null,
      masterKOT: false,
      stationKOT: false,
      stockQuantity: null,
      classesPerMonth: null,
      imageRequired: 0,
      isCustomizationItem: false,
      categoryId: null,
      index: null,
      startDate: null,
      endDate: null,
      durationOfClasses: null,
      isSelected: false,
      reason: null,
      uniqueId: item.id,
      isCompOff: false,
      initialQuantity: item.quantity.toString(),
      orderItemId: item.id,
      isWeightBased: null,
      priceUnit: null,
    }));
    
    // Map totals to OrderTotal format
    const orderTotals: OrderTotal[] = totals.map((total) => ({
      id: total.id,
      code: total.code.toString(),
      title: total.title,
      value: total.value.toFixed(2),
      sortOrder: total.sortOrder.toString(),
    }));
    
    // Map transactions to Transaction format
    const orderTransactions: Transaction[] = transactions.map(t => {
      // ✅ Get transaction's own timestamp from WatermelonDB _raw.created_at
      // WatermelonDB automatically adds created_at to all models
      const transactionCreatedAt = (t as any)._raw?.created_at;
      const transactionUpdatedAt = (t as any)._raw?.updated_at;
      
      // Use transaction's own timestamp, fallback to order's createdTime
      const transactionCreatedTime = transactionCreatedAt 
        ? moment(transactionCreatedAt).toISOString()
        : order.createdTime;
      
      const transactionModifiedTime = transactionUpdatedAt 
        ? moment(transactionUpdatedAt).toISOString()
        : transactionCreatedTime; // Use created_at if updated_at not available
      
      return {
        id: t.id,
        orderId: t.orderId,
        locationId: t.locationId,
        paymentProviderId: t.paymentProviderId,
        message: t.message || '',
        transactionAmount: t.transactionAmount,
        request: t.request || '',
        response: '',
        statusCode: t.statusCode,
        authorizationCode: '',
        createdTime: transactionCreatedTime, // ✅ Use transaction's own timestamp
        modifiedTime: transactionModifiedTime, // ✅ Use transaction's own timestamp
        tenderType: t.tenderType,
        amountTendered: t.transactionAmount,
        staffId: undefined,
      };
    });
    
    // Build OrderDetail object matching API response
    const orderDetail: OrderDetail = {
      // Base Order fields
      orderId: order.id,
      locationId: order.locationId,
      customerId: order.customerId || '',
      deviceId: order.deviceId || '',
      staffId: order.staffId || '',
      fullName: order.customerFullname || orderSourceDetail?.customerName || '',
      email: order.customerEmail || orderSourceDetail?.customerEmail || '',
      phone: order.customerPhoneNumber || orderSourceDetail?.customerMobile || '',
      totalItems: totalItems.toString(),
      comment: order.comment || '',
      orderNo: order.orderNo,
      orderTypeId: order.orderTypeId,
      orderTotal: orderTotal,
      pendingAmount: 0, // Default for offline
      status: status,
      address: null,
      deliveryStaffId: '',
      addressLine1: '',
      addressLine2: '',
      addressLine3: '',
      orderDate: formatDateToString(order.orderDate) || '',
      orderTime: formatDateToISO(order.orderTime) || '',
      etaTime: formatDateToISO(order.etaTime),
      etaDate: formatDateToString(order.etaDate),
      pickUpTime: formatDateToISO(order.pickupTime) || '',
      pickUpDate: formatDateToString(order.pickupDate) || '',
      deliveryTime: '',
      deliveryDate: '',
      paymentStatus: paymentStatus,
      transactions: orderTransactions,
      tableName: orderSourceDetail?.tableName || null,
      orderSourceName: orderSourceDetail?.orderSourceName || '',
      orderSourceNo: orderSourceDetail?.orderSourceNo || '',
      orderSource: orderSourceDetail?.orderSource || 'I',
      sortOrder: null,
      serverStaffName: order.staffId,
      reservationId: null,
      orderTypeGroup: orderSourceDetail?.orderTypeGroup || '',
      branchName: null,
      guestCount: orderSourceDetail?.guestCount || 0,
      currentDate: formatDateToString(new Date()),
      currentTime: formatDateToISO(new Date()),
      orderSourceDetail: orderSourceDetail,
      isScheduleOrder: false,
      tip: null,
      tipType: null,
      eventSlug: orderSourceDetail?.eventSlug || null,
      slotTime: orderSourceDetail?.slotTime || null,
      isQSROrder: false,
      
      // OrderDetail specific fields
      items: orderItems,
      totals: orderTotals,
      transactionsToShow: [],
      activeValets: [],
      deliveryStaffDetails: [],
      businessDetails: {} as BusinessDetails,
      isOrderCancelled: false,
      paymentLink: null,
      itemTax: null,
      serviceTax: null,
      isPaymentDone: isTransactionCompleted,
      tableId: orderSourceDetail?.tableId || null,
      isTransactionCompleted: isTransactionCompleted,
      refundedItems: [],
      refundedAmount: null,
      refundAmount: 0,
      discount: parseFloat(orderSourceDetail?.discountAmount || '0'),
      discountType: orderSourceDetail?.discountType || '',
      isOrderMerged: false,
      paymentType: orderSourceDetail?.payType || null,
      uniqueId: order.id,
      isTaxRemoved: order.isTaxRemoved,
      isScheduled: false,
      transactionsWithTip: [],
      cpPaymentTipAmount: 0,
      isCustomizationCountRequired: false,
      cashInfo: null,
      customNote: order.comment,
      preAuthorizedCard: null,
      kotThrottlingItemDetails: [],
      orderSummaryItems: [],
      holdItems: null,
      splitDetails: [],
      isSplitBill: false,
      splitId: null,
      openCashDrawer: false,
      kotNo: null,
      orderInstruction: null,
      payByLink: 0,
      channel: null,
      requestedTime: null,
      amount: null,
      orderStatus: status,
      trackURL: null,
      dasherName: null,
      dasherPhone: null,
      dasherDeliveryETA: null,
      dasherPickupETA: null,
      nextStatus: null,
      orderActivities: [],
      orderStatusAndTags: [],
      orderInstructions: [],
      splitBill: false,
      payByLinkOrder:  false,
      unrealizedOrder: null,
      unrealizedComment: null,
      sourceDetail: orderSourceDetail,
      isTransactionBasedReceipt: false,
      phoneCode: orderSourceDetail?.phoneCode || '',
    };
    console.log('orderDetail  ', orderDetail);
    return orderDetail;
  } catch (error) {
    console.error('Error getting order JSON:', error);
    return null;
  }
}

/**
 * Get all orders offline from WatermelonDB with filters and pagination
 */
export async function getAllOrdersOffline(
  payload: OrdersRequestTransaction
): Promise<OTPaginationResponse> {
  console.log('🔄 [WatermelonDB] Fetching orders from WatermelonDB...');
  console.log('📦 [WatermelonDB] Payload received:', payload);

  try {
    const ordersCollection = database.collections.get<OffOrder>(DB_NAMES.OFFLINE_ORDERS);
    const transactionsCollection = database.collections.get<OffTransaction>(DB_NAMES.OFFLINE_TRANSACTIONS);
    
    // Build base query with location filter
    let query = ordersCollection.query(
      Q.where('location_id', payload.locationId)
    );

    // Filter by date range
    if (payload.startDate && payload.endDate) {
      const startDate = moment(payload.startDate, 'YYYY-MM-DD').startOf('day').valueOf();
      const endDate = moment(payload.endDate, 'YYYY-MM-DD').endOf('day').valueOf();
      
      query = ordersCollection.query(
        Q.where('location_id', payload.locationId),
        Q.or(
          Q.and(
            Q.where('order_date', Q.gte(startDate)),
            Q.where('order_date', Q.lte(endDate))
          ),
          Q.and(
            Q.where('created_time', Q.gte(startDate)),
            Q.where('created_time', Q.lte(endDate))
          )
        )
      );
    }

    // Filter by order type
    if (payload.orderTypeId && payload.orderTypeId.length > 0) {
      const baseConditions = [Q.where('location_id', payload.locationId)];
      const createdTimeConditions = [];
      console.log('payload.startDate', payload.startDate);
      console.log('payload.endDate', payload.endDate);
      if (payload.startDate && payload.endDate) {
        const startDate = moment(payload.startDate, 'YYYY-MM-DD').utc().startOf('day').valueOf();
        const endDate = moment(payload.endDate, 'YYYY-MM-DD').utc().endOf('day').valueOf();
        console.log('startDate', startDate);
        console.log('endDate', endDate);
        baseConditions.push(
          Q.where('order_date', Q.gte(startDate)),
          Q.where('order_date', Q.lte(endDate))
        );
        createdTimeConditions.push(
          Q.where('created_time', Q.gte(startDate)),
          Q.where('created_time', Q.lte(endDate))
        );
      }
      
      baseConditions.push(Q.where('order_type_id', Q.oneOf(payload.orderTypeId)));
      query = ordersCollection.query(
        Q.or(
          Q.and(...baseConditions),
          Q.and(...createdTimeConditions)
        )
      );
      console.log('query', query);
    }

    // Fetch all matching orders
    const allOrders = await query.fetch();
    
    console.log('📊 [WatermelonDB] Found orders:', allOrders.length);

    // Transform and filter orders
    const transformedOrders: OrderTransaction[] = [];
    
    for (const order of allOrders) {
      console.log(`🔄 [WatermelonDB] Processing order: ${order.orderNo} (${order.id})`);
      
      // Load related data - Query directly instead of using @children
      const statusesCollection = database.collections.get<OffOrderStatus>(DB_NAMES.OFFLINE_ORDER_STATUS);
      const totalsCollection = database.collections.get<OffOrderTotal>(DB_NAMES.OFFLINE_ORDER_TOTALS);
      
      const statuses = await statusesCollection
        .query(Q.where('order_id', order.id))
        .fetch();
      
      const totals = await totalsCollection
        .query(Q.where('order_id', order.id))
        .fetch();
      
      // Get transactions for this order
      const transactions = await transactionsCollection
        .query(Q.where('order_id', order.id))
        .fetch();

      console.log(`  �� Statuses: ${statuses.length}, Totals: ${totals.length}, Transactions: ${transactions.length}`);

      // Transform to OrderTransaction format
      const orderData = await transformOrderToTransaction(order, statuses, totals, transactions);
      
      console.log(`  ✅ Transformed order: ${orderData.orderNo}, Channel: ${orderData.orderSourceName}, Status: ${orderData.statusId}, Paid: ${orderData.isPaid}`);
      
      // Apply search filter
      if (payload.search && payload.search.length > 0) {
        const searchLower = payload.search.toLowerCase();
        const matchesSearch = 
          orderData.orderNo.toLowerCase().includes(searchLower) ||
          (orderData.fullName && orderData.fullName.toLowerCase().includes(searchLower)) ||
          (orderData.phone && orderData.phone.includes(searchLower));
        if (!matchesSearch) {
          console.log(`  ❌ Filtered out by search: ${orderData.orderNo}`);
          continue;
        }
      }

      // Apply order status filter
      if (payload.orderStatus && payload.orderStatus.length > 0) {
        const orderStatuses = statuses.map(s => s.status.toString());
        const matchesStatus = payload.orderStatus.some(status => 
          orderStatuses.includes(status)
        );
        if (!matchesStatus) {
          console.log(`  ❌ Filtered out by orderStatus. Order statuses: [${orderStatuses.join(',')}], Filter: [${payload.orderStatus.join(',')}]`);
          continue;
        }
      }

      // Apply channel filter (from order_source_detail)
      if (payload.channel && payload.channel.length > 0) {
        const sourceDetail = order.getOrderSourceDetail();
        const orderChannel = sourceDetail?.channel?.toLowerCase() || '';
        
        // If order has no channel, it's an instore order (created from MHMenu)
        // Treat it as "instore" or "maghilhub" for filtering
        if (!orderChannel) {
          // Check if filter includes "instore", "in-store", or "maghilhub"
          const hasInstoreChannel = payload.channel.some(ch => {
            const chLower = ch.toLowerCase();
            return chLower === 'instore' || 
                   chLower === 'in-store' || 
                   chLower === 'maghilhub' ||
                   chLower === 'maghil';
          });
          
          if (!hasInstoreChannel) {
            console.log(`  ❌ Filtered out by channel. Order has no channel (instore) and instore/maghilhub not in filter`);
            continue;
          }
          // Order without channel matches instore filter, include it
          console.log(`  ✅ Order without channel included (assumed instore): ${orderData.orderNo}`);
        } else {
          // Order has a channel, check if it matches filter
          const matchesChannel = payload.channel.some(ch => {
            const channelLower = ch.toLowerCase();
            // Handle 'maghil' -> 'maghilhub' mapping
            if (channelLower === 'maghil') {
              return orderChannel.includes('maghilhub');
            }
            return orderChannel.includes(channelLower);
          });
          
          if (!matchesChannel) {
            console.log(`  ❌ Filtered out by channel. Order channel: "${orderChannel}", Filter channels: [${payload.channel.join(',')}]`);
            continue;
          }
        }
      }

      // Apply payment status filter (based on transactions)
      if (payload.paymentStatus && payload.paymentStatus.length > 0) {
        const hasPaidTransaction = transactions.some(t => 
          t.statusCode === '24' || t.statusCode === '25' // Payment completed codes
        );
        const hasUnpaidTransaction = transactions.length === 0 || 
          transactions.every(t => t.statusCode !== '24' && t.statusCode !== '25');
        
        const paymentStatus = hasPaidTransaction ? 'paid' : 'unpaid';
        const matchesPaymentStatus = payload.paymentStatus.some(ps => 
          ps.toLowerCase() === paymentStatus
        );
        if (!matchesPaymentStatus) {
          console.log(`  ❌ Filtered out by paymentStatus. Order payment status: "${paymentStatus}", Filter: [${payload.paymentStatus.join(',')}]`);
          continue;
        }
      }

      console.log(`  ✅ Order passed all filters: ${orderData.orderNo}`);
      transformedOrders.push(orderData);
    }

    console.log(`📊 [WatermelonDB] After filtering: ${transformedOrders.length} orders`);

    // Apply sorting
    const sortedOrders = applySorting(transformedOrders, payload.sort);

    // Apply pagination
    const page = payload.page || 0;
    const size = payload.size || 25;
    const startIndex = page * size;
    const endIndex = startIndex + size;
    const paginatedOrders = sortedOrders.slice(startIndex, endIndex);

    // Calculate pagination metadata
    const totalElements = sortedOrders.length;
    const totalPages = Math.ceil(totalElements / size);

    console.log('✅ [WatermelonDB] Returning paginated orders:', {
      page,
      size,
      totalElements,
      totalPages,
      returned: paginatedOrders.length
    });

    return {
      content: paginatedOrders,
      totalElements,
      totalPages,
      pageable: {
        pageNumber: page,
        pageSize: size,
        sort: { sorted: true, empty: false, unsorted: false },
        offset: startIndex,
        paged: true,
        unpaged: false
      },
      last: page >= totalPages - 1,
      first: page === 0,
      size,
      number: page,
      sort: { sorted: true, empty: false, unsorted: false },
      numberOfElements: paginatedOrders.length,
      empty: paginatedOrders.length === 0
    };
  } catch (error) {
    console.error('❌ [WatermelonDB] Error fetching orders:', error);
    throw error;
  }
}

/**
 * Transform WatermelonDB order to OrderTransaction format
 */
async function transformOrderToTransaction(
  order: OffOrder,
  statuses: OffOrderStatus[],
  totals: OffOrderTotal[],
  transactions: OffTransaction[]
): Promise<OrderTransaction> {
  // Get latest status
  const sortedStatuses = statuses.sort((a, b) => 
    (b.createdTime?.getTime() || 0) - (a.createdTime?.getTime() || 0)
  );
  const latestStatus = sortedStatuses[0];

  // Calculate order total from totals (code 5 is usually grand total)
  const orderTotal = totals.find(t => t.code === 5)?.value || 
                     totals.reduce((sum, t) => sum + (t.value || 0), 0);

  // Get order source detail
  const sourceDetail = order.getOrderSourceDetail();

  // Get order type name and group from Redux state
  const restaurantOrderTypes = (getState() as any)?.restaurant?.currentRestaurantDetail?.orderTypes as OrderType[] | undefined;
  const orderType = restaurantOrderTypes?.find(ot => ot.id === order.orderTypeId);
  const orderTypeName = orderType?.typeName || '';
  const orderTypeGroup = orderType?.typeGroup || '';

  // Format channel name for display
  let formattedChannelName: string | null = null;
  const rawChannel = sourceDetail?.channel;
  
  if (rawChannel) {
    // Format channel name (capitalize, handle special cases)
    const channelLower = rawChannel.toLowerCase();
    if (channelLower === 'maghilhub' || channelLower === 'maghil') {
      formattedChannelName = 'MaghilHub';
    } else if (channelLower === 'gloriafood') {
      formattedChannelName = 'GloriaFood';
    } else if (channelLower === 'grubhub') {
      formattedChannelName = 'Grubhub';
    } else if (channelLower === 'doordash') {
      formattedChannelName = 'DoorDash';
    } else if (channelLower === 'uber eats' || channelLower === 'ubereats') {
      formattedChannelName = 'Uber Eats';
    } else if (channelLower === 'seamless') {
      formattedChannelName = 'Seamless';
    } else if (channelLower === 'swiggy') {
      formattedChannelName = 'Swiggy';
    } else if (channelLower === 'zomato') {
      formattedChannelName = 'Zomato';
    } else {
      // Capitalize first letter of each word
      formattedChannelName = rawChannel
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
  } else {
    // For orders without channel (instore orders), set default based on order type
    if (orderTypeGroup === 'I') {
      formattedChannelName = 'Instore';
    } else if (orderTypeGroup === 'D') {
      formattedChannelName = 'Dine In';
    } else if (orderTypeGroup === 'P') {
      formattedChannelName = 'Pickup';
    } else if (orderTypeGroup === 'S') {
      formattedChannelName = 'Delivery';
    } else {
      formattedChannelName = 'Instore'; // Default fallback
    }
  }

  // Determine payment status from transactions (matching online flow)
  const paidTransactions = transactions.filter(t => 
    t.statusCode === '19' || // PAYMENT_COMPLETED (online payment)
    t.statusCode === '24'    // PAYMENT_AT_LOCATION
    // Note: '25' (PAYMENT_AT_LOCATION_INITIATED) is NOT considered paid - payment is only initiated, not completed
  );
  const failedTransactions = transactions.filter(t => 
    t.statusCode === '20' || // PAYMENT_FAILURE_DECLINED
    t.statusCode === '21' || // PAYMENT_FAILURE_GATEWAY_ERROR
    t.statusCode === '22' || // PAYMENT_FAILURE_MAGIL_APP_ERROR
    t.statusCode === '23'    // PAYMENT_FAILURE_SIGN_MISMATCH
  );
  
  const isPaid = paidTransactions.length > 0;
  const paymentFailed = failedTransactions.length > 0 && !isPaid;
  const refundTransaction = transactions.find(t => t.statusCode === '26'); // Full refund
  const partialRefundTransaction = transactions.find(t => t.statusCode === '32'); // Partial refund
  const refundStatus = refundTransaction ? '26' : (partialRefundTransaction ? '32' : null);
  // Transform transactions to Transaction format
  // Use order's created time as fallback for transaction times
  const orderCreatedTime = order.createdTime 
    ? moment(order.createdTime).toISOString() 
    : new Date().toISOString();
  
  // ✅ Sort transactions in reverse chronological order (newest first) so refund appears before payment
  const sortedTransactions = [...transactions].sort((a, b) => {
    // Try to use internal created_at timestamp from WatermelonDB (newest first)
    const timeA = (a as any)._raw?.created_at || 0;
    const timeB = (b as any)._raw?.created_at || 0;
    
    if (timeA && timeB && timeA !== timeB) {
      return timeB - timeA; // ✅ Reverse: newest first (refund after payment will appear first)
    }
    
    // Fallback: Sort by status code to ensure refund (26, 32) comes before payment (19, 24) when timestamps are same
    const statusOrder: Record<string, number> = {
      '26': 1, // REFUND_SUCCESS - first (newest)
      '32': 2, // PARTIAL_REFUND_SUCCESS - second
      '19': 3, // PAYMENT_COMPLETED - third
      '24': 4, // PAYMENT_AT_LOCATION - fourth (oldest)
    };
    const orderA = statusOrder[a.statusCode] || 999;
    const orderB = statusOrder[b.statusCode] || 999;
    
    if (orderA !== orderB) {
      return orderA - orderB; // ✅ Refund before payment when timestamps are same
    }
    
    return b.id.localeCompare(a.id); // Reverse ID comparison for newest first
  });
  
  const mhTransactionsEntities: Transaction[] = sortedTransactions.map(t => {
    // ✅ Get transaction's own timestamp from WatermelonDB _raw.created_at
    const transactionCreatedAt = (t as any)._raw?.created_at;
    const transactionUpdatedAt = (t as any)._raw?.updated_at;
    
    // Use transaction's own timestamp, fallback to order's createdTime
    const transactionCreatedTime = transactionCreatedAt 
      ? moment(transactionCreatedAt).toISOString()
      : orderCreatedTime;
    
    const transactionModifiedTime = transactionUpdatedAt 
      ? moment(transactionUpdatedAt).toISOString()
      : transactionCreatedTime;
    
    return {
      id: t.id,
      orderId: t.orderId,
      locationId: t.locationId,
      paymentProviderId: t.paymentProviderId,
      message: t.message,
      transactionAmount: t.transactionAmount,
      request: t.request || '',
      response: '',
      statusCode: t.statusCode,
      authorizationCode: '',
      createdTime: transactionCreatedTime, // ✅ Use transaction's own timestamp
      modifiedTime: transactionModifiedTime, // ✅ Use transaction's own timestamp
      tenderType: t.tenderType,
      amountTendered: t.transactionAmount,
      staffId: undefined
    };
  });

  // Extract table info from order_source_detail if available
  let tableId: string | null = null;
  let tableNames: string[] = [];
  if (sourceDetail?.tableId) {
    tableId = sourceDetail.tableId;
  }
  if (sourceDetail?.tableName) {
    tableNames = Array.isArray(sourceDetail.tableName) 
      ? sourceDetail.tableName 
      : [sourceDetail.tableName];
  }

  // Extract pay by link info
  // ✅ For offline orders, always set payByLinkOrder to false (no link icon)
  // Offline orders are paid with cash, card, or pay at store - not through pay by link
  const payByLinkOrder = false;
  const payByLinkPhoneNo = '';
  const payByLinkEmail = '';
  const payByLinkLastSentChannel = '';

  // Extract unrealized order info
  const unrealizedOrder = false;
  const unrealizedComment = '';

  // Format dates
  const orderDate = moment(order.orderDate).format('YYYY-MM-DD');
  // ✅ Combine orderDate and orderTime, then format as "Nov 27, 2025 - 05:24 AM"
  const orderTime = (order.orderDate && order.orderTime) 
    ? moment(`${moment(order.orderDate).format('YYYY-MM-DD')} ${moment(order.orderTime).format('HH:mm:ss')}`, 'YYYY-MM-DD HH:mm:ss')
        .format('MMM DD, YYYY - hh:mm A')
    : '';
  // ✅ Combine orderDate and orderTime for localTime (format: "YYYY-MM-DD HH:mm:ss")
  const localTime = (order.orderDate && order.orderTime) 
    ? moment(`${moment(order.orderDate).format('YYYY-MM-DD')} ${moment(order.orderTime).format('HH:mm:ss')}`, 'YYYY-MM-DD HH:mm:ss')
        .format('YYYY-MM-DD HH:mm:ss')
    : order.createdTime 
      ? moment(order.createdTime).format('YYYY-MM-DD HH:mm:ss')
      : moment(order.orderDate).format('YYYY-MM-DD HH:mm:ss'); // Fallback to date only if time is missing

  // Determine display channel name with fallback logic (matching MHOrderTransactionCard's formattedOrderTypeName)
  let displayChannelName: string | null = null;

  if (formattedChannelName) {
    // Has a channel (third-party order) - use it directly
    displayChannelName = formattedChannelName;
  } else {
    // No channel - use fallback logic based on orderTypeGroup and orderSource
    // This matches the logic in MHOrderTransactionCard's formattedOrderTypeName
    if (orderTypeGroup === 'S') {
      // Delivery order
      if (orderSource === 'O') {
        displayChannelName = 'oDelivery';
      } else {
        displayChannelName = 'Delivery';
      }
    } else if (orderTypeGroup === 'P') {
      // Pickup order
      if (orderSource === 'I') {
        displayChannelName = 'Instore';
      } else if (orderSource === 'P') {
        displayChannelName = 'Phone';
      } else if (orderSource === 'O') {
        displayChannelName = 'oPickup';
      }
    } else if (orderTypeGroup === 'D') {
      // Dine In order
      displayChannelName = 'Dine In';
    } else if (orderTypeGroup === 'I') {
      // Instore order
      displayChannelName = 'Instore';
    }
  }

  return {
    orderId: order.id,
    orderNo: order.orderNo,
    locationId: order.locationId,
    customerId: order.customerId || '',
    fullName: order.customerFullname || sourceDetail?.customerName || '', // ✅ Use customer data
    phone: order.customerPhoneNumber || sourceDetail?.customerMobile || '', // ✅ Use customer data
    email: order.customerEmail || sourceDetail?.customerEmail || '', // ✅ Use customer data
    orderTypeId: order.orderTypeId,
    orderTypeGroup: orderTypeGroup,
    orderSourceName: displayChannelName,
    orderDate,
    orderTime,
    orderTotal,
    statusId: latestStatus?.status.toString() || '',
    tableId,
    tableNames,
    isPaid,
    paymentFailed,
    refundStatus, // ✅ Add this - calculated from transactions
    localTIme: localTime,
    mhTransactionsEntities,
    payByLinkPhoneNo,
    payByLinkEmail,
    payByLinkLastSentChannel,
    payByLinkOrder,
    unrealizedOrder,
    unrealizedComment
  };
}

/**
 * Apply sorting to orders
 */
function applySorting(
  orders: OrderTransaction[],
  sort?: string
): OrderTransaction[] {
  if (!sort) return orders;

  const sorted = [...orders];
  
  if (sort.includes('orderTime')) {
    sorted.sort((a, b) => {
      const dateA = moment(`${a.orderDate} ${a.orderTime}`).valueOf();
      const dateB = moment(`${b.orderDate} ${b.orderTime}`).valueOf();
      return sort.includes('DESC') || sort.includes('desc') ? dateB - dateA : dateA - dateB;
    });
  } else if (sort.includes('orderNo')) {
    sorted.sort((a, b) => {
      return sort.includes('DESC') || sort.includes('desc')
        ? b.orderNo.localeCompare(a.orderNo)
        : a.orderNo.localeCompare(b.orderNo);
    });
  }

  return sorted;
}

/**
 * Get order detail from WatermelonDB by orderId
 */
export async function getOrderDetailOffline(orderId: string, isV2: boolean = false): Promise<OrderDetail | null> {
  try {
    console.log('📦 [WatermelonDB] Fetching order detail for orderId:', orderId);
    
    if (!orderId) {
      console.error('❌ [WatermelonDB] orderId is empty or undefined');
      return null;
    }
    
    const ordersCollection = database.collections.get<OffOrder>(DB_NAMES.OFFLINE_ORDERS);
    const itemsCollection = database.collections.get<OffOrderItem>(DB_NAMES.OFFLINE_ORDER_ITEMS);
    const itemOptionsCollection = database.collections.get<OffOrderItemOption>(DB_NAMES.OFFLINE_ORDER_ITEM_OPTIONS);
    const statusesCollection = database.collections.get<OffOrderStatus>(DB_NAMES.OFFLINE_ORDER_STATUS);
    const totalsCollection = database.collections.get<OffOrderTotal>(DB_NAMES.OFFLINE_ORDER_TOTALS);
    const transactionsCollection = database.collections.get<OffTransaction>(DB_NAMES.OFFLINE_TRANSACTIONS);

    // Fetch order by id
    let orders = await ordersCollection
      .query(Q.where('id', orderId))
      .fetch();
    
    console.log('🔍 [WatermelonDB] Orders found by id:', {
      count: orders.length,
      orderIds: orders.map(o => o.id),
      orderNos: orders.map(o => o.orderNo),
      searchedOrderId: orderId,
    });
    
    // If not found by id, try searching by orderNo (in case orderId is actually orderNo)
    if (orders.length === 0) {
      console.log('⚠️ [WatermelonDB] Order not found by id, trying orderNo...');
      orders = await ordersCollection
        .query(Q.where('order_no', orderId))
        .fetch();
      
      console.log('🔍 [WatermelonDB] Orders found by orderNo:', {
        count: orders.length,
        orderIds: orders.map(o => o.id),
        orderNos: orders.map(o => o.orderNo),
        searchedOrderNo: orderId,
      });
    }
    
    if (orders.length === 0) {
      console.log('❌ [WatermelonDB] Order not found by id or orderNo:', orderId);
      // Log all available orders for debugging (limit to 10)
      const allOrders = await ordersCollection.query().fetch();
      console.log('📋 [WatermelonDB] Available orders in database (first 10):', {
        totalCount: allOrders.length,
        sampleOrders: allOrders.slice(0, 10).map(o => ({ id: o.id, orderNo: o.orderNo })),
      });
      return null;
    }

    const order = orders[0];
    const actualOrderId = order.id; // Use the actual order id from database
    
    console.log('📋 [WatermelonDB] Order data:', {
      id: order.id,
      orderNo: order.orderNo,
      orderTypeId: order.orderTypeId,
      locationId: order.locationId,
      hasSourceDetail: !!order.orderSourceDetail,
    });

    // Fetch related data using the actual order id
    const [items, statuses, totals, transactions] = await Promise.all([
      itemsCollection.query(Q.where('order_id', actualOrderId)).fetch(),
      statusesCollection.query(Q.where('order_id', actualOrderId)).fetch(),
      totalsCollection.query(Q.where('order_id', actualOrderId)).fetch(),
      transactionsCollection.query(Q.where('order_id', actualOrderId)).fetch(),
    ]);

    console.log('📊 [WatermelonDB] Related data fetched:', {
      itemsCount: items.length,
      statusesCount: statuses.length,
      totalsCount: totals.length,
      transactionsCount: transactions.length,
      items: items.map(i => ({ id: i.id, itemName: i.itemName, quantity: i.quantity })),
      totals: totals.map(t => ({ code: t.code, title: t.title, value: t.value })),
      statuses: statuses.map(s => ({ status: s.status, createdTime: s.createdTime })),
    });

    // Fetch item options for all items
    const itemIds = items.map(item => item.id);
    const itemOptions = itemIds.length > 0
      ? await itemOptionsCollection.query(Q.where('order_item_id', Q.oneOf(itemIds))).fetch()
      : [];

    console.log('🔧 [WatermelonDB] Item options fetched:', {
      itemOptionsCount: itemOptions.length,
    });

    // Transform to OrderDetail format
    console.log('🔄 [WatermelonDB] Starting transformation...');
    try {
      const orderDetail = await transformOrderToOrderDetail(
        isV2,
        order,
        items,
        itemOptions,
        statuses,
        totals,
        transactions
      );

      console.log('✅ [WatermelonDB] Order detail transformed successfully:', {
        orderId: orderDetail.orderId,
        orderNo: orderDetail.orderNo,
        itemsCount: orderDetail.items?.length,
        totalsCount: orderDetail.totals?.length,
        transactionsCount: orderDetail.transactions?.length,
        orderSourceName: orderDetail.orderSourceName,
        orderTypeGroup: orderDetail.orderTypeGroup,
        sortOrder: orderDetail.sortOrder,
      });
      
      return orderDetail;
    } catch (transformError) {
      console.error('❌ [WatermelonDB] Error in transformOrderToOrderDetail:', transformError);
      console.error('❌ [WatermelonDB] Transform error stack:', transformError instanceof Error ? transformError.stack : 'No stack trace');
      throw transformError; // Re-throw to be caught by outer catch
    }
  } catch (error) {
    console.error('❌ [WatermelonDB] Error fetching order detail:', error);
    console.error('❌ [WatermelonDB] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('❌ [WatermelonDB] Error details:', {
      orderId,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Transform WatermelonDB order to OrderDetail format
 */
async function transformOrderToOrderDetail(
  isV2: boolean = false,
  order: OffOrder,
  items: OffOrderItem[],
  itemOptions: OffOrderItemOption[],
  statuses: OffOrderStatus[],
  totals: OffOrderTotal[],
  transactions: OffTransaction[]
): Promise<OrderDetail> {
  console.log('🔄 [Transform] Starting transformation...', {
    orderId: order.id,
    orderNo: order.orderNo,
    itemsCount: items.length,
    totalsCount: totals.length,
  });

  const sourceDetail = order.getOrderSourceDetail();
  console.log('📋 [Transform] Source detail:', sourceDetail);
  console.log('📋 [Transform] Source detail breakdown:', {
    hasSourceDetail: !!sourceDetail,
    orderSourceName: sourceDetail?.orderSourceName,
    channel: sourceDetail?.channel,
    orderSource: sourceDetail?.orderSource,
    allKeys: sourceDetail ? Object.keys(sourceDetail) : [],
  });
  
  // Get order type info
  const restaurantOrderTypes = (getState() as any)?.restaurant?.currentRestaurantDetail?.orderTypes;
  const orderType = restaurantOrderTypes?.find((ot: OrderType) => ot.id === order.orderTypeId);
  const orderTypeGroup = orderType?.typeGroup || '';
  
  console.log('📋 [Transform] Order type info:', {
    orderTypeId: order.orderTypeId,
    orderTypeGroup,
    orderTypeName: orderType?.typeName,
  });

  // Format channel name - Match online flow logic
  // ✅ IMPORTANT: Check orderSourceName FIRST (matching online flow in MHOrderTransactionCard)
  // Online flow checks orderSourceName first, then falls back to channel/orderTypeGroup logic
  let formattedChannelName: string | null = null;
  let orderSource: 'O' | 'I' | 'P' | 'E' | undefined = undefined;
  const rawChannel = sourceDetail?.channel;
  const rawOrderSourceName = sourceDetail?.orderSourceName;
  

  
  // ✅ Determine if this is an offline order (created in-store)
  // Offline orders have no channel and no valid orderSourceName (or "Instore" which is a fallback)
  const isOfflineOrder = !rawChannel && 
    (!rawOrderSourceName || rawOrderSourceName.toLowerCase() === 'instore') && 
    (!sourceDetail?.orderSource || sourceDetail?.orderSource === 'I');
  
  // ✅ Check orderSourceName first (matching online flow)
  // BUT: Ignore "Instore" as it's a fallback display name, not a real channel
  // If orderSourceName is "Instore", treat it as if there's no orderSourceName and check channel instead
  if (rawOrderSourceName && rawOrderSourceName.toLowerCase() !== 'instore') {
    // If orderSourceName exists and is not "Instore", use it directly (matching online flow behavior)
    // Format it properly (handle "maghil" -> "Maghil" or "MaghilHub")
    const orderSourceNameLower = rawOrderSourceName.toLowerCase();
    if (orderSourceNameLower === 'maghilhub' || orderSourceNameLower === 'maghil') {
      formattedChannelName = 'MaghilHub';
    } else {
      // Use orderSourceName as-is (capitalize properly)
      formattedChannelName = rawOrderSourceName
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
    // If orderSourceName exists, it's typically an online order
    orderSource = 'O';
  } else if (rawChannel) {
    // Order has a channel (third-party/online order) but no orderSourceName
    const channelLower = rawChannel.toLowerCase();
    if (channelLower === 'maghilhub' || channelLower === 'maghil') {
      formattedChannelName = 'MaghilHub';
    } else if (channelLower === 'gloriafood') {
      formattedChannelName = 'GloriaFood';
    } else if (channelLower === 'grubhub') {
      formattedChannelName = 'Grubhub';
    } else if (channelLower === 'doordash') {
      formattedChannelName = 'DoorDash';
    } else if (channelLower === 'uber eats' || channelLower === 'ubereats') {
      formattedChannelName = 'Uber Eats';
    } else if (channelLower === 'seamless') {
      formattedChannelName = 'Seamless';
    } else if (channelLower === 'swiggy') {
      formattedChannelName = 'Swiggy';
    } else if (channelLower === 'zomato') {
      formattedChannelName = 'Zomato';
    } else {
      formattedChannelName = rawChannel
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
    // If channel exists, orderSource should be 'O' (Online)
    orderSource = 'O';
  } else {
    // No channel and no orderSourceName - determine orderSource based on order type (matching online flow)
    formattedChannelName = null;
    
    // Determine orderSource based on orderTypeGroup
    if (orderTypeGroup === 'I') {
      orderSource = 'I'; // Instore
    } else if (orderTypeGroup === 'P') {
      orderSource = 'P'; // Phone/Pickup
    } else if (orderTypeGroup === 'S') {
      orderSource = 'O'; // Delivery (usually online)
    } else if (orderTypeGroup === 'D') {
      orderSource = 'I'; // Dine In (usually instore)
    } else {
      orderSource = 'I'; // Default to Instore
    }
  }

  // ✅ Determine display channel name with fallback logic (matching MHOrderTransactionCard's formattedOrderTypeName)
  let displayChannelName: string | null = null;

  console.log('🔍 [Transform] Before display channel logic:', {
    formattedChannelName,
    orderTypeGroup,
    orderSource,
    willUseFormattedChannel: !!formattedChannelName,
    willUseInstoreFallback: !formattedChannelName && orderTypeGroup === 'I'
  });

  // ✅ IMPORTANT: Check formattedChannelName FIRST (matching normal flow)
  // Normal flow checks orderSourceName first, then falls back to order type logic
  if (formattedChannelName) {
    // Has a channel/orderSourceName (third-party order like MaghilHub) - use it directly
    displayChannelName = formattedChannelName;
    console.log('✅ [Transform] Using formattedChannelName:', formattedChannelName);
  } else if (orderTypeGroup === 'I' && orderSource === 'O') {
    // ✅ Special case: Instore order type but Online source = MaghilHub order
    displayChannelName = 'MaghilHub';
    console.log('✅ [Transform] Detected MaghilHub order: orderTypeGroup=I, orderSource=O');
  } else if (orderTypeGroup === 'I') {
    // No channel/orderSourceName - Instore order - display "Instore"
    displayChannelName = 'Instore';
    console.log('⚠️ [Transform] No formattedChannelName, using Instore fallback for orderTypeGroup I');
  } else {
    // No channel/orderSourceName - use fallback logic based on orderTypeGroup and orderSource
    // This matches the logic in MHOrderTransactionCard's formattedOrderTypeName
    if (orderSource === 'O' && !formattedChannelName) {
      // Online order without explicit channel - could be MaghilHub
      // In online flow, MaghilHub orders have orderSourceName set, so if we reach here,
      // it means the orderSourceName wasn't preserved. For now, use fallback logic.
      if (orderTypeGroup === 'S') {
        displayChannelName = 'oDelivery';
      } else if (orderTypeGroup === 'P') {
        displayChannelName = 'oPickup';
      } else {
        // Default for online orders without channel
        displayChannelName = 'MaghilHub'; // ✅ Default to MaghilHub for online orders
      }
    } else if (orderTypeGroup === 'S') {
      // Delivery order
      if (orderSource === 'O') {
        displayChannelName = 'oDelivery';
      } else {
        displayChannelName = 'Delivery';
      }
    } else if (orderTypeGroup === 'P') {
      // Pickup order
      if (orderSource === 'I') {
        displayChannelName = 'Instore';
      } else if (orderSource === 'P') {
        displayChannelName = 'Phone';
      } else if (orderSource === 'O') {
        displayChannelName = 'oPickup';
      }
    } else if (orderTypeGroup === 'D') {
      // Dine In order
      displayChannelName = 'Dine In';
    }
  }

  console.log('📋 [Transform] Final channel result:', {
    formattedChannelName,
    displayChannelName,
    orderSource,
    orderTypeGroup,
    isOfflineOrder,
  });

  // Transform items - aggregate by itemId + options + comment (matching online flow)
  // Items with same itemId but different comments/options should be kept separate
  const itemsMap = new Map<string, {
    item: OffOrderItem;
    options: OffOrderItemOption[];
    totalQuantity: number;
    positiveQuantity: number; // ✅ Track total positive quantity
    negativeQuantity: number; // ✅ Track total negative quantity (absolute value)
    allItems: OffOrderItem[]; // ✅ Track all items for this itemId to find original
    negativeItems: OffOrderItem[]; // ✅ Track items with negative quantities (voided portions)
  }>();

  // First pass: group items by itemId + options + comment (matching online flow)
  for (const item of items) {
    const options = itemOptions.filter(opt => opt.orderItemId === item.id);
    
    // ✅ Create unique key based on itemId + options + comment (matching online flow)
    // This ensures items with same itemId but different comments/options are kept separate
    const optionsKey = options
      .map(opt => `${opt.modifierOptionId || ''}-${opt.quantity || 1}`)
      .sort()
      .join('|') || '';
    const commentKey = item.comment ? `-${item.comment}` : '';
    const key = `${item.itemId}-${optionsKey}${commentKey}`;
    
    if (itemsMap.has(key)) {
      // Aggregate: sum quantities (only if itemId, options, and comment match)
      const existing = itemsMap.get(key)!;
      existing.totalQuantity += item.quantity; // ✅ Sum quantities (positive adds, negative subtracts)
      existing.allItems.push(item); // ✅ Track all items
      
      // ✅ Track positive and negative quantities separately
      if (item.quantity > 0) {
        existing.positiveQuantity += item.quantity;
      } else if (item.quantity < 0) {
        existing.negativeQuantity += Math.abs(item.quantity); // Store as positive for cancelled items
        existing.negativeItems.push(item); // Track negative items for cancelled items
      }
      
      // Merge options (should already match since we're grouping by options)
      existing.options = [...existing.options, ...options];
    } else {
      // First occurrence
      const positiveQty = item.quantity > 0 ? item.quantity : 0;
      const negativeQty = item.quantity < 0 ? Math.abs(item.quantity) : 0;
      const negativeItems = item.quantity < 0 ? [item] : [];
      
      itemsMap.set(key, {
        item,
        options,
        totalQuantity: item.quantity,
        positiveQuantity: positiveQty,
        negativeQuantity: negativeQty,
        allItems: [item],
        negativeItems: negativeItems,
      });
    }
  }

  // ✅ Separate active items from refunded items
  const activeItems: OrderItem[] = [];
  const refundedItems: OrderItem[] = [];

  // Second pass: create OrderItem arrays from aggregated data
  Array.from(itemsMap.values()).forEach(({ item, options, totalQuantity, positiveQuantity, negativeQuantity, allItems, negativeItems }) => {
    // ✅ Find the original item (first positive quantity item, or first item if all are negative)
    // IMPORTANT: Use the item with the earliest createdTime to ensure we get the original item, not a voided one
    const positiveItems = allItems.filter(i => i.quantity > 0);
    const originalItem = positiveItems.length > 0
      ? positiveItems.sort((a, b) => {
          const timeA = a.createdTime?.getTime() || 0;
          const timeB = b.createdTime?.getTime() || 0;
          return timeA - timeB; // Earliest first
        })[0]
      : allItems[0];
    
    // ✅ Create active item if net quantity > 0
    if (totalQuantity > 0) {
      const activeItem: OrderItem = {
        id: originalItem.id,
        orderId: originalItem.orderId,
        itemId: originalItem.itemId,
        itemName: originalItem.itemName || '',
        cuisineId: '',
        itemAltName: '',
        quantity: totalQuantity.toString(), // ✅ Net quantity (remaining)
        price: (originalItem.price || 0).toString(),
        subTotal: ((originalItem.price || 0) * totalQuantity).toString(),
        customNote: null,
        comment: originalItem.comment || null,
        options: options.map(opt => ({
          id: opt.id,
          modifierOptionId: opt.modifierOptionId || '',
          optionName: opt.optionName || '',
          quantity: (opt.quantity || 1).toString(),
          price: (opt.price || 0).toString(),
        })),
        taxFees: null,
        itemModified: false,
        imageRequired: 0,
        discountFeeType: originalItem.discountFeeType || '',
        discountFeeRate: originalItem.discountFeeRate || 0,
        priceUnit: null,
        isWeightBased: null,
      } as OrderItem;
      activeItems.push(activeItem);
    }
    
    // ✅ Create cancelled item for voided portions (negative quantities)
    if (negativeQuantity > 0) {
      // Use the first negative item or original item for reference
      let voidedItemRef = negativeItems.length > 0 ? negativeItems[0] : originalItem;
      
      // ✅ Get cancel reason from the voided item (check all negative items for cancel reason)
      // Prefer the most recent voided item with a cancel reason
      let cancelReason: string | null = null;
      for (const negItem of negativeItems) {
        const itemCancelReason = (negItem as any).cancelReason;
        if (itemCancelReason) {
          cancelReason = itemCancelReason;
          // Use the most recent voided item with a reason as reference
          if (negItem.createdTime && (!voidedItemRef.createdTime || negItem.createdTime > voidedItemRef.createdTime)) {
            voidedItemRef = negItem;
          }
        }
      }
      
      const cancelledItem: OrderItem = {
        id: voidedItemRef.id + '_voided', // Unique ID for cancelled item
        orderId: voidedItemRef.orderId,
        itemId: voidedItemRef.itemId,
        itemName: voidedItemRef.itemName || '',
        cuisineId: '',
        itemAltName: '',
        quantity: negativeQuantity.toString(), // ✅ Voided quantity (the reduced portion)
        price: (voidedItemRef.price || 0).toString(),
        subTotal: ((voidedItemRef.price || 0) * negativeQuantity).toString(),
        customNote: null,
        comment: voidedItemRef.comment || null,
        cancelReason: cancelReason || null, // ✅ Set cancel reason
        options: options.map(opt => ({
          id: opt.id,
          modifierOptionId: opt.modifierOptionId || '',
          optionName: opt.optionName || '',
          quantity: (opt.quantity || 1).toString(),
          price: (opt.price || 0).toString(),
        })),
        taxFees: null,
        itemModified: false,
        imageRequired: 0,
        discountFeeType: voidedItemRef.discountFeeType || '',
        discountFeeRate: voidedItemRef.discountFeeRate || 0,
        priceUnit: null,
        isWeightBased: null,
      } as OrderItem;
      refundedItems.push(cancelledItem);
    } else if (totalQuantity <= 0) {
      // Completely voided item (no positive quantity, only negative or zero)
      // ✅ Get cancel reason from negative items
      let cancelReason: string | null = null;
      for (const negItem of negativeItems) {
        const itemCancelReason = (negItem as any).cancelReason;
        if (itemCancelReason) {
          cancelReason = itemCancelReason;
          break; // Use first found reason
        }
      }
      
      const voidedItem: OrderItem = {
        id: originalItem.id,
        orderId: originalItem.orderId,
        itemId: originalItem.itemId,
        itemName: originalItem.itemName || '',
        cuisineId: '',
        itemAltName: '',
        quantity: Math.abs(totalQuantity).toString(), // ✅ Use absolute value
        price: (originalItem.price || 0).toString(),
        subTotal: ((originalItem.price || 0) * Math.abs(totalQuantity)).toString(),
        customNote: null,
        comment: originalItem.comment || null,
        cancelReason: cancelReason || null, // ✅ Set cancel reason
        options: options.map(opt => ({
          id: opt.id,
          modifierOptionId: opt.modifierOptionId || '',
          optionName: opt.optionName || '',
          quantity: (opt.quantity || 1).toString(),
          price: (opt.price || 0).toString(),
        })),
        taxFees: null,
        itemModified: false,
        imageRequired: 0,
        discountFeeType: originalItem.discountFeeType || '',
        discountFeeRate: originalItem.discountFeeRate || 0,
        priceUnit: null,
        isWeightBased: null,
      } as OrderItem;
      refundedItems.push(voidedItem);
    }
  });

  // Use activeItems for orderItems
  const orderItems = activeItems;

  // Transform totals - Match CartTotal/OrderTotal interface
  console.log('💰 [Transform] Transforming totals...', {
    totalsCount: totals.length,
    totals: totals.map(t => ({ code: t.code, title: t.title, value: t.value })),
  });
  
  const orderTotals: OrderTotal[] = totals.map(total => {
    // Map code to title if title is missing (fallback)
    let title = total.title || '';
    if (!title) {
      // Fallback: map code to title based on ORDER_TOTAL_CODES
      const codeMap: Record<number, string> = {
        1: 'Item Total',
        2: 'Tax',
        3: 'Tip',
        4: 'Delivery Charges',
        5: 'Grand Total',
        6: 'Discount',
        7: 'Convenient Fees',
        8: 'Gratuity',
      };
      title = codeMap[total.code] || `Total ${total.code}`;
    }

    return {
      id: total.id,
      orderId: total.orderId,
      code: total.code.toString(), // ✅ Convert to string (component expects string)
      title: title, // ✅ Use title (component expects title, not name)
      value: (total.value || 0).toString(), // ✅ Convert to string (component expects string)
      sortOrder: (total.sortOrder || 0).toString(), // ✅ Convert to string (component expects string)
    } as OrderTotal;
  });
  
  console.log('✅ [Transform] Totals transformed:', {
    totalsCount: orderTotals.length,
    totals: orderTotals.map(t => ({ code: t.code, title: t.title, value: t.value })),
  });

  // Transform transactions
  const orderCreatedTime = order.createdTime 
    ? moment(order.createdTime).toISOString() 
    : new Date().toISOString();
  
  const orderTransactions: Transaction[] = transactions.map(t => {
    // ✅ Get transaction's own timestamp from WatermelonDB _raw.created_at
    // WatermelonDB automatically adds created_at to all models
    const transactionCreatedAt = (t as any)._raw?.created_at;
    const transactionUpdatedAt = (t as any)._raw?.updated_at;
    
    // Use transaction's own timestamp, fallback to order's createdTime
    const transactionCreatedTime = transactionCreatedAt 
      ? moment(transactionCreatedAt).toISOString()
      : orderCreatedTime;
    
    const transactionModifiedTime = transactionUpdatedAt 
      ? moment(transactionUpdatedAt).toISOString()
      : transactionCreatedTime; // Use created_at if updated_at not available
    
    return {
      id: t.id,
      orderId: t.orderId,
      locationId: t.locationId,
      paymentProviderId: t.paymentProviderId,
      message: t.message || '',
      transactionAmount: t.transactionAmount,
      request: t.request || '',
      response: '',
      statusCode: t.statusCode,
      authorizationCode: '',
      createdTime: transactionCreatedTime, // ✅ Use transaction's own timestamp
      modifiedTime: transactionModifiedTime, // ✅ Use transaction's own timestamp
      tenderType: t.tenderType,
      amountTendered: t.transactionAmount,
      staffId: undefined,
    };
  });

  // Get latest status (exclude ORDER_CREATED (6), ORDER_MODIFIED (7), and ITEM_CANCELED (81) as they are historical/item-level statuses)
  // The current status should be the latest status excluding these, matching online flow
  // Note: ITEM_CANCELED (81) should appear in activities but NOT in the main order status display
  const sortedStatuses = statuses.sort((a, b) => 
    (b.createdTime?.getTime() || 0) - (a.createdTime?.getTime() || 0)
  );
  
  // Filter out ORDER_CREATED (6), ORDER_MODIFIED (7), and ITEM_CANCELED (81) to get the actual current status
  // Status 81 (ITEM_CANCELED) should only appear in activities, not in order status
  const currentStatuses = sortedStatuses.filter(s => 
    s.status !== 6 && 
    s.status !== 7 && 
    s.status !== parseInt(ORDER_STATUS_CODES.ITEM_CANCELED, 10) // ✅ Exclude status 81 from order status
  );
  const latestStatus = currentStatuses[0] || sortedStatuses[0]; // Fallback to latest if no other statuses
  
  // Convert status number to formatted text
  const statusCodeString = latestStatus?.status.toString() || '';
  console.log('📊 [Transform] Order Status Debug:', {
    orderId: order.id,
    orderNo: order.orderNo,
    statusCode: latestStatus?.status,
    statusCodeString,
    orderTypeGroup,
    orderSource,
    allStatuses: statuses.map(s => ({ status: s.status, createdTime: s.createdTime })),
    filteredStatuses: currentStatuses.map(s => ({ status: s.status, createdTime: s.createdTime })),
  });
  const orderStatusText = getOrderCureentStatusText(statusCodeString) || statusCodeString;
  console.log('📊 [Transform] Status Text Result:', {
    statusCodeString,
    orderStatusText,
  });

  // Fetch staff names for activities
  // Collect all unique staffIds from statuses
  const uniqueStaffIds = [...new Set(statuses.map(s => s.updatedBy).filter(Boolean))];
  const staffNameMap: { [staffId: string]: string } = {};
  
  if (uniqueStaffIds.length > 0) {
    try {
      const staffCollection = database.collections.get<Staff>('mh_staff');
      
      // Fetch all staff records and filter manually (more reliable than querying by id)
      const allStaff = await staffCollection.query().fetch();
      
      console.log('👤 [Transform] Staff lookup - All staff in DB:', {
        totalStaffCount: allStaff.length,
        uniqueStaffIdsToFind: uniqueStaffIds,
        sampleStaff: allStaff.slice(0, 5).map(s => ({
          id: s.id,
          authUserId: s.authUserId,
          customId: s.customId,
          fullName: s.fullName,
        })),
      });
      
      // Create a set for faster lookup
      const staffIdSet = new Set(uniqueStaffIds);
      
      // Map staff by all possible identifiers
      for (const staff of allStaff) {
        // Map by database id (primary key)
        if (staff.id && staffIdSet.has(staff.id)) {
          staffNameMap[staff.id] = staff.fullName || '';
          console.log('✅ [Transform] Found staff by id:', { id: staff.id, name: staff.fullName });
        }
        
        // Map by auth_user_id
        if (staff.authUserId && staffIdSet.has(staff.authUserId)) {
          staffNameMap[staff.authUserId] = staff.fullName || '';
          console.log('✅ [Transform] Found staff by auth_user_id:', { authUserId: staff.authUserId, name: staff.fullName });
        }
        
        // Map by custom_id
        if (staff.customId && staffIdSet.has(staff.customId)) {
          staffNameMap[staff.customId] = staff.fullName || '';
          console.log('✅ [Transform] Found staff by custom_id:', { customId: staff.customId, name: staff.fullName });
        }
      }
      
      // Also try querying by indexed fields (auth_user_id, custom_id) for efficiency
      if (uniqueStaffIds.length > 0) {
        // Query by auth_user_id (indexed field)
        const staffByAuthUserId = await staffCollection
          .query(Q.where('auth_user_id', Q.oneOf(uniqueStaffIds)))
          .fetch();
        
        for (const staff of staffByAuthUserId) {
          if (staff.authUserId) {
            staffNameMap[staff.authUserId] = staff.fullName || '';
          }
          if (staff.id) {
            staffNameMap[staff.id] = staff.fullName || '';
          }
        }
        
        // Query by custom_id
        const staffByCustomId = await staffCollection
          .query(Q.where('custom_id', Q.oneOf(uniqueStaffIds)))
          .fetch();
        
        for (const staff of staffByCustomId) {
          if (staff.customId) {
            staffNameMap[staff.customId] = staff.fullName || '';
          }
          if (staff.id) {
            staffNameMap[staff.id] = staff.fullName || '';
          }
          if (staff.authUserId) {
            staffNameMap[staff.authUserId] = staff.fullName || '';
          }
        }
      }
      
      console.log('👤 [Transform] Staff name lookup result:', {
        uniqueStaffIds,
        staffNameMap,
        foundStaffCount: Object.keys(staffNameMap).length,
        missingStaffIds: uniqueStaffIds.filter(id => !staffNameMap[id]),
      });
    } catch (error) {
      console.warn('⚠️ [Transform] Error fetching staff names:', error);
    }
  }

  // Transform statuses to activities (include all statuses including ORDER_CREATED)
  // Sort in reverse chronological order (newest first) to match online flow
  // In online flow: "Order Accepted" appears first, then "Order Created" below
  const orderActivities = statuses
    .sort((a, b) => {
      const timeA = a.createdTime?.getTime() || 0;
      const timeB = b.createdTime?.getTime() || 0;
      // First sort by time (newest first - reverse chronological)
      if (timeA !== timeB) {
        return timeB - timeA; // ✅ Reverse: newest first
      }
      // If times are equal, sort by status code in reverse (ACCEPTED=11 comes before ORDER_CREATED=6)
      return b.status - a.status; // ✅ Reverse: higher status code first
    })
    .map((status, index) => {
      // Ensure status.status is a valid number before converting to string
      const statusCode = status.status?.toString() || '0';
      const { ORDER_STATUS_CODES } = require('../../features/common/constants');
      
      // ✅ Map cancelled order statuses to "Order Cancelled"
      let activityName: string;
      if (status.status === parseInt(ORDER_STATUS_CODES.ORDER_CANCELLED_CUSTOMER, 10) ||
          status.status === parseInt(ORDER_STATUS_CODES.ORDER_CANCELLED_MERCHANT, 10)) {
        activityName = 'Order Cancelled';
      } else if (status.status === parseInt(ORDER_STATUS_CODES.ITEM_CANCELED, 10)) {
        // ✅ Map status 81 (ITEM_CANCELED) to "Item Cancelled" (matching online flow)
        activityName = 'Item Cancelled';
      } else {
        // Use getOrderCureentStatusText first (returns "Accepted" for status 11, matching online flow)
        // Fallback to getOrderLabelText for statuses not handled by getOrderCureentStatusText (like ORDER_CREATED)
        activityName = getOrderCureentStatusText(statusCode) 
          || getOrderLabelText(statusCode) 
          || `Status ${statusCode}`;
      }
      
      // Get staff name from map
      const staffId = status.updatedBy || '';
      const staffName = staffId ? (staffNameMap[staffId] || null) : null;
      
      // ✅ For status 81 (ITEM_CANCELED), find voided items created at the same time
      // Match items by comparing createdTime (within 2 seconds window)
      let activityItems: any[] = [];
      if (status.status === parseInt(ORDER_STATUS_CODES.ITEM_CANCELED, 10) && status.createdTime) {
        const statusTime = status.createdTime.getTime();
        const timeWindow = 2000; // 2 seconds window
        
        // Find voided items (negative quantity) with cancelReason created around the same time
        const voidedItems = items.filter(item => {
          if (item.quantity >= 0 || !item.cancelReason) return false; // Only negative quantities with cancel reason
          
          const itemTime = item.createdTime?.getTime() || 0;
          const timeDiff = Math.abs(itemTime - statusTime);
          
          // Match items created within 2 seconds of the status
          return timeDiff <= timeWindow;
        });
        
        // Transform voided items to activity items format
        activityItems = voidedItems.map(item => {
          // Get item options for this item
          const itemOpts = itemOptions.filter(opt => opt.orderItemId === item.id);
          
          return {
            id: item.id,
            itemId: item.itemId,
            itemName: item.itemName || '',
            quantity: Math.abs(item.quantity).toString(), // Use absolute value for display
            price: (item.price || 0).toString(),
            priceUnit: null, // Can be populated if available
            options: itemOpts.map(opt => ({
              id: opt.id,
              optionName: opt.optionName || '',
              quantity: (opt.quantity || 1).toString(),
              price: (opt.price || 0).toString(),
            })),
          };
        });
      }
      
      // Ensure all values are strings, never null/undefined
      return {
        id: status.id || `activity-${index}`,
        entityId: order.id || '',
        entityName: 'Order',
        activityName: activityName || '', // ✅ Ensure it's always a string
        status: statusCode, // ✅ Already a string
        items: activityItems, // ✅ Populate items for Item Cancelled activities
        staffId: staffId,
        staffName: staffName, // ✅ Staff name from database lookup
        remarks: '',
        createdTime: status.createdTime ? moment(status.createdTime).format('MMM DD, YYYY hh:mm A') : '', // ✅ Ensure it's always a string
        sortedTime: status.createdTime ? status.createdTime.toISOString() : '', // ✅ Ensure it's always a string
      };
    });

  // Calculate payment status (matching online flow)
  const paidTransactions = transactions.filter(t => 
    t.statusCode === '19' || // PAYMENT_COMPLETED (online payment)
    t.statusCode === '24'    // PAYMENT_AT_LOCATION
    // Note: '25' (PAYMENT_AT_LOCATION_INITIATED) is NOT considered paid - payment is only initiated, not completed
  );
  // Calculate total paid amount (sum of all successful payment transactions)
  const totalPaidAmount = paidTransactions.reduce((sum, t) => sum + (t.transactionAmount || 0), 0);
  
  // Calculate order total from totals (code 5 is usually grand total)
  const orderTotal = totals.find(t => t.code === 5)?.value || 
                     totals.reduce((sum, t) => sum + (t.value || 0), 0);
  
  // Order is paid when total paid amount equals or exceeds order total
  const isPaid = totalPaidAmount >= orderTotal && totalPaidAmount > 0;

  // Determine paymentStatus from latest transaction (required by OrderDetail interface)
  let paymentStatus: PaymentStatus;
  if (transactions.length > 0) {
    const latestTransaction = transactions[transactions.length - 1];
    paymentStatus = {
      id: latestTransaction.id,
      locationId: latestTransaction.locationId,
      paymentProviderId: latestTransaction.paymentProviderId,
      orderId: latestTransaction.orderId,
      message: latestTransaction.message,
      request: latestTransaction.request || '',
      response: '',
      statusCode: latestTransaction.statusCode,
      authorizationCode: '',
      transactionAmount: latestTransaction.transactionAmount,
      amountTendered: latestTransaction.transactionAmount,
      tenderType: latestTransaction.tenderType,
      cardType: latestTransaction.cardType || '',
      cardInfo: latestTransaction.cardLast4 || '',
      transactionType: latestTransaction.transactionType || '',
      createdTime: order.createdTime ? moment(order.createdTime).toISOString() : new Date().toISOString(),
      modifiedTime: order.eventTime ? moment(order.eventTime).toISOString() : new Date().toISOString(),
    };
  } else {
    // Default PaymentStatus object when no transactions exist
    paymentStatus = {
      id: '',
      locationId: order.locationId,
      paymentProviderId: '',
      orderId: order.id,
      message: '',
      request: '',
      response: '',
      statusCode: '0',
      authorizationCode: '',
      transactionAmount: 0,
      amountTendered: 0,
      tenderType: '',
      cardType: '',
      cardInfo: '',
      transactionType: '',
      createdTime: order.createdTime ? moment(order.createdTime).toISOString() : new Date().toISOString(),
      modifiedTime: order.eventTime ? moment(order.eventTime).toISOString() : new Date().toISOString(),
    };
  }

  // ✅ Add toString method to paymentStatus object for UI display
  // The UI calls paymentStatus.toString() expecting "PAID", "UNPAID", or "CANCELLED"
  // Check if order is cancelled (matching online flow)
  const isOrderCancelled = latestStatus?.status && (
    latestStatus.status.toString() === ORDER_STATUS_CODES.ORDER_CANCELLED_CUSTOMER ||
    latestStatus.status.toString() === ORDER_STATUS_CODES.ORDER_CANCELLED_MERCHANT
  );
  
  (paymentStatus as any).toString = function() {
    if (isOrderCancelled) {
      return 'CANCELLED';
    }
    return isPaid ? 'PAID' : 'UNPAID';
  };

  // Format dates
  let orderDate = formatDateToString(order.orderDate) || '';//moment(order.orderDate).format('YYYY-MM-DD');
  let orderTime = formatDateToISO(order.orderTime) || '';
  
  if(isV2){
    orderDate = moment(order.orderDate).format('YYYY-MM-DD');
    orderTime = (order.orderDate && order.orderTime) 
    ? moment(`${moment(order.orderDate).format('YYYY-MM-DD')} ${moment(order.orderTime).format('HH:mm:ss')}`, 'YYYY-MM-DD HH:mm:ss')
        .format('MMM DD, YYYY - hh:mm A')
    : '';
  }
  // ✅ requestedTime should be the customer's requested pickup/delivery time, not createdTime
  // For delivery orders: use etaDate + etaTime
  // For pickup orders: use pickupDate + pickupTime
  // Format as "Nov 27, 2025 - 05:24 AM" to match orderTime format
  let requestedTime = '';
  if (orderTypeGroup === 'S' && order.etaDate && order.etaTime) {
    // Delivery order - use ETA as requested time
    requestedTime = moment(`${moment(order.etaDate).format('YYYY-MM-DD')} ${moment(order.etaTime).format('HH:mm:ss')}`, 'YYYY-MM-DD HH:mm:ss')
      .format('MMM DD, YYYY - hh:mm A');
  } else if ((orderTypeGroup === 'P' || orderTypeGroup === 'I') && order.pickupDate && order.pickupTime) {
    // Pickup order - use pickup time as requested time
    requestedTime = moment(`${moment(order.pickupDate).format('YYYY-MM-DD')} ${moment(order.pickupTime).format('HH:mm:ss')}`, 'YYYY-MM-DD HH:mm:ss')
      .format('MMM DD, YYYY - hh:mm A');
  } else if (orderTypeGroup === 'D' && order.pickupDate && order.pickupTime) {
    // Dine-in order - use pickup time as requested time
    requestedTime = moment(`${moment(order.pickupDate).format('YYYY-MM-DD')} ${moment(order.pickupTime).format('HH:mm:ss')}`, 'YYYY-MM-DD HH:mm:ss')
      .format('MMM DD, YYYY - hh:mm A');
  }
  // If no requested time available, leave as empty string

  const etaTime = () => {
    if (!order.etaTime) return '';
    if(isV2){
      return moment(order.etaTime).format('HH:mm:ss');
    }
    return formatDateToISO(order.etaTime) || '';
  };
  
  const etaDate = () => {
    if (!order.etaDate) return '';
    if(isV2){
      return moment(order.etaDate).format('YYYY-MM-DD');
    }
    return formatDateToString(order.etaDate) || '';
  };

  const pickUpTime = () => {
    if (!order.pickupTime) return '';
    if(isV2){
      return moment(order.pickupTime).format('HH:mm:ss');
    }
    return formatDateToISO(order.pickupTime) || '';
  };

  const pickUpDate = () => {
    if (!order.pickupDate) return '';
    if(isV2){
      return moment(order.pickupDate).format('YYYY-MM-DD');
    }
    return formatDateToString(order.pickupDate) || '';
  };

  // Build OrderDetail object
  const orderDetail: OrderDetail = {
    // Order fields
    id: order.id,
    orderId: order.id,
    orderNo: order.orderNo,
    locationId: order.locationId,
    customerId: order.customerId || '',
    fullName: order.customerFullname || sourceDetail?.customerName || '',
    phone: order.customerPhoneNumber || sourceDetail?.customerMobile || '',
    email: order.customerEmail || sourceDetail?.customerEmail || '',
    orderTypeId: order.orderTypeId,
    orderTypeGroup: orderTypeGroup,
    // ✅ Fix: orderSourceName should be string, not null - use empty string if displayChannelName is null
    orderSourceName: displayChannelName || undefined, // Use undefined instead of null to match online flow
    orderSource: orderSource || sourceDetail?.orderSource || undefined, // Set orderSource correctly
    orderDate,
    orderTime,
    requestedTime,
    orderTotal: totals.find(t => t.code === 5)?.value || totals.reduce((sum, t) => sum + (t.value || 0), 0),
    status: statusCodeString, // Status code as string
    statusId: statusCodeString, // Status code as string
    orderStatus: orderStatusText, // ✅ Add this - formatted status text for display
    nextStatus: getNextStatus(latestStatus?.status || 0, orderSource || '', orderTypeGroup), // ✅ Calculate next status for action button
    comment: order.comment || '',
    sortOrder: null, // ✅ Add this - required for component to find the order
    
    // ✅ Add missing Order interface properties
    deliveryTime: order.etaTime ? moment(order.etaTime).format('HH:mm:ss') : '', // ✅ Add this
    deliveryDate: order.etaDate ? moment(order.etaDate).format('YYYY-MM-DD') : '', // ✅ Add this
    tableName: sourceDetail?.tableName 
      ? (Array.isArray(sourceDetail.tableName) ? sourceDetail.tableName.join(', ') : sourceDetail.tableName)
      : null, // ✅ Add this
    
    // OrderDetail specific fields
    items: orderItems, // ✅ Active items only
    totals: orderTotals,
    transactions: orderTransactions,
    // ✅ Filter transactionsToShow: exclude statusCode '25' (PAYMENT_AT_LOCATION_INITIATED) only
    // Note: Status '26' (REFUND_SUCCESS) should be displayed in transaction list
    transactionsToShow: orderTransactions.filter(t => t.statusCode !== '25'),
    paymentStatus: paymentStatus, // ✅ Fix: Use PaymentStatus object instead of string
    activeValets: [],
    deliveryStaffDetails: [],
    businessDetails: {} as any,
    isOrderCancelled: false,
    refundedItems: refundedItems, // ✅ Add refunded items here (instead of empty array)
    refundedAmount: null,
    discount: parseFloat(sourceDetail?.discountAmount || '0'),
    discountType: sourceDetail?.discountType || '',
    isTaxRemoved: order.isTaxRemoved || 0,
    // ✅ For offline orders, ensure isPayByLinkOrder is false in sourceDetail before stringifying
    // This ensures the UI component doesn't show the link icon when parsing orderSourceDetail JSON
    orderSourceDetail: (() => {
      if (!sourceDetail) return null;
      const sourceDetailForJSON = { ...sourceDetail };
      // Always set isPayByLinkOrder to false for offline orders
      if (isOfflineOrder || !sourceDetailForJSON.isPayByLinkOrder) {
        sourceDetailForJSON.isPayByLinkOrder = false;
      }
      return JSON.stringify(sourceDetailForJSON);
    })(), // ✅ Stringify to match online flow format
    channel: displayChannelName || '',
    sourceDetail: sourceDetail,
    // ✅ For offline orders, always set payByLinkOrder to '0' (no link icon)
    // Offline orders are paid with cash, card, or pay at store - not through pay by link
    payByLinkOrder: '0',
    unrealizedOrder: sourceDetail?.unrealizedOrder ? '1' : '0',
    unrealizedComment: sourceDetail?.unrealizedComment || '',
    orderActivities: orderActivities,
    // ✅ Build orderStatusAndTags for offline orders to enable "long press to view options"
    orderStatusAndTags: buildOrderStatusAndTags(
      latestStatus?.status || 0,
      orderSource || '',
      orderTypeGroup,
      isPaid
    ),
    // ✅ Add missing OrderDetail property
    orderSummaryItems: [], // ✅ Add this - empty array for offline orders (can be populated if needed)
    
    // Add other required fields with defaults
    paymentType: null,
    isPaymentDone: isPaid,
    tableId: sourceDetail?.tableId || null,
    isTransactionCompleted: isPaid,
    
    // Add other Order interface required fields
    deviceId: order.deviceId || '',
    staffId: order.staffId || '',
    totalItems: orderItems.length.toString(),
    pendingAmount: 0,
    address: null,
    deliveryStaffId: '',
    addressLine1: '',
    addressLine2: '',
    addressLine3: '',
    etaTime: etaTime() || '',
    etaDate: etaDate() || '',
    pickUpTime: pickUpTime() || '',
    pickUpDate: pickUpDate() || '',
    // etaTime: order.etaTime ? moment(order.etaTime).format('HH:mm:ss') : null,
    // etaDate: order.etaDate ? moment(order.etaDate).format('YYYY-MM-DD') : null,
    // pickUpTime: order.pickupTime ? moment(order.pickupTime).format('HH:mm:ss') : '',
    // pickUpDate: order.pickupDate ? moment(order.pickupDate).format('YYYY-MM-DD') : '',
    // ✅ Remove duplicate orderSource - it's already set on line 2383
  };

  console.log('✅ [Transform] OrderDetail created:', {
    orderId: orderDetail.orderId,
    orderNo: orderDetail.orderNo,
    sortOrder: orderDetail.sortOrder,
    itemsCount: orderDetail.items?.length,
    totalsCount: orderDetail.totals?.length,
    hasOrderSourceName: !!orderDetail.orderSourceName,
    orderSourceName: orderDetail.orderSourceName,
    orderSource: orderDetail.orderSource,
  });

  return orderDetail;
}

/**
 * Update order status offline - saves new status to WatermelonDB
 */
export async function updateOrderStatusOffline(
  orderId: string,
  status: string,
  staffId: string
): Promise<void> {
  return await database.write(async () => {
    const statusesCollection = database.collections.get<OffOrderStatus>(DB_NAMES.OFFLINE_ORDER_STATUS);
    const now = new Date();
    
    // Create new status record
    await statusesCollection.create(record => {
      record.orderId = orderId;
      record.status = parseInt(status, 10);
      record.eventTime = now;
      record.createdTime = now;
      record.updatedBy = staffId || '';
      record.syncedAt = null; // Mark as unsynced
    });
    
    console.log('✅ [WatermelonDB] Order status updated offline:', {
      orderId,
      status,
      staffId,
    });
  });
}

/**
 * Update order customer info offline - saves to WatermelonDB
 * Updates customer_fullname, customer_phone_number, and customer_email in mh_off_orders table
 */
export async function updateOrderCustomerInfoOffline(
  orderId: string,
  customerInfo: {
    customerFullname?: string | null;
    customerPhoneNumber?: string | null;
    customerEmail?: string | null;
  }
): Promise<void> {
  return await database.write(async () => {
    console.log('📦 [WatermelonDB] Updating order customer info offline:', { orderId, customerInfo });
    
    const ordersCollection = database.collections.get<OffOrder>(DB_NAMES.OFFLINE_ORDERS);
    
    // Fetch existing order
    const orders = await ordersCollection
      .query(Q.where('id', orderId))
      .fetch();
    
    if (orders.length === 0) {
      console.log('❌ [WatermelonDB] Order not found for customer info update:', orderId);
      return;
    }

    const order = orders[0];

    // Update customer info fields
    await order.update(record => {
      if (customerInfo.customerFullname !== undefined) {
        record.customerFullname = customerInfo.customerFullname || null;
      }
      if (customerInfo.customerPhoneNumber !== undefined) {
        record.customerPhoneNumber = customerInfo.customerPhoneNumber || null;
      }
      if (customerInfo.customerEmail !== undefined) {
        record.customerEmail = customerInfo.customerEmail || null;
      }
    });
    
    console.log('✅ [WatermelonDB] Order customer info updated offline:', {
      orderId,
      customerFullname: customerInfo.customerFullname,
      customerPhoneNumber: customerInfo.customerPhoneNumber,
      customerEmail: customerInfo.customerEmail,
    });
  });
}

/**
 * Update order delay time offline - saves to WatermelonDB
 * Adds delay minutes to ETA or pickup time based on order type
 * - Delivery orders (S): updates etaDate and etaTime
 * - Pickup/Dine-in orders (P, I, D): updates pickupDate and pickupTime
 */
export async function updateOrderDelayTimeOffline(
  orderId: string,
  delayMinutes: number
): Promise<void> {
  return await database.write(async () => {
    console.log('📦 [WatermelonDB] Updating order delay time offline:', { orderId, delayMinutes });
    
    const ordersCollection = database.collections.get<OffOrder>(DB_NAMES.OFFLINE_ORDERS);
    
    // Fetch existing order
    const orders = await ordersCollection
      .query(Q.where('id', orderId))
      .fetch();
    
    if (orders.length === 0) {
      console.log('❌ [WatermelonDB] Order not found for delay time update:', orderId);
      return;
    }

    const order = orders[0];
    const sourceDetail = order.getOrderSourceDetail();
    
    // Determine order type group from order_source_detail or order_type_id
    const restaurantOrderTypes = (getState() as any)?.restaurant?.currentRestaurantDetail?.orderTypes as OrderType[] | undefined;
    const orderType = restaurantOrderTypes?.find(ot => ot.id === order.orderTypeId);
    const orderTypeGroup = orderType?.typeGroup || sourceDetail?.orderTypeGroup || 'I';

    await order.update(record => {
      if (orderTypeGroup === 'S') {
        // Delivery order - update ETA
        if (record.etaDate && record.etaTime) {
          const currentEta = moment(record.etaDate).set({
            hour: moment(record.etaTime).hour(),
            minute: moment(record.etaTime).minute(),
            second: moment(record.etaTime).second(),
          });
          // ✅ Add delay to current ETA (delayMinutes is already calculated as the difference from original)
          const newEta = moment(currentEta).add(delayMinutes, 'minutes');
          record.etaDate = newEta.toDate();
          record.etaTime = newEta.toDate();
          
          console.log('📅 [Delay Update] ETA updated:', {
            currentEta: currentEta.format('MMM DD, YYYY hh:mm A'),
            delayMinutes,
            newEta: newEta.format('MMM DD, YYYY hh:mm A'),
          });
        } else {
          // If no ETA exists, set it to now + delay
          const newEta = moment().add(delayMinutes, 'minutes');
          record.etaDate = newEta.toDate();
          record.etaTime = newEta.toDate();
        }
      } else {
        // Pickup or Dine-in order - update pickup time
        if (record.pickupDate && record.pickupTime) {
          const currentPickup = moment(record.pickupDate).set({
            hour: moment(record.pickupTime).hour(),
            minute: moment(record.pickupTime).minute(),
            second: moment(record.pickupTime).second(),
          });
          // ✅ Add delay to current pickup time (delayMinutes is already calculated as the difference from original)
          const newPickup = moment(currentPickup).add(delayMinutes, 'minutes');
          record.pickupDate = newPickup.toDate();
          record.pickupTime = newPickup.toDate();
          
          console.log('📅 [Delay Update] Pickup time updated:', {
            currentPickup: currentPickup.format('MMM DD, YYYY hh:mm A'),
            delayMinutes,
            newPickup: newPickup.format('MMM DD, YYYY hh:mm A'),
          });
        } else {
          // If no pickup time exists, set it to now + delay
          const newPickup = moment().add(delayMinutes, 'minutes');
          record.pickupDate = newPickup.toDate();
          record.pickupTime = newPickup.toDate();
        }
      }
    });
    
    console.log('✅ [WatermelonDB] Order delay time updated offline:', {
      orderId,
      delayMinutes,
      orderTypeGroup,
    });
  });
}

/**
 * Update order discount offline - saves to WatermelonDB
 * Updates discount in order_source_detail and recalculates totals
 */
export async function updateOrderDiscountOffline(
  orderId: string,
  discountInfo: {
    discountAmount: string; // Can be percentage or flat amount
    discountType: string; // 'PERCENT' or 'FLATFEE'
    offerReason?: string;
    offerId?: string;
    staffId: string;
  }
): Promise<CartTotal[]> {
  return await database.write(async () => {
    console.log('📦 [WatermelonDB] Updating order discount offline:', { orderId, discountInfo });
    
    const ordersCollection = database.collections.get<OffOrder>(DB_NAMES.OFFLINE_ORDERS);
    const totalsCollection = database.collections.get<OffOrderTotal>(DB_NAMES.OFFLINE_ORDER_TOTALS);
    const itemsCollection = database.collections.get<OffOrderItem>(DB_NAMES.OFFLINE_ORDER_ITEMS);
    
    // Fetch existing order
    const orders = await ordersCollection
      .query(Q.where('id', orderId))
      .fetch();
    
    if (orders.length === 0) {
      console.log('❌ [WatermelonDB] Order not found for discount update:', orderId);
      return [];
    }

    const order = orders[0];
    const sourceDetail = order.getOrderSourceDetail();
    const now = new Date();
    
    // Fetch existing items and totals
    const items = await itemsCollection
      .query(Q.where('order_id', orderId))
      .fetch();
    
    const existingTotals = await totalsCollection
      .query(Q.where('order_id', orderId))
      .fetch();
    
    // Calculate item subtotal (price * quantity for each item)
    const itemSubTotal = items.reduce((sum, item) => {
      const price = item.price || 0;
      const quantity = item.quantity || 0;
      return sum + (price * quantity);
    }, 0);
    
    // Calculate discount amount
    let discountValue = 0;
    console.log('🔍 [Discount Update] Calculating discount:', {
      discountType: discountInfo.discountType,
      discountAmount: discountInfo.discountAmount,
      discountAmountType: typeof discountInfo.discountAmount,
      itemSubTotal
    });

    if (discountInfo.discountType === 'FLATFEE') {
      discountValue = parseFloat(discountInfo.discountAmount || '0');
      console.log('💰 [Discount Update] FLATFEE discount value:', discountValue, 'from input:', discountInfo.discountAmount);
    } else if (discountInfo.discountType === 'PERCENT') {
      const percentage = parseFloat(discountInfo.discountAmount || '0');
      discountValue = (itemSubTotal * percentage) / 100;
      console.log('💰 [Discount Update] PERCENT discount value:', discountValue, 'from percentage:', percentage);
    }
    
    console.log('✅ [Discount Update] Final discountValue:', discountValue);
    
    // Get existing tax total
    const existingTax = existingTotals.find(t => t.code === 2);
    const taxAmount = existingTax ? parseFloat(existingTax.value.toString()) : 0;
    
    // Get existing tip
    const existingTip = existingTotals.find(t => t.code === 3);
    const tipAmount = existingTip ? parseFloat(existingTip.value.toString()) : 0;
    
    // Calculate grand total: itemTotal + tax + tip - discount
    const grandTotal = itemSubTotal + taxAmount + tipAmount - discountValue;
    
    // Update order_source_detail with discount info
    await order.update(record => {
      const updatedSourceDetail = { ...sourceDetail };
      updatedSourceDetail.discountAmount = discountInfo.discountAmount;
      updatedSourceDetail.discountType = discountInfo.discountType;
      if (discountInfo.offerReason) {
        updatedSourceDetail.discountRemark = discountInfo.offerReason;
      }
      if (discountInfo.offerId) {
        updatedSourceDetail.offerId = discountInfo.offerId;
      }
      record.orderSourceDetail = JSON.stringify(updatedSourceDetail);
    });
    
    // Find and update existing discount total (code 6) for this orderId
    // Handle both integer 6 and float 6.0
    console.log('🔍 [Discount Update] Searching for discount total:', {
      orderId,
      existingTotalsCount: existingTotals.length,
      existingTotalsCodes: existingTotals.map(t => ({ code: t.code, value: t.value }))
    });
    
    const existingDiscountTotal = existingTotals.find(t => t.code === 6 || t.code === 6.0);
    
    console.log('🔍 [Discount Update] Found discount total:', {
      found: !!existingDiscountTotal,
      existingValue: existingDiscountTotal?.value,
      existingCode: existingDiscountTotal?.code,
      newValue: discountValue
    });
    
    if (existingDiscountTotal) {
      // Update existing discount total
      const oldValue = existingDiscountTotal.value;
      await existingDiscountTotal.update(record => {
        record.value = discountValue;
        record.updatedTime = now;
        record.syncedAt = null; // Mark as unsynced
      });
      console.log('✅ [WatermelonDB] Updated existing discount total (code 6):', {
        orderId,
        oldValue: oldValue,
        newValue: discountValue,
        discountTotalId: existingDiscountTotal.id
      });
    } else {
      // Create new discount total if it doesn't exist
      await totalsCollection.create(record => {
        record.orderId = orderId;
        record.code = 6;
        record.title = 'Discount';
        record.value = discountValue;
        record.sortOrder = 6;
        record.createdTime = now;
        record.syncedAt = null;
      });
      console.log('✅ [WatermelonDB] Created new discount total (code 6):', {
        orderId,
        value: discountValue
      });
    }
    
    // Update grand total (code 5) since discount affects it
    const existingGrandTotal = existingTotals.find(t => t.code === 5 || t.code === 5.0);
    if (existingGrandTotal) {
      const oldGrandTotal = existingGrandTotal.value;
      await existingGrandTotal.update(record => {
        record.value = grandTotal;
        record.updatedTime = now;
        record.syncedAt = null; // Mark as unsynced
      });
      console.log('✅ [WatermelonDB] Updated grand total (code 5):', {
        orderId,
        oldValue: oldGrandTotal,
        newValue: grandTotal
      });
    } else {
      // Create grand total if it doesn't exist
      await totalsCollection.create(record => {
        record.orderId = orderId;
        record.code = 5;
        record.title = 'Grand Total';
        record.value = grandTotal;
        record.sortOrder = 5;
        record.createdTime = now;
        record.syncedAt = null;
      });
    }
    
    // Build return array with updated totals (for compatibility)
    const updatedTotals: CartTotal[] = [];
    
    // Get all totals after update
    const allUpdatedTotals = await totalsCollection
      .query(Q.where('order_id', orderId))
      .fetch();
    
    // Convert to CartTotal format
    for (const total of allUpdatedTotals) {
      updatedTotals.push({
        code: total.code.toString(),
        title: total.title || '',
        value: total.value.toString(),
        sortOrder: total.sortOrder?.toString() || '0'
      });
    }
    
    console.log('✅ [WatermelonDB] Order discount updated offline:', {
      orderId,
      discountValue,
      discountType: discountInfo.discountType,
      grandTotal,
      updatedDiscountTotal: existingDiscountTotal ? 'updated' : 'created'
    });
    
    return updatedTotals;
  });
}

/**
 * Update order with new items offline - saves to WatermelonDB
 */
export async function updateOrderWithItemsOffline(
  orderId: string,
  cartData: any, // EditOrderRequestCart
  deviceId: string,
  staffId: string
): Promise<OrderDetail | null> {
  return await database.write(async () => {
    console.log('📦 [WatermelonDB] Updating order with new items offline:', { orderId });
    
    const ordersCollection = database.collections.get<OffOrder>(DB_NAMES.OFFLINE_ORDERS);
    const itemsCollection = database.collections.get<OffOrderItem>(DB_NAMES.OFFLINE_ORDER_ITEMS);
    const itemOptionsCollection = database.collections.get<OffOrderItemOption>(DB_NAMES.OFFLINE_ORDER_ITEM_OPTIONS);
    const totalsCollection = database.collections.get<OffOrderTotal>(DB_NAMES.OFFLINE_ORDER_TOTALS);
    const statusesCollection = database.collections.get<OffOrderStatus>(DB_NAMES.OFFLINE_ORDER_STATUS);
    const transactionsCollection = database.collections.get<OffTransaction>(DB_NAMES.OFFLINE_TRANSACTIONS);

    // Fetch existing order
    const orders = await ordersCollection
      .query(Q.where('id', orderId))
      .fetch();
    
    if (orders.length === 0) {
      console.log('❌ [WatermelonDB] Order not found for update:', orderId);
      return null;
    }

    const order = orders[0];
    const now = new Date();

    // Update order metadata if provided
    if (cartData.comment !== undefined) {
      await order.update(record => {
        record.comment = cartData.comment || null;
      });
    }
    if (cartData.customNote !== undefined) {
      await order.update(record => {
        record.customNote = cartData.customNote || null;
      });
    }
    if (cartData.phone !== undefined) {
      await order.update(record => {
        record.phone = cartData.phone || '';
      });
    }
    if (cartData.fullName !== undefined) {
      await order.update(record => {
        record.fullName = cartData.fullName || '';
      });
    }
    if (cartData.email !== undefined) {
      await order.update(record => {
        record.email = cartData.email || '';
      });
    }
    if (cartData.discount !== undefined) {
      await order.update(record => {
        record.discount = cartData.discount || '0';
      });
    }
    if (cartData.discountType !== undefined) {
      await order.update(record => {
        record.discountType = cartData.discountType || '';
      });
    }
    if (cartData.isTaxRemoved !== undefined) {
      await order.update(record => {
        record.isTaxRemoved = cartData.isTaxRemoved || 0;
      });
    }

    // Handle items - create new rows with change quantities instead of full quantities
    if (cartData.items && cartData.items.length > 0) {
      // Get existing items first
      const existingItems = await itemsCollection
        .query(Q.where('order_id', orderId))
        .fetch();

      for (const item of cartData.items) {
        // Check if this item already exists in the order
        const existingItem = existingItems.find(
          (ei) => ei.itemId === (item.itemId || item.id) && 
                   (item.id ? ei.id === item.id : true) // Match by order item ID if provided
        );

        if (existingItem) {
          // Item exists - calculate quantity change
          const originalQuantity = existingItem.quantity; // Original quantity from DB
          const newQuantity = item.quantity ? parseFloat(item.quantity.toString()) : originalQuantity;
          const quantityChange = newQuantity - originalQuantity; // Will be +1 for adding, -1 for reducing

          // Only create new row if there's a quantity change
          if (quantityChange !== 0) {
            // Create a NEW row with the change quantity (positive for adding, negative for reducing)
            const changeItem = await itemsCollection.create(record => {
              record.orderId = orderId;
              record.itemId = existingItem.itemId; // Same itemId as original
              record.deviceId = deviceId;
              record.staffId = staffId;
              record.itemName = existingItem.itemName || item.itemName || null;
              record.price = existingItem.price || (item.price ? parseFloat(item.price.toString()) : null);
              record.discountFeeType = existingItem.discountFeeType || item.discountFeeType || 'PERCENT';
              record.discountFeeRate = existingItem.discountFeeRate || item.discountFeeRate || 0;
              record.quantity = quantityChange; // ✅ Store change quantity (e.g., +1.0 for adding 1, -1.0 for reducing 1)
              record.comment = item.comment !== undefined ? (item.comment || null) : existingItem.comment;
              record.eventTime = now;
              record.createdTime = now;
              record.syncedAt = null; // Mark as unsynced
            });

            const actualChangeItemId = changeItem._raw.id;

            // Copy options from original item if needed, or use new item options
            const optionsToUse = item.options && item.options.length > 0 
              ? item.options 
              : await itemOptionsCollection
                  .query(Q.where('order_item_id', existingItem.id))
                  .fetch()
                  .then(opts => opts.map(opt => ({
                    modifierOptionId: opt.modifierOptionId || '',
                    optionName: opt.optionName || null,
                    quantity: opt.quantity || 1,
                    price: opt.price || 0,
                    sortOrder: opt.sortOrder || 0,
                  })));

            // Create options for the change item
            if (optionsToUse && optionsToUse.length > 0) {
              for (const option of optionsToUse) {
                await itemOptionsCollection.create(record => {
                  record.orderItemId = actualChangeItemId;
                  record.orderId = orderId;
                  record.modifierOptionId = option.modifierOptionId || option.id || '';
                  record.optionName = option.optionName || option.name || null;
                  record.quantity = option.quantity ? parseFloat(option.quantity.toString()) : 1;
                  record.price = option.price ? parseFloat(option.price.toString()) : 0;
                  record.sortOrder = option.sortOrder || 0;
                  record.eventTime = now;
                  record.createdTime = now;
                  record.syncedAt = null;
                });
              }
            }

            console.log('📝 [WatermelonDB] Created change row for edited item:', {
              itemId: existingItem.itemId,
              originalQuantity,
              newQuantity,
              changeQuantity: quantityChange,
            });
          }
          
          // ✅ DO NOT update the original row - keep it as is
          // The original row stays with its original quantity, and the new row has the change
        } else {
          // New item - create with full quantity (positive)
          const orderItem = await itemsCollection.create(record => {
            record.orderId = orderId;
            record.itemId = item.itemId || item.id || uuidv4();
            record.deviceId = deviceId;
            record.staffId = staffId;
            record.itemName = item.itemName || null;
            record.price = item.price ? parseFloat(item.price.toString()) : null;
            record.discountFeeType = item.discountFeeType || 'PERCENT';
            record.discountFeeRate = item.discountFeeRate || 0;
            record.quantity = item.quantity ? parseFloat(item.quantity.toString()) : 1; // ✅ Full quantity for new items
            record.comment = item.comment || null;
            record.eventTime = now;
            record.createdTime = now;
            record.syncedAt = null; // Mark as unsynced
          });

          const actualOrderItemId = orderItem._raw.id;

          // Create item options if any
          if (item.options && item.options.length > 0) {
            for (const option of item.options) {
              await itemOptionsCollection.create(record => {
                record.orderItemId = actualOrderItemId;
                record.orderId = orderId;
                record.modifierOptionId = option.modifierOptionId || option.id || '';
                record.optionName = option.optionName || option.name || null;
                record.quantity = option.quantity ? parseFloat(option.quantity.toString()) : 1;
                record.price = option.price ? parseFloat(option.price.toString()) : 0;
                record.sortOrder = option.sortOrder || 0;
                record.eventTime = now;
                record.createdTime = now;
                record.syncedAt = null;
              });
            }
          }
        }
      }
    }

    // Update totals if provided
    if (cartData.totals && cartData.totals.length > 0) {
      // Delete existing totals
      const existingTotals = await totalsCollection
        .query(Q.where('order_id', orderId))
        .fetch();
      
      for (const total of existingTotals) {
        await total.destroyPermanently();
      }

      // Create new totals
      for (const total of cartData.totals) {
        await totalsCollection.create(record => {
          record.orderId = orderId;
          record.code = total.code ? parseFloat(total.code.toString()) : 0;
          record.title = total.title || '';
          record.value = total.value ? parseFloat(total.value.toString()) : 0;
          record.createdTime = now;
          record.syncedAt = null;
        });
      }
    }

    console.log('✅ [WatermelonDB] Order updated with new items offline:', { orderId });

    // Fetch and return updated order detail
    return await getOrderDetailOffline(orderId);
  });
}

// 🚀 COMPLETE REPLACEMENT - Always Calculate Against ORIGINAL Quantity
async function handleVoidsCorrectly(
  orderId: string,
  cartData: any,
  deviceId: string,
  staffId: string,
  now: Date
) {
  const itemsCollection = database.collections.get<OffOrderItem>(DB_NAMES.OFFLINE_ORDER_ITEMS);
  const itemOptionsCollection = database.collections.get<OffOrderItemOption>(DB_NAMES.OFFLINE_ORDER_ITEM_OPTIONS);
  
  // 1. Get CURRENT DB STATE (fresh snapshot)
  const allCurrentItems = await itemsCollection.query(Q.where('order_id', orderId)).fetch();
  
  // 2. Calculate CURRENT quantity per itemId from DB (sum ALL quantities: positive + negative)
  // This represents the current state after all previous voids/adds
  const currentDbQuantitiesByItemId: { [itemId: string]: number } = {};
  const originalItemsByItemId: { [itemId: string]: OffOrderItem } = {};
  
  for (const item of allCurrentItems) {
    const itemId = item.itemId;
    // Sum ALL quantities (positive adds, negative subtracts)
    currentDbQuantitiesByItemId[itemId] = (currentDbQuantitiesByItemId[itemId] || 0) + item.quantity;
    
    // Keep track of the original item row (use earliest createdTime if multiple, and only positive quantities)
    if (item.quantity > 0) {
      if (!originalItemsByItemId[itemId] || 
          (item.createdTime && originalItemsByItemId[itemId].createdTime && 
           item.createdTime < originalItemsByItemId[itemId].createdTime!)) {
        originalItemsByItemId[itemId] = item;
      }
    }
  }
  
  // 3. Calculate UI quantities from cartData and track cancel reasons
  const uiItemQuantities: { [itemId: string]: number } = {};
  const uiItemCancelReasons: { [itemId: string]: string | null } = {}; // ✅ Track cancel reasons
  if (cartData.items) {
    for (const cartItem of cartData.items) {
      const itemId = cartItem.itemId || cartItem.id;
      uiItemQuantities[itemId] = parseFloat(cartItem.quantity?.toString() || '0');
      // ✅ Store cancel reason if provided (for items being voided)
      if (cartItem.cancelReason) {
        uiItemCancelReasons[itemId] = cartItem.cancelReason;
      }
    }
  }
  
  // 4. For EACH item, calculate EXACT void amount (current DB - UI)
  // This ensures each void operation creates the correct incremental void amount
  for (const itemId in currentDbQuantitiesByItemId) {
    const currentDbQty = currentDbQuantitiesByItemId[itemId]; // Sum of all rows (10 + (-1) + (-1) = 8)
    const uiCurrentQty = uiItemQuantities[itemId] || 0;
    const voidAmount = currentDbQty - uiCurrentQty; // How much to void in this operation
    
    if (voidAmount > 0) {
      const originalItem = originalItemsByItemId[itemId];
      if (originalItem) {
        // ✅ Get cancel reason for this item
        const cancelReason = uiItemCancelReasons[itemId] || null;
        
        // ✅ Create ONE row with EXACT void amount for this operation
        // Store the exact quantity voided in this operation (not cumulative)
        await createVoidRow(
          originalItem, 
          voidAmount, 
          orderId, 
          deviceId, 
          staffId, 
          now, 
          itemOptionsCollection,
          cancelReason // ✅ Pass cancel reason
        );
        
        // ✅ DO NOT UPDATE the original item's quantity
        // Keep original row unchanged, let consolidation handle the sum
        
        console.log(`✅ VOID ${voidAmount} ${originalItem.itemName} (db:${currentDbQty}→ui:${uiCurrentQty}) reason: ${cancelReason || 'none'}`);
      }
    }
  }
}

async function createVoidRow(
  originalItem: OffOrderItem,
  voidQuantity: number, // EXACT amount: 1, 2, 3, 5 etc.
  orderId: string,
  deviceId: string,
  staffId: string,
  now: Date,
  itemOptionsCollection: Collection<OffOrderItemOption>,
  cancelReason?: string | null // ✅ Add cancelReason parameter
) {
  const itemsCollection = database.collections.get<OffOrderItem>(DB_NAMES.OFFLINE_ORDER_ITEMS);
  
  const voidedItem = await itemsCollection.create(record => {
    record.orderId = orderId;
    record.itemId = originalItem.itemId;
    record.deviceId = deviceId;
    record.staffId = staffId;
    record.itemName = originalItem.itemName;
    record.price = originalItem.price;
    record.discountFeeType = originalItem.discountFeeType || 'FLATFEE';
    record.discountFeeRate = originalItem.discountFeeRate || 0;
    record.quantity = -voidQuantity; // ✅ 1st: -1, 2nd: -1, 3rd: -3
    record.comment = originalItem.comment;
    record.cancelReason = cancelReason || null; // ✅ Store cancel reason
    record.eventTime = now;
    record.createdTime = now;
    record.syncedAt = null;
  });
  
  // Copy options
  const options = await itemOptionsCollection.query(Q.where('order_item_id', originalItem.id)).fetch();
  for (const opt of options) {
    await itemOptionsCollection.create(record => {
      record.orderItemId = voidedItem._raw.id;
      record.orderId = orderId;
      record.modifierOptionId = opt.modifierOptionId;
      record.optionName = opt.optionName;
      record.quantity = opt.quantity;
      record.price = opt.price;
      record.sortOrder = opt.sortOrder;
      record.eventTime = now;
      record.createdTime = now;
      record.syncedAt = null;
    });
  }
  
  // ✅ Create "Item Cancelled" activity when voiding with a reason (matching online flow)
  if (cancelReason) {
    const { ORDER_STATUS_CODES } = require('../../features/common/constants');
    const statusesCollection = database.collections.get<OffOrderStatus>('mh_off_order_status');
    await statusesCollection.create(record => {
      record.orderId = orderId;
      record.status = parseInt(ORDER_STATUS_CODES.ITEM_CANCELED, 10); // ✅ Use status 81 (ITEM_CANCELED)
      record.eventTime = now;
      record.createdTime = now;
      record.updatedBy = staffId || '';
      record.syncedAt = null;
    });
  }
}

/**
 * Update order with comped/voided items offline - saves to WatermelonDB
 */
export async function updateOrderWithCompedItemsOffline(
  orderId: string,
  cartData: any, // EditOrderRequestCart
  deviceId: string,
  staffId: string
): Promise<OrderDetail | null> {
  return await database.write(async () => {
    console.log('📦 [WatermelonDB] Updating order with comped/voided items offline:', { orderId });
    
    const ordersCollection = database.collections.get<OffOrder>(DB_NAMES.OFFLINE_ORDERS);
    const itemsCollection = database.collections.get<OffOrderItem>(DB_NAMES.OFFLINE_ORDER_ITEMS);
    const itemOptionsCollection = database.collections.get<OffOrderItemOption>(DB_NAMES.OFFLINE_ORDER_ITEM_OPTIONS);
    const totalsCollection = database.collections.get<OffOrderTotal>(DB_NAMES.OFFLINE_ORDER_TOTALS);
    const statusesCollection = database.collections.get<OffOrderStatus>(DB_NAMES.OFFLINE_ORDER_STATUS);

    // Fetch existing order
    const orders = await ordersCollection
      .query(Q.where('id', orderId))
      .fetch();
    
    if (orders.length === 0) {
      console.log('❌ [WatermelonDB] Order not found for comped items update:', orderId);
      return null;
    }

    const order = orders[0];
    const now = new Date();

    // Update order metadata if provided
    if (cartData.comment !== undefined) {
      await order.update(record => {
        record.comment = cartData.comment || null;
      });
    }
    if (cartData.customNote !== undefined) {
      await order.update(record => {
        record.customNote = cartData.customNote || null;
      });
    }
    if (cartData.discount !== undefined) {
      await order.update(record => {
        record.discount = cartData.discount || '0';
      });
    }
    if (cartData.discountType !== undefined) {
      await order.update(record => {
        record.discountType = cartData.discountType || '';
      });
    }
    if (cartData.isTaxRemoved !== undefined) {
      await order.update(record => {
        record.isTaxRemoved = cartData.isTaxRemoved || 0;
      });
    }

    // Get existing items
    const existingItems = await itemsCollection
      .query(Q.where('order_id', orderId))
      .fetch();

    // 🚀 UNIFIED VOID HANDLING - Always calculates against ORIGINAL quantity
    await handleVoidsCorrectly(orderId, cartData, deviceId, staffId, now);

    // Handle removed options
    if (cartData.removedOptionId && cartData.removedOptionId.length > 0) {
      for (const removedOptionId of cartData.removedOptionId) {
        const optionToRemove = await itemOptionsCollection
          .query(Q.where('id', removedOptionId))
          .fetch();
        
        if (optionToRemove.length > 0) {
          await optionToRemove[0].destroyPermanently();
          console.log('🗑️ [WatermelonDB] Removed option:', removedOptionId);
        }
      }
    }

    // Handle added items and comped items (voids are handled by handleAllVoids above)
    if (cartData.items && cartData.items.length > 0) {
      for (const editedItem of cartData.items) {
        const existingItem = existingItems.find(item => item.id === editedItem.id || item.id === editedItem.orderItemId);
        
        if (existingItem) {
          // Calculate the quantity change
          const originalQuantity = existingItem.quantity; // Original quantity from DB
          const newQuantity = editedItem.quantity ? parseFloat(editedItem.quantity.toString()) : originalQuantity;
          const quantityChange = newQuantity - originalQuantity; // Will be positive for adding (e.g., 6 - 5 = 1)
          
          // Only create new row if there's a positive quantity change (adding items, not voiding)
          // Voids are handled by handleAllVoids above
          if (quantityChange > 0) {
            // Create a NEW row with the change quantity (positive for adding)
            const changeItem = await itemsCollection.create(record => {
              record.orderId = orderId;
              record.itemId = existingItem.itemId; // Same itemId as original
              record.deviceId = deviceId;
              record.staffId = staffId;
              record.itemName = existingItem.itemName || editedItem.itemName || null;
              record.price = existingItem.price || (editedItem.price ? parseFloat(editedItem.price.toString()) : null);
              record.discountFeeType = existingItem.discountFeeType || editedItem.discountFeeType || 'PERCENT';
              record.discountFeeRate = existingItem.discountFeeRate || editedItem.discountFeeRate || 0;
              record.quantity = quantityChange; // ✅ Store change quantity (e.g., +1.0 for adding 1 item)
              record.comment = editedItem.comment !== undefined ? (editedItem.comment || null) : existingItem.comment;
              record.eventTime = now;
              record.createdTime = now;
              record.syncedAt = null; // Mark as unsynced
            });

            const actualChangeItemId = changeItem._raw.id;

            // Copy options from original item if needed, or use edited options
            const optionsToUse = editedItem.options && editedItem.options.length > 0 
              ? editedItem.options 
              : await itemOptionsCollection
                  .query(Q.where('order_item_id', existingItem.id))
                  .fetch()
                  .then(opts => opts.map(opt => ({
                    modifierOptionId: opt.modifierOptionId || '',
                    optionName: opt.optionName || null,
                    quantity: opt.quantity || 1,
                    price: opt.price || 0,
                    sortOrder: opt.sortOrder || 0,
                  })));

            // Create options for the change item
            if (optionsToUse && optionsToUse.length > 0) {
              for (const option of optionsToUse) {
                await itemOptionsCollection.create(record => {
                  record.orderItemId = actualChangeItemId;
                  record.orderId = orderId;
                  record.modifierOptionId = option.modifierOptionId || option.id || '';
                  record.optionName = option.optionName || option.name || null;
                  record.quantity = option.quantity ? parseFloat(option.quantity.toString()) : 1;
                  record.price = option.price ? parseFloat(option.price.toString()) : 0;
                  record.sortOrder = option.sortOrder || 0;
                  record.eventTime = now;
                  record.createdTime = now;
                  record.syncedAt = null;
                });
              }
            }

            console.log('📝 [WatermelonDB] Created change row for added item:', {
              itemId: existingItem.itemId,
              originalQuantity,
              newQuantity,
              changeQuantity: quantityChange,
            });
          }
          
          // ✅ DO NOT update the original row - keep it as is
          // The original row stays with its original quantity, and the new row has the change
        } else if (editedItem.isCompOff) {
          // If item is comped but doesn't exist, it might be a new comped item
          // Create it with price 0 or handle as needed
          const compedItem = await itemsCollection.create(record => {
            record.orderId = orderId;
            record.itemId = editedItem.itemId || editedItem.id || uuidv4();
            record.deviceId = deviceId;
            record.staffId = staffId;
            record.itemName = editedItem.itemName || null;
            record.price = 0; // Comped items are free
            record.discountFeeType = editedItem.discountFeeType || 'PERCENT';
            record.discountFeeRate = editedItem.discountFeeRate || 0;
            record.quantity = editedItem.quantity ? parseFloat(editedItem.quantity.toString()) : 1;
            record.comment = editedItem.comment || null;
            record.eventTime = now;
            record.createdTime = now;
            record.syncedAt = null;
          });

          // Create options for comped item if any
          if (editedItem.options && editedItem.options.length > 0) {
            for (const option of editedItem.options) {
              await itemOptionsCollection.create(record => {
                record.orderItemId = compedItem._raw.id;
                record.orderId = orderId;
                record.modifierOptionId = option.modifierOptionId || option.id || '';
                record.optionName = option.optionName || option.name || null;
                record.quantity = option.quantity ? parseFloat(option.quantity.toString()) : 1;
                record.price = 0; // Options are also free for comped items
                record.sortOrder = option.sortOrder || 0;
                record.eventTime = now;
                record.createdTime = now;
                record.syncedAt = null;
              });
            }
          }
        }
      }
    }

    // Update totals if provided
    if (cartData.totals && cartData.totals.length > 0) {
      // Delete existing totals
      const existingTotals = await totalsCollection
        .query(Q.where('order_id', orderId))
        .fetch();
      
      for (const total of existingTotals) {
        await total.destroyPermanently();
      }

      // Create new totals
      for (const total of cartData.totals) {
        await totalsCollection.create(record => {
          record.orderId = orderId;
          record.code = total.code ? parseFloat(total.code.toString()) : 0;
          record.title = total.title || '';
          record.value = total.value ? parseFloat(total.value.toString()) : 0;
          record.createdTime = now;
          record.syncedAt = null;
        });
      }
    }

    console.log('✅ [WatermelonDB] Order updated with comped/voided items offline:', { orderId });

    // Fetch and return updated order detail
    return await getOrderDetailOffline(orderId);
  });
}


/**
 * Convert OrderJSON directly to OrderDetail format without database query
 * This is more efficient when you already have the OrderJSON object
 */
export function convertOrderJSONToOrderDetail(orderJSON: OrderJSON): OrderDetail {
  // Parse order source detail
  const orderSourceDetail = orderJSON.order_source_detail || null;
  
  // Calculate totalItems (sum of all item quantities)
  const totalItems = (orderJSON.items || []).reduce((sum, item) => {
    return sum + (item.quantity || 0);
  }, 0);
  
  // Calculate orderTotal from totals (code 5: Grand Total)
  const orderTotalEntry = (orderJSON.totals || []).find(t => t.code === 5);
  const orderTotal = orderTotalEntry?.value || 0;
  
  // Get latest status
  const latestStatus = (orderJSON.statuses || [])[(orderJSON.statuses || []).length - 1];
  const status = latestStatus?.status.toString() || '0';
  
  // Determine paymentStatus from latest transaction
  let paymentStatus: PaymentStatus | null = null;
  let isTransactionCompleted = false;
  if (orderJSON.transactions && orderJSON.transactions.length > 0) {
    const latestTransaction = orderJSON.transactions[orderJSON.transactions.length - 1];
    paymentStatus = {
      id: latestTransaction.id,
      locationId: latestTransaction.location_id,
      paymentProviderId: latestTransaction.payment_provider_id,
      orderId: latestTransaction.order_id,
      message: latestTransaction.message,
      request: latestTransaction.request || '',
      response: '', // Not stored in offline transactions
      statusCode: latestTransaction.status_code,
      authorizationCode: '', // Not applicable for offline
      transactionAmount: latestTransaction.transaction_amount,
      amountTendered: latestTransaction.transaction_amount,
      tenderType: latestTransaction.tender_type,
      cardType: latestTransaction.card_type || '',
      cardInfo: latestTransaction.card_last4 || '',
      transactionType: latestTransaction.transaction_type || '',
      createdTime: orderJSON.created_time || orderJSON.event_time || '',
      modifiedTime: orderJSON.event_time || '',
    };
    // Status code 24 typically means success in offline transactions
    isTransactionCompleted = latestTransaction.status_code === '24';
  }
  
  // Map items to OrderItem format
  const orderItems: OrderItem[] = (orderJSON.items || []).map((item) => ({
    id: item.id,
    itemId: item.item_id,
    itemName: item.item_name || '',
    cuisineId: '', // Not stored in offline
    itemAltName: '', // Not stored in offline
    quantity: (item.quantity || 0).toString(),
    price: (item.price || 0).toString(),
    subTotal: ((item.price || 0) * (item.quantity || 0)).toFixed(2),
    customNote: item.comment || null,
    comment: item.comment || null,
    options: (item.options || []).map((option) => ({
      id: option.id,
      modifierOptionId: option.modifier_option_id || '',
      optionName: option.option_name,
      quantity: (option.quantity || 0).toString(),
      price: (option.price || 0).toString(),
      comment: null,
      cartIndex: null,
    })),
    taxFees: null,
    itemModified: false,
    cancelReason: null,
    category: null,
    masterKOT: false,
    stationKOT: false,
    stockQuantity: null,
    classesPerMonth: null,
    imageRequired: 0,
    isCustomizationItem: false,
    categoryId: null,
    index: null,
    startDate: null,
    endDate: null,
    durationOfClasses: null,
    isSelected: false,
    reason: null,
    uniqueId: item.id,
    isCompOff: false,
    initialQuantity: (item.quantity || 0).toString(),
    orderItemId: item.id,
    isWeightBased: null,
    priceUnit: null,
  }));
  
  // Map totals to OrderTotal format
  const orderTotals: OrderTotal[] = (orderJSON.totals || []).map((total) => ({
    id: total.id,
    code: total.code.toString(),
    title: total.title,
    value: total.value.toFixed(2),
    sortOrder: total.sort_order.toString(),
  }));
  
  // Map transactions to Transaction format
  const orderTransactions: Transaction[] = (orderJSON.transactions || []).map((t) => ({
    amountTendered: t.transaction_amount,
    id: t.id,
    locationId: t.location_id,
    paymentProviderId: t.payment_provider_id,
    orderId: t.order_id,
    message: t.message,
    transactionAmount: t.transaction_amount,
    request: t.request || '',
    response: '', // Not stored in offline
    statusCode: t.status_code,
    authorizationCode: '', // Not applicable
    createdTime: orderJSON.created_time || orderJSON.event_time || '',
    modifiedTime: orderJSON.event_time || '',
    tenderType: t.tender_type,
    staffId: orderJSON.staff_id || undefined,
  }));
  
  // Build OrderDetail object matching API response
  const orderDetail: OrderDetail = {
    // Base Order fields
    orderId: orderJSON.id,
    locationId: orderJSON.location_id,
    customerId: orderJSON.customer_id || '',
    deviceId: orderJSON.device_id || '',
    staffId: orderJSON.staff_id || '',
    fullName: orderJSON.customer_fullname || orderSourceDetail?.customerName || '',
    email: orderJSON.customer_email || orderSourceDetail?.customerEmail || '',
    phone: orderJSON.customer_phone_number || orderSourceDetail?.customerMobile || '',
    totalItems: totalItems.toString(),
    comment: orderJSON.comment || '',
    orderNo: orderJSON.order_no,
    orderTypeId: orderJSON.order_type_id,
    orderTotal: orderTotal,
    pendingAmount: 0, // Default for offline
    status: status,
    address: null,
    deliveryStaffId: '',
    addressLine1: '',
    addressLine2: '',
    addressLine3: '',
    orderDate: orderJSON.order_date || '',
    orderTime: orderJSON.order_time || '',
    etaTime: orderJSON.eta_time,
    etaDate: orderJSON.eta_date,
    pickUpTime: orderJSON.pickup_time || '',
    pickUpDate: orderJSON.pickup_date || '',
    deliveryTime: '',
    deliveryDate: '',
    paymentStatus: paymentStatus,
    transactions: orderTransactions,
    tableName: orderSourceDetail?.tableName || null,
    orderSourceName: orderSourceDetail?.orderSourceName || '',
    orderSourceNo: orderSourceDetail?.orderSourceNo || '',
    orderSource: orderSourceDetail?.orderSource || 'I',
    sortOrder: null,
    serverStaffName: orderJSON.staff_id || '',
    reservationId: null,
    orderTypeGroup: orderSourceDetail?.orderTypeGroup || '',
    branchName: null,
    guestCount: orderSourceDetail?.guestCount || 0,
    currentDate: formatDateToString(new Date()),
    currentTime: formatDateToISO(new Date()),
    orderSourceDetail: orderSourceDetail,
    isScheduleOrder: false,
    tip: null,
    tipType: null,
    eventSlug: orderSourceDetail?.eventSlug || null,
    slotTime: orderSourceDetail?.slotTime || null,
    isQSROrder: false,
    
    // OrderDetail specific fields
    items: orderItems,
    totals: orderTotals,
    transactionsToShow: [],
    activeValets: [],
    deliveryStaffDetails: [],
    businessDetails: {} as BusinessDetails,
    isOrderCancelled: false,
    paymentLink: null,
    itemTax: null,
    serviceTax: null,
    isPaymentDone: isTransactionCompleted,
    tableId: orderSourceDetail?.tableId || null,
    isTransactionCompleted: isTransactionCompleted,
    refundedItems: [],
    refundedAmount: null,
    refundAmount: 0,
    discount: parseFloat(orderSourceDetail?.discountAmount || '0'),
    discountType: orderSourceDetail?.discountType || '',
    isOrderMerged: false,
    paymentType: orderSourceDetail?.payType || null,
    uniqueId: orderJSON.id,
    isTaxRemoved: orderJSON.is_tax_removed || 0,
    isScheduled: false,
    transactionsWithTip: [],
    cpPaymentTipAmount: 0,
    isCustomizationCountRequired: false,
    cashInfo: null,
    customNote: orderJSON.comment,
    preAuthorizedCard: null,
    kotThrottlingItemDetails: [],
    orderSummaryItems: [],
    holdItems: null,
    splitDetails: [],
    isSplitBill: false,
    splitId: null,
    openCashDrawer: false,
    kotNo: null,
    orderInstruction: null,
    payByLink: 0,
    channel: null,
    requestedTime: null,
    amount: null,
    orderStatus: status,
    trackURL: null,
    dasherName: null,
    dasherPhone: null,
    dasherDeliveryETA: null,
    dasherPickupETA: null,
    nextStatus: null,
    orderActivities: [],
    orderStatusAndTags: [],
    orderInstructions: [],
    splitBill: false,
    payByLinkOrder: null,
    unrealizedOrder: null,
    unrealizedComment: null,
    sourceDetail: orderSourceDetail,
    isTransactionBasedReceipt: false,
    phoneCode: orderSourceDetail?.phoneCode || '',
  };
  
  // ✅ Calculate channel name with fallback logic (BEFORE building orderDetail)
  // ✅ IMPORTANT: Check orderSourceName FIRST (matching online flow in MHOrderTransactionCard)
  let formattedChannelName: string | null = null;
  let orderSource: 'O' | 'I' | 'P' | 'E' | undefined = undefined;
  const rawChannel = orderSourceDetail?.channel;
  const rawOrderSourceName = orderSourceDetail?.orderSourceName;
  
  // ✅ Check orderSourceName first (matching online flow)
  // BUT: Ignore "Instore" as it's a fallback display name, not a real channel
  // If orderSourceName is "Instore", treat it as if there's no orderSourceName and check channel instead
  if (rawOrderSourceName && rawOrderSourceName.toLowerCase() !== 'instore') {
    // If orderSourceName exists and is not "Instore", use it directly (matching online flow behavior)
    // Format it properly (handle "maghil" -> "Maghil" or "MaghilHub")
    const orderSourceNameLower = rawOrderSourceName.toLowerCase();
    if (orderSourceNameLower === 'maghilhub' || orderSourceNameLower === 'maghil') {
      formattedChannelName = 'MaghilHub';
    } else {
      // Use orderSourceName as-is (capitalize properly)
      formattedChannelName = rawOrderSourceName
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
    // If orderSourceName exists, it's typically an online order
    orderSource = 'O';
  } else if (rawChannel) {
    // Order has a channel (third-party/online order) but no valid orderSourceName
    const channelLower = rawChannel.toLowerCase();
    if (channelLower === 'maghilhub' || channelLower === 'maghil') {
      formattedChannelName = 'MaghilHub';
    } else if (channelLower === 'gloriafood') {
      formattedChannelName = 'GloriaFood';
    } else if (channelLower === 'grubhub') {
      formattedChannelName = 'Grubhub';
    } else if (channelLower === 'doordash') {
      formattedChannelName = 'DoorDash';
    } else if (channelLower === 'uber eats' || channelLower === 'ubereats') {
      formattedChannelName = 'Uber Eats';
    } else if (channelLower === 'seamless') {
      formattedChannelName = 'Seamless';
    } else if (channelLower === 'swiggy') {
      formattedChannelName = 'Swiggy';
    } else if (channelLower === 'zomato') {
      formattedChannelName = 'Zomato';
    } else {
      formattedChannelName = rawChannel
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
    // If channel exists, orderSource should be 'O' (Online)
    orderSource = 'O';
  } else {
    formattedChannelName = null;
    // Determine orderSource from orderSourceDetail or default
    orderSource = (orderSourceDetail?.orderSource as 'O' | 'I' | 'P' | 'E') || 'I';
  }
  
  // Get orderTypeGroup from orderSourceDetail
  const orderTypeGroup = orderSourceDetail?.orderTypeGroup || '';
  
  // Determine display channel name with fallback logic
  let displayChannelName: string | null = null;
  
  // ✅ IMPORTANT: For instore orders (orderTypeGroup === 'I'), always display "Instore" regardless of channel/orderSourceName
  // Instore orders should never show channel names like "MaghilHub" - they are created in-store
  if (orderTypeGroup === 'I') {
    // Instore order - always display "Instore"
    displayChannelName = 'Instore';
  } else if (formattedChannelName) {
    displayChannelName = formattedChannelName;
  } else {
    // No channel - use fallback logic based on orderTypeGroup and orderSource
    if (orderTypeGroup === 'S') {
      // Delivery order
      if (orderSource === 'O') {
        displayChannelName = 'oDelivery';
      } else {
        displayChannelName = 'Delivery';
      }
    } else if (orderTypeGroup === 'P') {
      // Pickup order
      if (orderSource === 'I') {
        displayChannelName = 'Instore';
      } else if (orderSource === 'P') {
        displayChannelName = 'Phone';
      } else if (orderSource === 'O') {
        displayChannelName = 'oPickup';
      }
    } else if (orderTypeGroup === 'D') {
      // Dine In order
      displayChannelName = 'Dine In';
    }
  }

  // Set the channel property based on displayChannelName, fallback to empty string
  orderDetail.channel = displayChannelName || '';
  return orderDetail;
}