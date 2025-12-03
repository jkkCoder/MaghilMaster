import { tableSchema } from '@nozbe/watermelondb';
import { DB_NAMES } from '../../../constants';

export const offlineOrderTotalsTable = tableSchema({
  name: DB_NAMES.OFFLINE_ORDER_TOTALS,
  columns: [
    { name: 'order_id', type: 'string', isIndexed: true },
    { name: 'code', type: 'number', isIndexed: true },
    { name: 'title', type: 'string', isIndexed: true },
    { name: 'value', type: 'number' },
    { name: 'sort_order', type: 'number', isIndexed: true },
    { name: 'event_time', type: 'number', isOptional: true },
    { name: 'created_time', type: 'number', isOptional: true },
    { name: 'synced_at', type: 'number', isOptional: true },
  ],
});


