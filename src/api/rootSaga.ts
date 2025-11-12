import {all, fork} from 'redux-saga/effects';

import printerSaga from './printer/printerSaga';
import authSaga from './auth/AuthSaga';

// Redux Saga: Root Saga
export default function* rootSaga() {
  yield all([
    fork(printerSaga),
    fork(authSaga)
  ]);
}
