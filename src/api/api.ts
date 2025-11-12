import axios from 'axios';
import { ToastAndroid } from 'react-native';
import Config from 'react-native-config';
import { PermissionDeniedText } from '../utils/constants';


const API = axios.create({
  baseURL: Config?.API_ENDPOINT || 'http://localhost:3000',
  timeout: 60000,
});

API?.interceptors?.response?.use(
  (res) => res,
  async(err) => {
    // Handle network errors (offline, connection issues)
    if (err.code === 'NETWORK_ERROR' || err.message === 'Network Error' || !err.response) {
      console.log('Network Error detected - app may be offline:', {
        code: err.code,
        message: err.message,
        timestamp: new Date().toISOString()
      });
      
      // Don't throw network errors - let the calling code handle them
      // This prevents unhandled promise rejections
      return Promise.reject({
        ...err,
        isNetworkError: true,
        handled: true
      });
    }

    // Handle HTTP response errors
    if (err?.response) {
      switch (err?.response?.status) {
        case 401:
          try {
            // Show user-friendly error message
            ToastAndroid.show('Session expired. Please login again', ToastAndroid.LONG);
          } catch (error) {
            console.error('Error in 401 handler:', error);
            // Ensure we still throw the original error
            throw err;
          }
          break;
        case 403:
          ToastAndroid.show(PermissionDeniedText, ToastAndroid.LONG);
          return err?.response;
          break;
        case 424:
          return err?.response;
        case 400:
          return err?.response;
        case 500:
          return err?.response;
        default:
          break;
      }
    }
    
    console.log("API Error", err);
    
    // For all other errors, return a rejected promise instead of throwing
    // This prevents unhandled promise rejections
    return Promise.reject({
      ...err,
      handled: true
    });
  },
);

// API.defaults.headers.common['Authorization'] = 'Bearer token';

export default API;
