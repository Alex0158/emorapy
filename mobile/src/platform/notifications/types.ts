export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

export interface PushPermissionResult {
  status: PermissionStatus;
  canAskAgain?: boolean;
}

export interface PushTokenPayload {
  token: string;
  platform: 'ios' | 'android';
}
