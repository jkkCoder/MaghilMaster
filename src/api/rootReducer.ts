import {combineReducers} from 'redux';

import printerReducer from './printer/printerReducer';
import authReducer from './auth/AuthReducer';

const reducers = {
  printer: printerReducer,
  auth: authReducer,
};

export const rootReducer = combineReducers(reducers);

export type RootState = ReturnType<typeof rootReducer>;
