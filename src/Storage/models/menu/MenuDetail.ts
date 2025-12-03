import { Model } from '@nozbe/watermelondb';
import { field, readonly, date } from '@nozbe/watermelondb/decorators';
import { RestaurantMenuResponse } from '../../../features/menu/menuModels';

export default class MenuDetailModel extends Model {
  static table = 'mh_menu_details';

  @field('location_id') locationId!: string;
  @field('menu_type') menuType!: string;
  @field('cache_key') cacheKey!: string;
  @field('menu_data') menuData!: string; //json string
  
  @date('event_time') eventTime!: number | null;
  @readonly @date('created_at') createdAt!: number;
  @readonly @date('updated_at') updatedAt!: number;

  getMenuResponse(): RestaurantMenuResponse | null {
    if (!this.menuData) return null;
    try {
      return JSON.parse(this.menuData) as RestaurantMenuResponse;
    } catch {
      return null;
    }
  }
}

