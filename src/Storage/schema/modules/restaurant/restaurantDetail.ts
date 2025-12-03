import { tableSchema } from '@nozbe/watermelondb';

import type { SchemaModule } from '../../types';

const restaurantDetailTable = tableSchema({
  name: 'mh_restaurant_details',
  columns: [
    { name: 'location_id', type: 'string', isIndexed: true },
    { name: 'restaurant_data', type: 'string' }, // JSON stored as string
    { name: 'event_time', type: 'number', isOptional: true },
    { name: 'created_at', type: 'number' },
    { name: 'updated_at', type: 'number' },
  ],
});

const restaurantDetailModule: SchemaModule = {
  name: 'restaurant',
  tables: [restaurantDetailTable],
};

export default restaurantDetailModule;

