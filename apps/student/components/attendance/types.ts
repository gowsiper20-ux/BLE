import { AttendanceSession } from '@smart-attendance/shared';

export type AttendanceScreenState =
  | 'LOADING'
  | 'NO_SESSION'
  | 'ACTIVE_SESSION'
  | 'ERROR';
