import { appSchema, TableSchema } from '@nozbe/watermelondb';

import type { SchemaModule } from './types';
import appPrefModule from './modules/app/appPref';
import offlineOrdersModule from './modules/offlineOrders';
import merchantDeviceModule from './modules/dock/merchantDevice';
import vaultCashDrawerModule from './modules/vaultCashDrawer';
import restaurantModule from './modules/restaurant/restaurantDetail';
import menuModule from './modules/menu/menuDetail';
import staffModule from './modules/staff';

const schemaModules: SchemaModule[] = [
  appPrefModule,
  offlineOrdersModule,
  merchantDeviceModule,
  vaultCashDrawerModule,
  restaurantModule,
  menuModule,
  staffModule,
];



export const mySchema = appSchema({
  version: 9, // Incremented to add cash_drawer_device_id and cashier_log_id to mh_off_transactions 
  tables: schemaModules.reduce<TableSchema[]>((acc, module) => [...acc, ...module.tables], []),
});

export const schemaRegistry = schemaModules.reduce<Record<string, SchemaModule>>(
  (registry, module) => {
    registry[module.name] = module;
    return registry;
  },
  {},
);

export type SchemaModuleName = keyof typeof schemaRegistry;