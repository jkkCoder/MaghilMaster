import { tableSchema } from '@nozbe/watermelondb';

export const staffTable = tableSchema({
  name: 'mh_staff',
  columns: [
    { name: 'merchant_id', type: 'string', isIndexed: true },
    { name: 'auth_user_id', type: 'string', isIndexed: true, isOptional: true },
    { name: 'custom_id', type: 'string', isOptional: true },
    { name: 'full_name', type: 'string' },
    { name: 'email', type: 'string', isOptional: true },
    { name: 'mobile_phone', type: 'string', isOptional: true },
    { name: 'device_pin', type: 'string', isIndexed: true, isOptional: true },
    { name: 'status_id', type: 'number', isIndexed: true },
    { name: 'is_owner', type: 'number', isOptional: true },
    { name: 'attributes', type: 'string', isOptional: true }, // JSON stored as string
    { name: 'created_time', type: 'number', isOptional: true },
    { name: 'modified_time', type: 'number', isOptional: true },
    { name: 'synced_at', type: 'number', isOptional: true },
  ],
});

