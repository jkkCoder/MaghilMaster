export * from './appPref';
export * from './offlineOrders';
export * from './vaultCashDrawer';
export * from './restaurant';
export * from './menu';
export * from './staff';

import { appPrefModels } from './appPref';
import { offlineOrderModels } from './offlineOrders';
import { dockModels } from './dock';
import { vaultCashDrawerModels } from './vaultCashDrawer';
import { restaurantModels } from './restaurant';
import { menuModels } from './menu';
import { staffModels } from './staff';

export const modelRegistry = {
  appPref: appPrefModels,
  offlineOrders: offlineOrderModels,
  vaultCashDrawer: vaultCashDrawerModels,
  dock: dockModels,
  restaurant: restaurantModels,
  menu: menuModels,
  staff: staffModels,
} as const;

export const allModels = [
  ...modelRegistry.appPref, 
  ...modelRegistry.offlineOrders, 
  ...modelRegistry.vaultCashDrawer,
  ...modelRegistry.dock,
  ...modelRegistry.restaurant,
  ...modelRegistry.menu,
  ...modelRegistry.staff,
];

export { default as OffOrder } from './offlineOrders/OffOrder';
export { default as OffOrderStatus } from './offlineOrders/OffOrderStatus';
export { default as OffOrderTotal } from './offlineOrders/OffOrderTotal';
export { default as OffOrderItem } from './offlineOrders/OffOrderItem';
export { default as OffOrderItemOption } from './offlineOrders/OffOrderItemOption';
export { default as VaultCashierLog } from './vaultCashDrawer/VaultCashierLog';
export { default as VaultExpenseLog } from './vaultCashDrawer/VaultExpenseLog';
export { default as RestaurantDetailModel } from './restaurant/RestaurantDetail';
export { default as MenuDetailModel } from './menu/MenuDetail';
export { default as Staff } from './staff/Staff';
