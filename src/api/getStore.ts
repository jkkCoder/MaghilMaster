import { Store } from "./configureStore";

export const getState = () => {
  if (!Store) {
    throw new Error('Store is not initialized yet');
  }
  return Store.getState();
};
