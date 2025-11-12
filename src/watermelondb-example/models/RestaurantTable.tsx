import { Database, Model } from '@nozbe/watermelondb'
import { field, readonly, date } from '@nozbe/watermelondb/decorators'
import { Q } from '@nozbe/watermelondb'

export default class RestaurantTable extends Model {
  static table = 'restaurant_tables'
  
  @field('table_name') tableName!: string
  @field('customer_name') customerName!: string
  @field('is_favorite') isFavorite!: boolean
  @field('status') status!: 'available' | 'reserved'

  @readonly @date('created_at') createdAt!: Date
  @readonly @date('updated_at') updatedAt!: Date

  get isAvailable() {
    return this.status === 'available'
  }

  get displaySummary() {
    return `${this.tableName} - ${this.status} ${this.customerName ? `(${this.customerName})` : ''}`
  }
  
  // Find all available tables
  static async findAvailable(database : Database) {
    const collection = database.collections.get('restaurant_tables')
    return await collection.query(
      Q.where('status', 'available')
    ).fetch()
  }

  // Find reserved tables
  static async findReserved(database: Database) {
    const collection = database.collections.get('restaurant_tables')
    return await collection.query(
      Q.where('status', 'reserved')
    ).fetch()
  }

  // Find favorite tables
  static async findFavorites(database: Database) {
    const collection = database.collections.get('restaurant_tables')
    return await collection.query(
      Q.where('is_favorite', true)
    ).fetch()
  }
}
