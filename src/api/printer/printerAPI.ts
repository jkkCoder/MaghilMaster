import { getAuthHeader } from '../../utils/api-utils';
import API from '../api';

export function getPrintersAPI(locationId: string, deviceIdentifier?: string, type?: string) {

  const baseUrl = '/devices/fetch-devices?locationId=' + locationId;
  const url = deviceIdentifier ? baseUrl + '&deviceIdentifier=' + deviceIdentifier : baseUrl;
  const finalUrl = type ? url + '&type=' + type : url;
  return API({
    method: 'get',
    // url: '/merchants/getDevice?locationId=' + locationId,
    url: finalUrl,
    headers: getAuthHeader(),
  });
}