import { tableSchema } from '@nozbe/watermelondb';

import type { SchemaModule } from '../../types';

const menuDetailTable = tableSchema({
  name: 'mh_menu_details',
  columns: [
    { name: 'location_id', type: 'string', isIndexed: true },
    { name: 'menu_type', type: 'string', isIndexed: true },
    { name: 'cache_key', type: 'string', isIndexed: true },
    { name: 'menu_data', type: 'string' },
    { name: 'event_time', type: 'number', isOptional: true },
    { name: 'created_at', type: 'number' },
    { name: 'updated_at', type: 'number' },
  ],
});

const menuDetailModule: SchemaModule = {
  name: 'menu',
  tables: [menuDetailTable],
};

export default menuDetailModule;

