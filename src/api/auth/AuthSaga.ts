import {put, call, takeLatest} from 'redux-saga/effects';
import {
  AuthActions,
  failedSignIn,
  successSignIn,
} from './AuthActions';
import {
  SIGNIN_REQUEST,
} from './AuthConstants';
import {signIn, } from './AuthAPI';
import {
  UserDetails,
  MetaResult,
  SignInForm,
} from './AuthModels';
import {AxiosResponse} from 'axios';


function* signInSaga(action: AuthActions) {
  try {
    const response: AxiosResponse = yield call(
      signIn,
      action.payload as SignInForm,
    );
    if (response.status == 200) {
      if (response.data.metaDataInfo) {
        const result = response.data as MetaResult;
        if (result.metaDataInfo.responseCode == 'ERROR') {
          yield put(
            failedSignIn({message: response.data.metaDataInfo.responseMessage}),
          );
        }
      } else {
        const result = response.data as UserDetails;
        yield put(successSignIn(result));
      }
    } else {
      yield put(failedSignIn({message: 'Failed to SignIn, Please Try Again'}));
    }
  } catch (err) {
    console.log('Catch', err);
    yield put(failedSignIn({message: 'Failed to SignIn, Please Try Again'}));
  }
}


export default function* authSaga() {
  yield takeLatest(SIGNIN_REQUEST, signInSaga);
}
