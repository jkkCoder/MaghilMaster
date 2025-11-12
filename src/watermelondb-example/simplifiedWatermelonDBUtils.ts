// Simplified WatermelonDB utilities for orderId-only storage
import database from '../watermelondb-example/database';
import Order from '../watermelondb-example/models/order';

// Save full order data to WatermelonDB
export async function saveOrderIdToDB(orderData: any) {
  console.log('🔍 saveOrderIdToDB called with:', { 
    orderId: orderData?.orderId,
    hasItems: !!orderData?.items,
    hasTotals: !!orderData?.totals,
    orderTotal: orderData?.orderTotal
  });

  if (!orderData?.orderId) {
    console.error('❌ Invalid orderData or orderId:', orderData);
    return;
  }

  try {
    console.log('🔍 Checking for existing order...');
    
    // Get all orders and check for duplicates
    const allOrders = await database.get<Order>('orders').query().fetch();
    const existingOrder = allOrders.find(order => order.orderId === orderData.orderId);

    console.log('📊 Found existing orders with same ID:', existingOrder ? 1 : 0);

    if (existingOrder) {
      console.log(`🔄 Order with ID ${orderData.orderId} already exists, skipping to prevent duplicates`);
      console.log('✅ Order already exists in database');
      return;
    }

    console.log('🆕 Creating new order...');
    
    // Create the order with full data from orderData
    await database.write(async () => {
      // Check again inside the write transaction to prevent race conditions
      const duplicateCheck = await database.get<Order>('orders').query().fetch();
      const foundDuplicate = duplicateCheck.find(order => order.orderId === orderData.orderId);
      
      if (foundDuplicate) {
        console.log(`🚫 Duplicate detected during write transaction, skipping creation`);
        return;
      }
      
      // Create the order with full data
      await database.get<Order>('orders').create(order => {
        order.orderId = orderData.orderId || '';
        order.orderNo = orderData.orderNo || '';
        order.fullName = orderData.fullName || '';
        order.phone = orderData.phone || '';
        order.email = orderData.email || '';
        order.orderTypeId = orderData.orderTypeId || '';
        order.orderTypeGroup = orderData.orderTypeGroup || '';
        order.orderSourceName = orderData.orderSourceName || '';
        order.orderDate = orderData.orderDate || '';
        order.orderTime = orderData.orderTime || '';
        order.orderTotal = orderData.orderTotal || 0;
        order.statusId = orderData.statusId || '';
        order.tableId = orderData.tableId || '';
        order.tableNames = orderData.tableNames || '';
        order.isPaid = orderData.isPaid || false;
        order.localTime = orderData.localTime || '';
        order.orderSource = orderData.orderSource || '';
        order.mhTransactionsEntities = orderData.mhTransactionsEntities || '';
        order.refundStatus = orderData.refundStatus || '';
        order.orderTotals = orderData.orderTotals || '';
        order.nextStatus = orderData.nextStatus || '';
        order.paymentFailed = orderData.paymentFailed || false;
        order.status = orderData.status || '';
        order.sortOrder = orderData.sortOrder || 0;
        order.orderSourceDetail = orderData.orderSourceDetail || '';
        order.isOrderCancelled = orderData.isOrderCancelled || false;
        order.paymentType = orderData.paymentType || '';
        order.uniqueId = orderData.uniqueId || '';
        order.isTaxRemoved = orderData.isTaxRemoved || 0;
        order.isScheduleOrder = orderData.isScheduleOrder || false;
        order.currentFormattedDate = orderData.currentFormattedDate || '';
        order.orderType = orderData.orderType || '';
        order.isScheduled = orderData.isScheduled || false;
        order.transactionsWithTip = orderData.transactionsWithTip || '';
        order.cpPaymentTipAmount = orderData.cpPaymentTipAmount || 0;
        order.isCustomizationCountRequired = orderData.isCustomizationCountRequired || false;
        order.cashInfo = orderData.cashInfo || '';
        order.customNote = orderData.customNote || '';
        order.preAuthorizedCard = orderData.preAuthorizedCard || '';
        order.kotThrottlingItemDetails = orderData.kotThrottlingItemDetails || '';
        order.orderSummaryItems = orderData.orderSummaryItems || '';
        order.holdItems = orderData.holdItems || '';
        order.splitDetails = orderData.splitDetails || '';
        order.isSplitBill = orderData.isSplitBill || false;
        order.splitId = orderData.splitId || '';
        order.openCashDrawer = orderData.openCashDrawer || false;
        order.items = orderData.items ? JSON.stringify(orderData.items) : '[]';
        order.totals = orderData.totals ? JSON.stringify(orderData.totals) : '[]';
        order.paymentStatus = orderData.paymentStatus || '';
        order.transactions = orderData.transactions || '';
        order.activeValets = orderData.activeValets || '';
        order.deliveryStaffDetails = orderData.deliveryStaffDetails || '';
        order.businessDetails = orderData.businessDetails || '';
        order.paymentLink = orderData.paymentLink || '';
        order.itemTax = orderData.itemTax || '';
        order.serviceTax = orderData.serviceTax || '';
        order.isPaymentDone = orderData.isPaymentDone || false;
        order.refundedItems = orderData.refundedItems || '';
        order.refundedAmount = orderData.refundedAmount || '';
        order.voidedItems = orderData.voidedItems || '';
        order.discount = orderData.discount || 0;
        order.discountType = orderData.discountType || '';
        order.isOrderMerged = orderData.isOrderMerged || false;
        order.createdAt = new Date();
        order.updatedAt = new Date();
      });
    });
    
    console.log('✅ Order created successfully in database');
    console.log('🎉 Order saved to WatermelonDB successfully:', orderData.orderId);
    
  } catch (error) {
    console.error('❌ Failed to save order to WatermelonDB:', error);
    console.error('❌ Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      orderId: orderData?.orderId
    });
  }
}

// Get all orderIds from WatermelonDB
export async function getAllOrderIds(): Promise<string[]> {
  try {
    const orders = await database.get<Order>('orders').query().fetch();
    return orders.map(order => order.orderId);
  } catch (error) {
    console.error('❌ Failed to fetch orderIds:', error);
    return [];
  }
}

// Get order count
export async function getOrderCount(): Promise<number> {
  try {
    const orders = await database.get<Order>('orders').query().fetch();
    return orders.length;
  } catch (error) {
    console.error('❌ Failed to get order count:', error);
    return 0;
  }
}

// Delete order by orderId
export async function deleteOrderById(orderId: string): Promise<boolean> {
  try {
    const orders = await database.get<Order>('orders').query().fetch();
    const orderToDelete = orders.find(order => order.orderId === orderId);
    
    if (orderToDelete) {
      await database.write(async () => {
        await orderToDelete.destroyPermanently();
      });
      console.log(`✅ Order ${orderId} deleted successfully`);
      return true;
    } else {
      console.log(`⚠️ Order ${orderId} not found`);
      return false;
    }
  } catch (error) {
    console.error('❌ Failed to delete order:', error);
    return false;
  }
}

// Clear all empty orders (orders with empty orderId)
export async function clearEmptyOrders(): Promise<number> {
  try {
    const orders = await database.get<Order>('orders').query().fetch();
    const emptyOrders = orders.filter(order => !order.orderId || order.orderId.trim() === '');
    
    console.log(`🧹 Found ${emptyOrders.length} empty orders to delete`);
    
    if (emptyOrders.length > 0) {
      await database.write(async () => {
        for (const order of emptyOrders) {
          await order.destroyPermanently();
        }
      });
      console.log(`✅ Deleted ${emptyOrders.length} empty orders`);
    }
    
    return emptyOrders.length;
  } catch (error) {
    console.error('❌ Failed to clear empty orders:', error);
    return 0;
  }
}
