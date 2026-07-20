export type HealthStatus = 'ok' | 'degraded' | 'unhealthy';

export type RedisHealthStatus = 'up' | 'down' | 'memory';

export interface HealthCheckResult {
  status: HealthStatus;
  application: string;
  environment: string;
  timestamp: string;
  uptime: number;
  database: {
    status: 'up' | 'down';
  };
  redis: {
    status: RedisHealthStatus;
  };
}

export interface LivenessCheckResult {
  status: 'ok';
  timestamp: string;
  uptime: number;
}

export interface ReadinessCheckResult {
  status: 'ready' | 'not_ready';
  database: {
    status: 'up' | 'down';
  };
  redis: {
    status: RedisHealthStatus;
  };
  timestamp: string;
}
