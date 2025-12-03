import type { SchemaModule } from '../../types';

import { cashierLogTable } from './cashierLog';
import { expenseLogTable } from './expenseLog';

const vaultCashDrawerModule: SchemaModule = {
  name: 'vaultCashDrawer',
  tables: [
    cashierLogTable,
    expenseLogTable,
  ],
};

export default vaultCashDrawerModule;

