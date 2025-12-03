import { Model } from '@nozbe/watermelondb';
import { field, readonly, date } from '@nozbe/watermelondb/decorators';
import { RestaurantDetail } from '../../../features/restaurant/restaurantModels';

export default class RestaurantDetailModel extends Model {
  static table = 'mh_restaurant_details';

  @field('location_id') locationId!: string;
  @field('restaurant_data') restaurantData!: string;
  
  @date('event_time') eventTime!: number | null;
  @readonly @date('created_at') createdAt!: number;
  @readonly @date('updated_at') updatedAt!: number;

  // Helper method to get parsed restaurant data
  getRestaurantDetail(): RestaurantDetail | null {
    if (!this.restaurantData) return null;
    try {
      return JSON.parse(this.restaurantData) as RestaurantDetail;
    } catch {
      return null;
    }
  }
}

