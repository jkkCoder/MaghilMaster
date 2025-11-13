import { Model } from '@nozbe/watermelondb';
import { field, readonly, date } from '@nozbe/watermelondb/decorators';

export default class Product extends Model {
  static table = 'mh_products';

  @field('product_code') productCode!: string;
  @field('product_name') productName!: string;
  @field('description') description?: string;
  @field('price') price!: number;
  @field('stock_quantity') stockQuantity!: number;
  @field('is_active') isActive!: boolean;
  @readonly @date('updated_at') updatedAt!: Date;
}

