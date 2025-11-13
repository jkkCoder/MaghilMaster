import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'mh_off_orders',
      columns: [
        { name: 'location_id', type: 'string' },
        { name: 'customer_id', type: 'string', isOptional: true },
        { name: 'order_no', type: 'string' },
        { name: 'order_type_id', type: 'string' },
        { name: 'order_date', type: 'number' }, // timestamp
        { name: 'order_time', type: 'string' },
        { name: 'ip_address', type: 'string' },
        { name: 'user_agent', type: 'string' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'mh_products',
      columns: [
        { name: 'product_code', type: 'string' },
        { name: 'product_name', type: 'string' },
        { name: 'description', type: 'string', isOptional: true },
        { name: 'price', type: 'number' },
        { name: 'stock_quantity', type: 'number' },
        { name: 'is_active', type: 'boolean' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});

