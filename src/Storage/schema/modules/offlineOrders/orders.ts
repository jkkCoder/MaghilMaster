import { tableSchema } from '@nozbe/watermelondb';
import { DB_NAMES } from '../../../constants';

export const offlineOrdersTable = tableSchema({
  name: DB_NAMES.OFFLINE_ORDERS,
  columns: [  
    { name: 'location_id', type: 'string', isIndexed: true },
    { name: 'customer_id', type: 'string', isIndexed: true, isOptional: true },
    { name: 'customer_fullname', type: 'string', isOptional: true },
    { name: 'customer_phone_number', type: 'string', isOptional: true },
    { name: 'customer_email', type: 'string', isOptional: true },
    { name: 'address_id', type: 'string', isOptional: true },
    { name: 'device_id', type: 'string', isOptional: true },
    { name: 'staff_id', type: 'string', isOptional: true },
    { name: 'comment', type: 'string', isOptional: true },
    { name: 'order_no', type: 'string', isIndexed: true },
    { name: 'order_type_id', type: 'string', isIndexed: true },
    { name: 'order_date', type: 'number', isIndexed: true },
    { name: 'order_time', type: 'number', isOptional: true },
    { name: 'is_service_charge_removed', type: 'number' },
    { name: 'is_tax_removed', type: 'number' },
    { name: 'pickup_date', type: 'number', isOptional: true },
    { name: 'pickup_time', type: 'number', isOptional: true },
    { name: 'eta_date', type: 'number', isOptional: true },
    { name: 'eta_time', type: 'number', isOptional: true },
    { name: 'event_time', type: 'number', isOptional: true },
    { name: 'created_time', type: 'number', isOptional: true },
    { name: 'order_source_detail', type: 'string', isOptional: true },
    { name: 'ip_address', type: 'string' },
    { name: 'user_agent', type: 'string' },
    { name: 'section_id', type: 'string', isOptional: true },
    { name: 'synced_at', type: 'number', isOptional: true },
  ],
});


