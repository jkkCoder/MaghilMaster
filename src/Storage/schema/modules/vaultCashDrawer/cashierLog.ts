import { tableSchema } from '@nozbe/watermelondb';

export const cashierLogTable = tableSchema({
  name: 'mh_cashier_log',
  columns: [
    { name: 'location_id', type: 'string', isIndexed: true },
    { name: 'cash_drawer_device_id', type: 'string', isIndexed: true },
    { name: 'staff_id', type: 'string', isIndexed: true },
    { name: 'amount', type: 'string' }, // decimal stored as string
    { name: 'status_id', type: 'number' }, // 1 = active, 0 = completed
    { name: 'parent_id', type: 'string', isOptional: true },
    { name: 'float_amt', type: 'string' }, // decimal stored as string
    { name: 'notes', type: 'string', isOptional: true }, // JSON string for notes breakdown
    { name: 'coins', type: 'string', isOptional: true }, // JSON string for coins breakdown
    { name: 'cheques', type: 'string', isOptional: true }, // JSON string for cheques
    { name: 'created_time', type: 'string' },
    { name: 'modified_time', type: 'string' },
    { name: 'synced_at', type: 'number', isOptional: true },
  ],
});

