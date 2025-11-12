import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, json } from '@nozbe/watermelondb/decorators';

export default class Restaurant extends Model {
  static table = 'restaurants';

  @field('restaurant_id') restaurantId!: string;
  @field('location_id') locationId!: string;
  @field('branch_name') branchName!: string;
  @field('business_name') businessName!: string;
  @field('country') country!: string;
  @field('currency') currency!: string;
  @field('timezone') timezone!: string;
  @field('pin_based_login') pinBasedLogin!: number;
  @field('enabled_modules') enabledModules!: string;
  @field('order_types') orderTypes!: string;
  @field('third_parties') thirdParties!: string;
  @field('media') media!: string;
  @field('payment_provider') paymentProvider!: string;
  @field('disabled_services') disabledServices!: string;
  @field('additional_print_space') additionalPrintSpace!: number;
  @field('cuisines') cuisines!: string;
  @field('staff_id') staffId!: string;
  @readonly @date('created_at') createdAt!: number;
  @readonly @date('updated_at') updatedAt!: number;
} 