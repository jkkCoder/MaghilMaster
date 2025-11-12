// import { Model } from '@nozbe/watermelondb';
// import { field, date, readonly } from '@nozbe/watermelondb/decorators';

// export default class Printer extends Model {
//   static table = 'printers';

//   @field('device_id') deviceId!: string;
//   @field('device_identifier') deviceIdentifier!: string;
//   @field('device_name') deviceName!: string;
//   @field('device_type') deviceType!: string;
//   @field('model_name') modelName!: string;
//   @field('ip_address') ipAddress!: string;
//   @field('printer_port') printerPort!: string;
//   @field('is_default') isDefault!: number;
//   @field('print_to') printTo!: string;
//   @field('receipt_printer_id') receiptPrinterId!: string;
//   @field('location_id') locationId!: string;
//   @field('staff_id') staffId!: string;
//   @readonly @date('created_at') createdAt!: number;
//   @readonly @date('updated_at') updatedAt!: number;
// } 


import { Model, Q } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';
import type { Database } from '@nozbe/watermelondb';

export default class Printer extends Model {
  static table = 'printers';

  // Device details
  @field('device_id') deviceId!: string;
  @field('device_identifier') deviceIdentifier!: string;
  @field('device_name') deviceName!: string;
  @field('device_type') deviceType!: string;
  @field('model_name') modelName!: string;
  @field('ip_address') ipAddress!: string;
  @field('printer_port') printerPort!: string;

  // Printer details
  @field('name') name!: string;
  @field('type') type!: number;
  @field('address') address!: string;
  @field('purpose') purpose!: number;
  @field('model') model!: string;
  @field('print_to') printTo!: string;

  // Configuration flags
  @field('is_station_printer') isStationPrinter!: boolean;
  @field('is_58mm') is58mm!: boolean;
  @field('is_star') isStar!: boolean;
  @field('is_default') isDefault!: number;
  @field('is_active_dnd') isActiveDnd!: boolean;
  @field('is_print_to_update') isPrintToUpdate!: boolean;

  // Business/Reference fields
  @field('receipt_printer_id') receiptPrinterId!: string;
  @field('merchant_id') merchantId!: string;
  @field('location_id') locationId!: string;
  @field('staff_id') staffId!: string;
  @field('tab_identifier') tabIdentifier!: string;
  @field('attribute_name') attributeName!: string;

  // Cuisine-related
  @field('cuisine_id') cuisineId!: string;
  @field('cuisine_ids') cuisineIds!: string;
  @field('cuisine_tag_names') cuisineTagNames!: string;
  @field('selected_cuisines') selectedCuisines!: string;

  // Optional metadata
  @field('station_name') stationName!: string;
  @field('nick_name') nickName!: string;
  @field('magil_print_id') magilPrintId!: string;

  // Timestamps
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  // Derived properties
  get displayName() {
    return this.nickName || this.name;
  }

  get isMainReceiptPrinter() {
    return this.purpose === 1;
  }

  get isKotPrinter() {
    return this.purpose === 2 || this.purpose === 3;
  }

  get isStationKotPrinter() {
    return this.purpose === 3;
  }

  get connectionType() {
    switch (this.type) {
      case 1: return 'Bluetooth';
      case 2: return 'LAN';
      case 3: return 'USB';
      case 4: return 'Sunmi';
      default: return 'Unknown';
    }
  }

  get purposeLabel() {
    switch (this.purpose) {
      case 1: return 'Main Receipt';
      case 2: return 'Master KOT';
      case 3: return 'Station KOT';
      default: return 'Unknown';
    }
  }

  // Static queries
  static async findByAddressAndPurpose(database: Database, address: string, purpose: number, cuisineId?: string) {
    const collection = database.collections.get<Printer>('printers');
    let query = collection.query(
      Q.where('address', address),
      Q.where('purpose', purpose)
    );

    if (cuisineId) {
      query = query.extend(Q.where('cuisine_id', cuisineId));
    }

    const results = await query.fetch();
    return results.length > 0 ? results[0] : null;
  }

  static async findByType(database: Database, type: number) {
    const collection = database.collections.get<Printer>('printers');
    return await collection.query(Q.where('type', type)).fetch();
  }

  static async findByPurpose(database: Database, purpose: number) {
    const collection = database.collections.get<Printer>('printers');
    return await collection.query(Q.where('purpose', purpose)).fetch();
  }

  static async findStationPrinters(database: Database) {
    const collection = database.collections.get<Printer>('printers');
    return await collection.query(Q.where('is_station_printer', true)).fetch();
  }

  static async findStarPrinters(database: Database) {
    const collection = database.collections.get<Printer>('printers');
    return await collection.query(Q.where('is_star', true)).fetch();
  }
}
