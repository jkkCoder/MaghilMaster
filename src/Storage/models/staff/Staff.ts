import { Model } from '@nozbe/watermelondb';
import { field, date } from '@nozbe/watermelondb/decorators';

export default class Staff extends Model {
  static table = 'mh_staff';

  @field('merchant_id') merchantId!: string;
  @field('auth_user_id') authUserId!: string | null;
  @field('custom_id') customId!: string | null;
  @field('full_name') fullName!: string;
  @field('email') email!: string | null;
  @field('mobile_phone') mobilePhone!: string | null;
  @field('device_pin') devicePin!: string | null;
  @field('status_id') statusId!: number;
  @field('is_owner') isOwner!: number | null;
  @field('attributes') attributes!: string | null;
  @field('created_time') createdTime!: number | null;
  @field('modified_time') modifiedTime!: number | null;
  @date('synced_at') syncedAt!: Date | null;

  // Helper method to parse JSON attributes
  getAttributes(): any {
    if (!this.attributes) return null;
    try {
      return JSON.parse(this.attributes);
    } catch {
      return null;
    }
  }
}

