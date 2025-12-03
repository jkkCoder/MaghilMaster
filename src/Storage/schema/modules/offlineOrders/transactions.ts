import { tableSchema } from '@nozbe/watermelondb';
import { DB_NAMES } from '../../../constants';

export const offlineTransactionsTable = tableSchema({
  name: DB_NAMES.OFFLINE_TRANSACTIONS,
  columns: [
    { name: 'order_id', type: 'string', isIndexed: true },
    { name: 'location_id', type: 'string', isIndexed: true },
    { name: 'payment_provider_id', type: 'string' },
    { name: 'message', type: 'string' },
    { name: 'request', type: 'string', isOptional: true }, // JSON stored as string, can be null
    { name: 'status_code', type: 'string' },
    { name: 'transaction_amount', type: 'number' },
    { name: 'tender_type', type: 'string' },
    { name: 'cash_drawer_device_id', type: 'string', isOptional: true},
    { name: 'cashier_log_id', type: 'string', isOptional: true},
    { name: 'transaction_type', type: 'string', isOptional: true }, // Can be null
    { name: 'card_type', type: 'string', isOptional: true },
    { name: 'card_last4', type: 'string', isOptional: true },
    { name: 'card_name', type: 'string', isOptional: true },
  ],
});

