import { tableSchema } from '@nozbe/watermelondb';

export const expenseLogTable = tableSchema({
  name: 'mh_expense_log',
  columns: [
    { name: 'location_id', type: 'string', isIndexed: true },
    { name: 'cash_drawer_device_id', type: 'string', isIndexed: true },
    { name: 'type', type: 'string' }, // "CASH" | "CHECK"
    { name: 'name', type: 'string', isOptional: true }, // reason
    { name: 'category', type: 'string' },
    { name: 'pay_in', type: 'string', isOptional: true }, // decimal stored as string
    { name: 'pay_out', type: 'string', isOptional: true }, // decimal stored as string
    { name: 'created_time', type: 'string' },
    { name: 'modified_time', type: 'string' },
    { name: 'cashier_log_id', type: 'string', isIndexed: true },
    { name: 'staff_name', type: 'string', isOptional: true },
    { name: 'synced_at', type: 'number', isOptional: true },
  ],
});

