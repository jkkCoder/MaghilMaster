import { MerchantDevice } from '../api/printer/printerModels';
import database from '../watermelondb-example/database';
import Printer from '../watermelondb-example/models/Printer';

// Save printers to WatermelonDB
export async function savePrintersToDB(printersData: MerchantDevice[], locationId: string, staffId: string) {
  if (!printersData || printersData.length === 0) {
    console.error('❌ Invalid printers data or empty array');
    return;
  }

  try {
  
    // Filter out invalid printers (null deviceName, etc.)
    const validPrinters = printersData.filter(printer => 
      printer.id && 
      printer.deviceType && 
      (printer.deviceName || printer.deviceType === 'TAB')
    );
    
    console.log('🖨️ Number of valid printers to save:', validPrinters.length);
    
    // Log details of each valid printer being saved
    validPrinters.forEach((printer, index) => {
    });

    // Clear existing printers for this location
    // console.log('🧹 Clearing existing printers for this location...');
    await clearPrintersFromDB(locationId, staffId);

    // Save new printers
    // console.log('💾 Saving new printers to WatermelonDB...');
    await database.write(async () => {
      for (const printerData of validPrinters) {
        await database.get<Printer>('printers').create(printer => {
          updatePrinterFields(printer, printerData, locationId, staffId);
        });
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to save printers to WatermelonDB:', error);
  }
}

// Get printers from WatermelonDB
export async function getPrintersFromDB(locationId: string, staffId: string): Promise<MerchantDevice[]> {
  try {
    // console.log('🔍 Searching for printers in WatermelonDB...');
    // console.log('📍 Location ID:', locationId);
    // console.log('👤 Staff ID:', staffId);
    
    const printers = await database.get<Printer>('printers')
      .query()
      .fetch();
    
    // console.log('📊 Total printers in WatermelonDB:', printers.length);
    
    const locationPrinters = printers.filter(printer => 
      printer.locationId === locationId && 
      printer.staffId === staffId
    );
    
    // console.log('📊 Printers found for this location:', locationPrinters.length);
    
    if (locationPrinters.length > 0) {
      // console.log('✅ Printers found in WatermelonDB:', locationPrinters.map(p => ({
      //   id: p.deviceId,
      //   deviceName: p.deviceName,
      //   deviceType: p.deviceType,
      //   isDefault: p.isDefault
      // })));
    } else {
      console.log('❌ No printers found in WatermelonDB for location:', locationId);
    }
    
    return locationPrinters.map(printer => convertWatermelonPrinterToMerchantDevice(printer));
  } catch (error) {
    console.error('❌ Failed to fetch printers from WatermelonDB:', error);
    return [];
  }
}

// Clear printers from WatermelonDB for a specific location
export async function clearPrintersFromDB(locationId: string, staffId: string) {
  try {
    await database.write(async () => {
      const printers = await database.get<Printer>('printers')
        .query()
        .fetch();
      
      const locationPrinters = printers.filter(printer => 
        printer.locationId === locationId && 
        printer.staffId === staffId
      );
      
      await Promise.all(locationPrinters.map(printer => printer.destroyPermanently()));
    });
    // console.log(`Cleared printers from WatermelonDB for location: ${locationId}`);
  } catch (error) {
    console.error('Failed to clear printers from WatermelonDB:', error);
  }
}

// Clear all printers from WatermelonDB
export async function clearAllPrintersFromDB() {
  try {
    await database.write(async () => {
      const printers = await database.get<Printer>('printers').query().fetch();
      await Promise.all(printers.map(printer => printer.destroyPermanently()));
    });
    // console.log('All printers cleared from WatermelonDB');
  } catch (error) {
    console.error('Failed to clear all printers from WatermelonDB:', error);
  }
}

// Helper function to update printer fields
function updatePrinterFields(printer: any, printerData: MerchantDevice, locationId: string, staffId: string) {
  printer.deviceId = printerData.id || '';
  printer.deviceIdentifier = printerData.deviceIdentifier || '';
  printer.deviceName = printerData.deviceName || '';
  printer.deviceType = printerData.deviceType || '';
  printer.modelName = printerData.modelName || '';
  printer.ipAddress = printerData.ipAddress || '';
  printer.printerPort = printerData.printerPort || '';
  printer.isDefault = printerData.isDefault || 0;
  printer.printTo = printerData.printTo || '';
  printer.receiptPrinterId = printerData.receiptPrinterId || '';
  printer.locationId = locationId;
  printer.staffId = staffId;
  // Note: createdAt and updatedAt are @readonly, so they will be set automatically by WatermelonDB
}

// Convert WatermelonDB Printer to MerchantDevice
function convertWatermelonPrinterToMerchantDevice(printer: any): MerchantDevice {
  return {
    id: printer.deviceId,
    deviceIdentifier: printer.deviceIdentifier,
    deviceName: printer.deviceName,
    deviceType: printer.deviceType,
    modelName: printer.modelName,
    ipAddress: printer.ipAddress,
    printerPort: printer.printerPort,
    isDefault: printer.isDefault,
    printTo: printer.printTo,
    receiptPrinterId: printer.receiptPrinterId,
  };
} 