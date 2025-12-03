import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class AppPreference extends Model {
  static table = 'app_pref';

  @field('key') key!: string;
  @field('value') value!: string;
}


