import { tableSchema } from '@nozbe/watermelondb';
import { DB_NAMES } from '../../../constants';

export const offlineOrderStatusTable = tableSchema({
  name: DB_NAMES.OFFLINE_ORDER_STATUS,
  columns: [
    { name: 'order_id', type: 'string', isIndexed: true },
    { name: 'status', type: 'number', isIndexed: true },
    { name: 'event_time', type: 'number', isOptional: true },
    { name: 'created_time', type: 'number', isOptional: true },
    { name: 'updated_by', type: 'string' },
    { name: 'synced_at', type: 'number', isOptional: true },
  ],
});


