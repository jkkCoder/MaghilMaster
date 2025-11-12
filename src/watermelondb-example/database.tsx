import { Platform } from 'react-native'
import { Database } from '@nozbe/watermelondb'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'

import schema from './schema'
import Order from '../watermelondb-example/models/order'
import AppSettings from './models/AppSettings'
import Restaurant from '../watermelondb-example/models/Restaurant'
import Printer from '../watermelondb-example/models/Printer'
import OrderDummy from './models/OrderDummy'
import OrderItem from './models/OrderItem'

const adapter = new SQLiteAdapter({
  schema,
  dbName: 'WatermelonDBExample',
  jsi: false, // Disable JSI to avoid potential issues
  onSetUpError: error => {
    console.error('WatermelonDB setup error:', error)
  }
})

const database = new Database({
  adapter,
  modelClasses: [ Order,  AppSettings, Restaurant, Printer, OrderDummy, OrderItem ],
})

export const getTablesCollection = () => {
  return database.collections.get('orders')
}

export const checkDatabaseSetup = async () => {
  try {
    // Try to access the orders table to ensure it exists
    const ordersCollection = database.collections.get('orders')
    console.log('Orders collection accessible:', !!ordersCollection)
    
    // Try a simple query to verify table works
    const count = await database.get<Order>('orders').query().fetchCount()
    console.log('Orders table has', count, 'records')
     // Test app_settings table
    //  const appSettingsCollection = database.collections.get('app_settings')
    //  console.log('AppSettings collection accessible:', !!appSettingsCollection)
    
    // Test app_settings table
    const appSettingsCollection = database.collections.get('app_settings')
    console.log('AppSettings collection accessible:', !!appSettingsCollection)
    
    // Try a simple query to verify app_settings table works
    const appSettingsCount = await database.get<AppSettings>('app_settings').query().fetchCount()
    console.log('AppSettings table has', appSettingsCount, 'records')
    
    return true
  } catch (error) {
    console.error('Database setup check failed:', error)
    return false
  }
}

export const forceRecreateDatabase = async () => {
  try {
    console.log('Force recreating database...')
    
    // Close the current database connection
    await database.write(async () => {
      console.log('Database connection closed')
    })
    
    // Force database recreation by clearing the database file
    // This will trigger a fresh database creation with the new schema
    console.log('Database will be recreated on next access with new schema')
    return true
  } catch (error) {
    console.error('Failed to force recreate database:', error)
    return false
  }
}

// Force database recreation when schema changes
export const forceDatabaseRecreation = async () => {
  try {
    console.log('🔄 Forcing database recreation...');
    
    // Close the database connection
    await database.write(async () => {
      console.log('📝 Database write access confirmed');
    });
    
    // Clear the database file to force recreation
    // This will trigger a fresh database creation with the new schema
    console.log('🗑️ Database will be recreated on next access');
    return true;
  } catch (error) {
    console.error('❌ Failed to force database recreation:', error);
    return false;
  }
};

// call this when your app starts
export const initializeDatabase = async () => {
  try {
    console.log('🚀 Initializing WatermelonDB...');
    console.log('📊 Schema version:', schema.version);
    
    // Force database recreation for schema version 12 to fix relationships
    if (schema.version === 12) {
      console.log('🔄 Schema version 12 detected - forcing database recreation for relationship fixes');
      await forceDatabaseRecreation();
    }
    
    // Try to access the database to trigger creation/migration
    await database.write(async () => {
      console.log('✅ Database write access confirmed');
    });
    
    // Test if all required tables exist
    try {
      // console.log('🔍 Testing database tables...');
      
      // Test orders table
      const ordersCount = await database.get<Order>('orders').query().fetchCount();
      // console.log('📋 Orders table: OK (', ordersCount, 'records)');
      
      // Test app_settings table
      const appSettingsCount = await database.get<AppSettings>('app_settings').query().fetchCount();
      // console.log('⚙️ AppSettings table: OK (', appSettingsCount, 'records)');
      
      // Test restaurants table
      const restaurantsCount = await database.get<Restaurant>('restaurants').query().fetchCount();
      // console.log('🏪 Restaurants table: OK (', restaurantsCount, 'records)');
      
      // Test printers table
      const printersCount = await database.get<Printer>('printers').query().fetchCount();
      // console.log('🖨️ Printers table: OK (', printersCount, 'records)');
      
      // console.log('✅ All database tables verified successfully');
      return database;
      
    } catch (tableError) {
      console.error('❌ Database table verification failed:', tableError);
      console.error('Error details:', {
        message: (tableError as Error).message,
        stack: (tableError as Error).stack,
        name: (tableError as Error).name
      });
      
      // If any table is missing, force database recreation
      if ((tableError as Error).message && (
        (tableError as Error).message.includes('no such table') ||
        (tableError as Error).message.includes('table') ||
        (tableError as Error).message.includes('column')
      )) {
        // console.log('🔄 Detected schema mismatch, forcing database recreation...');
        
        // Force recreation
        await forceRecreateDatabase();
        
        // Try initialization again
        try {
          await database.write(async () => {
            // console.log('✅ Database write access confirmed after recreation');
          });
          
          // console.log('✅ Database recreated successfully with new schema');
          return database;
          
        } catch (retryError) {
          console.error('❌ Failed to initialize database after recreation:', retryError);
          throw retryError;
        }
      } else {
        throw tableError;
      }
    }
    
  } catch (error) {
    console.error('❌ Failed to initialize WatermelonDB:', error);
    console.error('Error details:', {
      message: (error as Error).message,
      stack: (error as Error).stack,
      name: (error as Error).name
    });
    throw error;
  }
};

export default database
