export const REALTIME_EVENTS = {
  ATTENDANCE_UPDATED: 'attendance.updated',
  OFFICER_CLOCKED_IN: 'officer.clocked_in',
  OFFICER_CLOCKED_OUT: 'officer.clocked_out',
  INCIDENT_CREATED: 'incident.created',
  INCIDENT_UPDATED: 'incident.updated',
  SOS_TRIGGERED: 'sos.triggered',
  SOS_RESOLVED: 'sos.resolved',
  PATROL_STARTED: 'patrol.started',
  PATROL_COMPLETED: 'patrol.completed',
  NOTIFICATION_RECEIVED: 'notification.received',
  DASHBOARD_REFRESH: 'dashboard.refresh',
} as const;

export type RealtimeEventName =
  (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

export interface RealtimeEventPayload {
  organisationId: string;
  [key: string]: unknown;
}
