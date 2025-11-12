import database from '../database';
import RestaurantTable from '../models/RestaurantTable';
import { Collection, Model } from '@nozbe/watermelondb';

interface TableData {
  tableName: string;
  customerName: string | null;
  status: 'available' | 'reserved';
  isFavorite: boolean;
}

interface TableUpdateData {
  tableName?: string;
  customerName?: string | null;
  status?: 'available' | 'reserved';
  isFavorite?: boolean;
}

class TableService {
  static async getAllTables(): Promise<RestaurantTable[]> {
    const collection = database.collections.get('restaurant_tables') as Collection<RestaurantTable>;
    const tables = await collection.query().fetch();
    return tables;
  }

  static async createTable(tableData: TableData): Promise<RestaurantTable> {
    const collection = database.collections.get('restaurant_tables') as Collection<RestaurantTable>;
    const newTable = await database.write(async () => {
      return await collection.create(table => {
        table.tableName = tableData.tableName;
        table.customerName = tableData.customerName;
        table.status = tableData.status;
        table.isFavorite = tableData.isFavorite;
      });
    });
    return newTable;
  }

  static async updateTable(tableId: string, updateData: TableUpdateData): Promise<RestaurantTable> {
    // console.log('updateData:: ', updateData);
    const collection = database.collections.get('restaurant_tables') as Collection<RestaurantTable>;
    // console.log('tableId:: ', tableId);
    const table = await collection.find(tableId);
    // console.log('table:: ', table);
    if (!table) throw new Error('Table not found');

    await database.write(async () => {
      await table.update(record => {
        if (updateData.tableName !== undefined) record.tableName = updateData.tableName;
        if (updateData.customerName !== undefined) record.customerName = updateData.customerName;
        if (updateData.status !== undefined) record.status = updateData.status;
        if (updateData.isFavorite !== undefined) record.isFavorite = updateData.isFavorite;
      });
    });

    return table;
  }

  static async deleteTable(tableId: string): Promise<boolean> {
    const collection = database.collections.get('restaurant_tables') as Collection<RestaurantTable>;
    const table = await collection.find(tableId);
    
    if (!table) return false;

    await database.write(async () => {
      await table.destroyPermanently();
    });

    return true;
  }

  static async deleteAllTables(): Promise<number> {
    const collection = database.collections.get('restaurant_tables') as Collection<RestaurantTable>;
    const tables = await collection.query().fetch();
    
    await database.write(async () => {
      await Promise.all(tables.map(table => table.destroyPermanently()));
    });

    return tables.length;
  }

  // static async getStats(): Promise<{
  //   total: number;
  //   available: number;
  //   reserved: number;
  //   favorites: number;
  // }> {
  //   const collection = database.collections.get('restaurant_tables') as Collection<RestaurantTable>;
  //   const tables = await collection.query().fetch();

  //   const stats = {
  //     total: tables.length,
  //     available: tables.filter(t => t.isAvailable).length,
  //     reserved: tables.filter(t => t.status === 'reserved').length,
  //     favorites: tables.filter(t => t.isFavorite).length,
  //   };

  //   return stats;
  // }
}

export default TableService; 