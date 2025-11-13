import { database } from './index';
import Product from '../models/Product';
import Order from '../models/Order';

/**
 * Debug helper to check sync status of records
 */
export async function checkSyncStatus() {
  console.log('\n🔍 Checking Sync Status...\n');
  
  try {
    // Check products
    const productsCollection = database.get<Product>('mh_products');
    const allProducts = await productsCollection.query().fetch();
    
    console.log(`📦 Products in database: ${allProducts.length}`);
    
    if (allProducts.length > 0) {
      allProducts.forEach((product, index) => {
        console.log(`\nProduct ${index + 1}:`);
        console.log(`  ID: ${product.id}`);
        console.log(`  Name: ${product.productName}`);
        console.log(`  Code: ${product.productCode}`);
        console.log(`  Updated At: ${new Date(product.updatedAt).toLocaleString()}`);
        // @ts-ignore - accessing internal sync status
        console.log(`  Sync Status: ${product._raw._status || 'synced'}`);
        // @ts-ignore
        console.log(`  Changed Fields: ${product._raw._changed || 'none'}`);
      });
    }
    
    // Check orders
    const ordersCollection = database.get<Order>('mh_off_orders');
    const allOrders = await ordersCollection.query().fetch();
    
    console.log(`\n📋 Orders in database: ${allOrders.length}`);
    
    if (allOrders.length > 0) {
      allOrders.forEach((order, index) => {
        console.log(`\nOrder ${index + 1}:`);
        console.log(`  ID: ${order.id}`);
        console.log(`  Order No: ${order.orderNo}`);
        console.log(`  Updated At: ${new Date(order.updatedAt).toLocaleString()}`);
        // @ts-ignore
        console.log(`  Sync Status: ${order._raw._status || 'synced'}`);
        // @ts-ignore
        console.log(`  Changed Fields: ${order._raw._changed || 'none'}`);
      });
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('Error checking sync status:', error);
  }
}

/**
 * Force mark all products for sync (use if products exist but aren't syncing)
 */
export async function forceMarkProductsForSync() {
  console.log('\n🔧 Force marking products for sync...\n');
  
  try {
    const productsCollection = database.get<Product>('mh_products');
    const allProducts = await productsCollection.query().fetch();
    
    console.log(`Found ${allProducts.length} products to mark`);
    
    await database.write(async () => {
      for (const product of allProducts) {
        await product.update(() => {
          // Just trigger an update to mark it as changed
          // This doesn't actually change any data, just marks it for sync
        });
      }
    });
    
    console.log(`✅ Marked ${allProducts.length} products for sync`);
    console.log('Now try syncing again!\n');
    
  } catch (error) {
    console.error('Error marking products:', error);
  }
}

/**
 * Reset sync timestamp to force full sync
 */
export async function resetSyncTimestamp() {
  console.log('\n🔄 Resetting sync timestamp...\n');
  
  try {
    // This will force WatermelonDB to think it's never synced before
    // and will push all local data
    await database.write(async () => {
      // @ts-ignore - accessing internal adapter
      if (database.adapter.getLocal) {
        // @ts-ignore
        await database.adapter.setLocal('__watermelon_last_pulled_at', '0');
      }
    });
    
    console.log('✅ Sync timestamp reset');
    console.log('Next sync will be a full sync!\n');
    
  } catch (error) {
    console.error('Error resetting timestamp:', error);
  }
}

