import { Model } from '@nozbe/watermelondb';
import { field, readonly, date } from '@nozbe/watermelondb/decorators';

export default class MerchantDevice extends Model {
  static table = 'mh_devices';

  @field('merchant_id') merchantId!: string;
  @field('location_id') locationId!: string;
  @field('device_identifier') deviceIdentifier!: string;
  @field('device_ip') deviceIp!: string | null;
  @field('device_type') deviceType!: string;
  @field('model') model!: string;
  @field('name') name!: string | null;
  @field('is_default') isDefault!: number | null;
  @field('attributes') attributes!: string | null;
  @field('receipt_printer_id') receiptPrinterId!: string | null;
  @field('section_id') sectionId!: string | null;
  @field('staff_id') staffId!: string | null;
  @field('tag_ids') tagIds!: string | null;
  @field('print_to') printTo!: string | null;
  @field('printer_port') printerPort!: string | null;
  @field('is_star_printer') isStarPrinter!: number | null;
  @field('device_connectivity_type') deviceConnectivityType!: string | null;
  @field('is_58mm') is58mm!: number | null;
  @field('active_dnd') activeDnd!: number | null;
  
  @date('event_time') eventTime!: number | null;
  @readonly @date('created_at') createdAt
  @readonly @date('updated_at') updatedAt

  // Helper methods for JSON fields
  getAttributes(): any[] {
    if (!this.attributes) return [];
    try {
      return JSON.parse(this.attributes);
    } catch {
      return [];
    }
  }

  getTagIds(): string[] {
    if (!this.tagIds) return [];
    try {
      return JSON.parse(this.tagIds);
    } catch {
      return [];
    }
  }

  // Boolean helpers
  get isDefaultDevice(): boolean {
    return this.isDefault === 1;
  }

  get isStarPrinterDevice(): boolean {
    return this.isStarPrinter === 1;
  }

  get is58mmPrinter(): boolean {
    return this.is58mm === 1;
  }

  get isDndActive(): boolean {
    return this.activeDnd === 1;
  }
}