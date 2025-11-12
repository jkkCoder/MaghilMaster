import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class AppSettings extends Model {
  static table = 'app_settings'

  @field('setting_key') settingKey!: string
  @field('setting_value') settingValue!: string
  @field('location_id') locationId!: string
  @field('order_type') orderType!: string
  @field('last_synced') lastSynced!: number
  @field('is_active') isActive!: boolean
  @date('created_at') createdAt!: Date
  @date('updated_at') updatedAt!: Date
} 