import {
  SIGNIN_REQUEST,
  SIGNIN_FAILURE,
  SIGNIN_SUCCESS,
  CREDENTIALS_STORE,
  RESTAURANT_DETAIL_REQUEST,
  RESTAURANT_DETAIL_FAILURE,
  RESTAURANT_DETAIL_SUCCESS,
} from './AuthConstants';
import {typedAction} from '../actionTypes';
import {
  SignInForm,
  MessageResult,
  UserDetails,
  Credentials,
  RestaurantDetailRequest,
  RestaurantDetail,
  RestaurantDetailFailResult,
} from './AuthModels';

// Credential Store
export function storeCredentials(details: Credentials) {
  return typedAction(CREDENTIALS_STORE, details);
}

// SignIn
export function signIn(details: SignInForm) {
  return typedAction(SIGNIN_REQUEST, details);
}

export function failedSignIn(details: MessageResult) {
  // Replace any with Network Data Fail Data format
  return typedAction(SIGNIN_FAILURE, details);
}

export function successSignIn(details: UserDetails) {
  return typedAction(SIGNIN_SUCCESS, details);
}

export function getRestaurantDetails(data:RestaurantDetailRequest ) {
  return typedAction(RESTAURANT_DETAIL_REQUEST, data);
}

export function failedRestaurantDetails(detail: RestaurantDetailFailResult) {   // Replace any with Network Data Fail Data format
  return typedAction(RESTAURANT_DETAIL_FAILURE, detail);
}

export function successRestaurantDetails(detail: RestaurantDetail) {
  return typedAction(RESTAURANT_DETAIL_SUCCESS, detail);
}


export type AuthActions = ReturnType<
  | typeof signIn
  | typeof successSignIn
  | typeof failedSignIn
  | typeof storeCredentials
  | typeof getRestaurantDetails
  | typeof failedRestaurantDetails
  | typeof successRestaurantDetails
>;
