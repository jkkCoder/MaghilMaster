import type { SchemaModule } from '../../types';

import { offlineOrdersTable } from './orders';
import { offlineOrderStatusTable } from './orderStatus';
import { offlineOrderTotalsTable } from './orderTotals';
import { offlineOrderItemsTable } from './orderItems';
import { offlineOrderItemOptionsTable } from './orderItemOptions';
import { offlineTransactionsTable } from './transactions';

const offlineOrdersModule: SchemaModule = {
  name: 'offlineOrders',
  tables: [
    offlineOrdersTable,
    offlineOrderStatusTable,
    offlineOrderTotalsTable,
    offlineOrderItemsTable,
    offlineOrderItemOptionsTable,
    offlineTransactionsTable,
  ],
};

export default offlineOrdersModule;


