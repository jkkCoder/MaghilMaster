import { Model } from '@nozbe/watermelondb'
import { field, relation } from '@nozbe/watermelondb/decorators'
import Order from './order'

export default class OrderDummy extends Model {
  static table = 'order_dummies'
  static associations = {
    orders: { type: 'belongs_to', key: 'order_id' }
  }

  @field('order_id') orderId!: string
  @field('dummy_text') dummyText!: string
  @field('dummy_value') dummyValue!: string
  @field('created_at') createdAt!: number
  @field('updated_at') updatedAt!: number

  // This creates the belongs_to relation back to Order
  @relation('orders', 'order_id') order!: Order
}
