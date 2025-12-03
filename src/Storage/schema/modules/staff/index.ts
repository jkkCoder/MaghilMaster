import type { SchemaModule } from '../../types';

import { staffTable } from './staff';

const staffModule: SchemaModule = {
  name: 'staff',
  tables: [
    staffTable,
  ],
};

export default staffModule;

