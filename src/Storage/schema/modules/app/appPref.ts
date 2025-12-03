import { tableSchema } from '@nozbe/watermelondb';

import type { SchemaModule } from '../../types';

const appPrefTable = tableSchema({
  name: 'app_pref',
  columns: [
    { name: 'key', type: 'string', isIndexed: true },
    { name: 'value', type: 'string' },
  ],
});

const appPrefModule: SchemaModule = {
  name: 'appPref',
  tables: [appPrefTable],
};

export default appPrefModule;


