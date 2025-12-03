import { tableSchema } from '@nozbe/watermelondb';
import { DB_NAMES } from '../../../constants';

export const offlineOrderItemsTable = tableSchema({
  name: DB_NAMES.OFFLINE_ORDER_ITEMS,
  columns: [
    { name: 'order_id', type: 'string', isIndexed: true },
    { name: 'item_id', type: 'string', isIndexed: true },
    { name: 'device_id', type: 'string' },
    { name: 'staff_id', type: 'string' },
    { name: 'item_name', type: 'string', isOptional: true },
    { name: 'price', type: 'number', isOptional: true },
    { name: 'discount_fee_type', type: 'string' },
    { name: 'discount_fee_rate', type: 'number' },
    { name: 'quantity', type: 'number' },
    { name: 'comment', type: 'string', isOptional: true },
    { name: 'cancel_reason', type: 'string', isOptional: true }, // ✅ Add cancel reason column
    { name: 'event_time', type: 'number', isOptional: true },
    { name: 'created_time', type: 'number', isOptional: true },
    { name: 'synced_at', type: 'number', isOptional: true },
  ],
});


