import axios, { type AxiosInstance } from 'axios';
import type { HttpClientDefaults } from './types.js';

export function createHttpClient(defaults: HttpClientDefaults = {}): AxiosInstance {
  return axios.create({
    baseURL: defaults.baseURL,
    timeout: defaults.timeout ?? 30000,
    headers: {
      'Content-Type': 'application/json',
      ...defaults.headers,
    },
  });
}
