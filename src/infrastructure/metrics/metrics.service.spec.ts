import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
  });

  it('records HTTP metrics in prometheus format', () => {
    service.recordHttp('GET', '/health', 200, 12);

    const output = service.toPrometheus();

    expect(output).toContain('http_requests_total');
    expect(output).toContain('method="GET"');
    expect(output).toContain('status="200"');
    expect(output).toContain('http_request_duration_ms');
  });

  it('records queue, storage, push, and audit counters', () => {
    service.recordQueue('emails', 'completed');
    service.recordStorage('upload', 'success');
    service.recordPush('sent');
    service.recordAudit('login');

    const output = service.toPrometheus();

    expect(output).toContain('queue_jobs_total');
    expect(output).toContain('storage_ops_total');
    expect(output).toContain('notification_push_total');
    expect(output).toContain('audit_events_total');
  });
});
