import { OrderJSON } from "../models/OrderInterface";
import { DB_NAMES } from "../Storage/constants";
import { database } from "../Storage/database";
import { OffOrder, OffOrderItem, OffOrderItemOption, OffOrderStatus, OffOrderTotal, OffTransaction } from "../Storage/models";

function parseDate(dateString: string | null | undefined): Date | null {
    if (!dateString) return null;
    try {
        const date = new Date(dateString);
        return date;
    } catch {
        return null;
    }
}

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

export async function insertOrderFromJSON(orderData: OrderJSON): Promise<OffOrder> {
    return await database.write(async () => {
        const ordersCollection = database.collections.get<OffOrder>(DB_NAMES.OFFLINE_ORDERS);
        const statusesCollection = database.collections.get<OffOrderStatus>(DB_NAMES.OFFLINE_ORDER_STATUS);
        const totalsCollection = database.collections.get<OffOrderTotal>(DB_NAMES.OFFLINE_ORDER_TOTALS);
        const itemsCollection = database.collections.get<OffOrderItem>(DB_NAMES.OFFLINE_ORDER_ITEMS);
        const optionsCollection = database.collections.get<OffOrderItemOption>(DB_NAMES.OFFLINE_ORDER_ITEM_OPTIONS);
        const transactionsCollection = database.collections.get<OffTransaction>(DB_NAMES.OFFLINE_TRANSACTIONS);
        console.log({ orderData })
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