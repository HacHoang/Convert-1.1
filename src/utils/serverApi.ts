import { Capacitor } from '@capacitor/core';

export const SERVER_API_UNAVAILABLE_MESSAGE = 'Tính năng này cần máy chủ API; hiện chưa được bật trong bản APK.';

export class ServerApiUnavailableError extends Error {
  constructor() {
    super(SERVER_API_UNAVAILABLE_MESSAGE);
    this.name = 'ServerApiUnavailableError';
  }
}

export function isServerApiUnavailable(error: unknown): error is ServerApiUnavailableError {
  return error instanceof ServerApiUnavailableError;
}

export function isServerApiAvailable() {
  return !Capacitor.isNativePlatform();
}

export function serverApiUrl(path: string) {
  if (!isServerApiAvailable()) throw new ServerApiUnavailableError();
  return path;
}
