import { tableSchema } from '@nozbe/watermelondb';
import { DB_NAMES } from '../../../constants';

export const offlineOrderItemOptionsTable = tableSchema({
  name: DB_NAMES.OFFLINE_ORDER_ITEM_OPTIONS,
  columns: [
    { name: 'order_item_id', type: 'string', isIndexed: true },
    { name: 'order_id', type: 'string', isIndexed: true },
    { name: 'modifier_option_id', type: 'string', isOptional: true },
    { name: 'option_name', type: 'string' },
    { name: 'quantity', type: 'number' },
    { name: 'price', type: 'number', isOptional: true },
    { name: 'sort_order', type: 'number', isOptional: true },
    { name: 'event_time', type: 'number', isOptional: true },
    { name: 'created_time', type: 'number', isOptional: true },
    { name: 'synced_at', type: 'number', isOptional: true },
  ],
});


