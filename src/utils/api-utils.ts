// import Store from '../features/configureStore';
// import NetInfo from '@react-native-community/netinfo';

import { getState } from "../api/getStore";


export const getAuthHeader = () => {
  try {
    const state = getState();
    if (!state?.auth?.credentials?.accessToken) {
      return {
        'Accept-Encoding': 'gzip, deflate, br',
        'Content-Type': 'application/json'
      };
    }
    return {
      Authorization: 'bearer ' + 'eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJwZjRyOEFsQVdraGNpMGhZbkFWRW5SMUE0VUpWUlNpM014V2FQS3hpZlNjIn0.eyJleHAiOjE3NjU1MjQ2NzUsImlhdCI6MTc2MjkzMjY3NSwianRpIjoiMjZiN2M0NjEtMzJhMi00YjNkLWE3OGQtMTk0MzQ0MjIwNDNjIiwiaXNzIjoiaHR0cHM6Ly9hdXRocS5nY3AubWFnaWxodWIuY29tL3JlYWxtcy9tZXJjaGFudCIsImF1ZCI6ImFjY291bnQiLCJzdWIiOiIyZWJiYmEyNy00NzNlLTQwODYtYjlhOC0wOTlkNWZlNDYxNDEiLCJ0eXAiOiJCZWFyZXIiLCJhenAiOiJraW9zayIsInNpZCI6IjYwYWZmYWNiLTZmN2UtNDMxNC1hZGRiLTRlYmY5MGZhOTlkZiIsImFsbG93ZWQtb3JpZ2lucyI6WyJodHRwOi8vbG9jYWxob3N0OjgwODEiXSwicmVhbG1fYWNjZXNzIjp7InJvbGVzIjpbImRlZmF1bHQtcm9sZXMtbWVyY2hhbnQiLCJvZmZsaW5lX2FjY2VzcyIsInVtYV9hdXRob3JpemF0aW9uIl19LCJyZXNvdXJjZV9hY2Nlc3MiOnsia2lvc2siOnsicm9sZXMiOlsiUmVzdGF1cmFudF9Pd25lciJdfSwiYWNjb3VudCI6eyJyb2xlcyI6WyJtYW5hZ2UtYWNjb3VudCIsIm1hbmFnZS1hY2NvdW50LWxpbmtzIiwidmlldy1wcm9maWxlIl19fSwic2NvcGUiOiJwcm9maWxlIGVtYWlsIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsIm5hbWUiOiJOZXcgTWFuIiwicHJlZmVycmVkX3VzZXJuYW1lIjoibmV3dnBuQGEyYmRlbW8yIiwiZ2l2ZW5fbmFtZSI6Ik5ldyIsImZhbWlseV9uYW1lIjoiTWFuIn0.bvrYvRKj2kgWIrdMMKBIwPXhqv4nHQ6RUY5__AUHDHlYSFkugpYYKpc7ffL_-6YOICnzn5PU3XTZwXHYIkW3RvF_hFOjYENns_az3T0F-4jjAv7RmR3lu-SlVy54hUawfSvNa6lFD5ALsvCu-kQdPt4JltqQnU28Aog_Q5JOsny87gzoiQtqxK1HmXG_WRvvF2td7NYpJ45cdylnIaFi3b3ZSWTcUzccDDvzhHQiSi0ACxJFJI4w8hVEqCi3FWE5JEXwEF465mVzqEZXNP2e8AwwbouLERGiG9WCj4f9ef8hY7ClLiciwTNRdzf6tOF7bRh-39qkb2XM3EavzHkEnw',
      'Accept-Encoding': 'gzip, deflate, br',
      'Content-Type': 'application/json'
    };
  } catch (error) {
    // If store is not initialized, return headers without auth token
    return {
      'Accept-Encoding': 'gzip, deflate, br',
      'Content-Type': 'application/json'
    };
  }
};