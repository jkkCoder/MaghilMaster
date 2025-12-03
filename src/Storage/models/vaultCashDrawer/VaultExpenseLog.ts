import { Model } from '@nozbe/watermelondb';
import { field, date } from '@nozbe/watermelondb/decorators';

export default class VaultExpenseLog extends Model {
  static table = 'mh_expense_log';

  @field('location_id') locationId!: string;
  @field('cash_drawer_device_id') cashDrawerDeviceId!: string;
  @field('type') type!: string; // "CASH" | "CHECK"
  @field('name') name!: string | null; // reason/name
  @field('category') category!: string;
  @field('pay_in') payIn!: string | null; // decimal stored as string
  @field('pay_out') payOut!: string | null; // decimal stored as string
  @field('created_time') createdTime!: string;
  @field('modified_time') modifiedTime!: string;
  @field('cashier_log_id') cashierLogId!: string;
  @field('staff_name') staffName!: string | null;
  @date('synced_at') syncedAt!: Date | null;
}

