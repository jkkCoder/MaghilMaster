import { Model } from '@nozbe/watermelondb';
import { field, date } from '@nozbe/watermelondb/decorators';
import { Cheque } from '../../../features/cash/cashModel';

export default class VaultCashierLog extends Model {
  static table = 'mh_cashier_log';

  // @field('id') id!: string; // cashierLogId
  @field('location_id') locationId!: string;
  @field('cash_drawer_device_id') cashDrawerDeviceId!: string;
  @field('staff_id') staffId!: string;
  @field('amount') amount!: string; 
  @field('status_id') statusId!: number; 
  @field('parent_id') parentId!: string | null;
  @field('float_amt') floatAmt!: string; 
  @field('notes') notes!: string | null; 
  @field('coins') coins!: string | null; 
  @field('cheques') cheques!: string | null; 
  @field('created_time') createdTime!: string;
  @field('modified_time') modifiedTime!: string;
  @date('synced_at') syncedAt!: Date | null;

  // Helper methods to parse JSON
  getNotes(): { value: number; symbol: string; count: number }[] {
    if (!this.notes) return [];
    try {
      return JSON.parse(this.notes);
    } catch {
      return [];
    }
  }

  getCoins(): { value: number; symbol: string; count: number }[] {
    if (!this.coins) return [];
    try {
      return JSON.parse(this.coins);
    } catch {
      return [];
    }
  }

  getCheques(): Cheque[] {
    if (!this.cheques) return [];
    try {
      return JSON.parse(this.cheques);
    } catch {
      return [];
    }
  }
}

