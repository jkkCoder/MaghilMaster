import { tableSchema } from '@nozbe/watermelondb';

import type { SchemaModule } from '../../types';

const merchantDeviceTable = tableSchema({
  name: 'mh_devices',
  columns: [
    { name: 'merchant_id', type: 'string', isIndexed: true },
    { name: 'location_id', type: 'string', isIndexed: true },
    { name: 'device_identifier', type: 'string', isIndexed: true },
    { name: 'device_ip', type: 'string', isOptional: true },
    { name: 'device_type', type: 'string', isIndexed: true },
    { name: 'model', type: 'string' },
    { name: 'is_default', type: 'number', isOptional: true },
    { name: 'attributes', type: 'string', isOptional: true },
    { name: 'name', type: 'string', isOptional: true },
    { name: 'receipt_printer_id', type: 'string', isOptional: true },
    { name: 'section_id', type: 'string', isOptional: true },
    { name: 'staff_id', type: 'string', isOptional: true },
    { name: 'tag_ids', type: 'string', isOptional: true },
    { name: 'print_to', type: 'string', isOptional: true },
    { name: 'printer_port', type: 'string', isOptional: true },
    { name: 'is_star_printer', type: 'number', isOptional: true },
    { name: 'device_connectivity_type', type: 'string', isOptional: true },
    { name: 'is_58mm', type: 'number', isOptional: true },
    { name: 'active_dnd', type: 'number', isOptional: true },
    { name: 'event_time', type: 'number', isOptional: true },
    { name: 'created_at', type: 'number',},
    { name: 'updated_at', type: 'number',},
  ],
});

const merchantDeviceModule: SchemaModule = {
  name: 'merchantDevice',
  tables: [merchantDeviceTable],
};

export default merchantDeviceModule;