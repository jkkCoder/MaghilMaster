import {
  RestaurantDetailRequest,
  SignInForm,
} from './AuthModels';
import { getAuthHeader } from '../../utils/api-utils';
import API from '../api';
import { encryptJson } from '../../utils/ec-utils';

// SignIn
export function signIn(userDetails: SignInForm) {
  return API({
    method: 'post',
    url: '/customer/login',
    data: userDetails,
  });
}


export function getRestaurantDetailsApi(details: RestaurantDetailRequest) {
  const encryptedData = encryptJson({ staffId: details?.staffId, locationId: details.locationId, sendMyTableSection: true })
  return API({
    method: 'post',
    url: '/merchants/locations/id',
    data: { data: encryptedData },
    headers: getAuthHeader(),
  });
}

