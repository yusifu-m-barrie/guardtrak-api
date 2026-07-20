import { Injectable } from '@nestjs/common';

const HTTP_DURATION_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];

interface CounterKey {
  name: string;
  labels: Record<string, string>;
}

interface HistogramObservation {
  labels: Record<string, string>;
  value: number;
}

@Injectable()
export class MetricsService {
  private readonly counters = new Map<string, number>();
  private readonly histogramObservations: HistogramObservation[] = [];

  recordHttp(
    method: string,
    route: string,
    status: number,
    durationMs: number,
  ): void {
    this.incrementCounter('http_requests_total', {
      method: method.toUpperCase(),
      route,
      status: String(status),
    });
    this.observeHistogram(
      'http_request_duration_ms',
      { method, route },
      durationMs,
    );
  }

  recordQueue(
    queue: string,
    status: 'completed' | 'failed' | 'dead_letter',
  ): void {
    this.incrementCounter('queue_jobs_total', { queue, status });
  }

  recordStorage(operation: string, status: 'success' | 'failure'): void {
    this.incrementCounter('storage_ops_total', { operation, status });
  }

  recordPush(status: 'sent' | 'failed' | 'skipped'): void {
    this.incrementCounter('notification_push_total', { status });
  }

  recordAudit(action: string): void {
    this.incrementCounter('audit_events_total', { action });
  }

  recordDomain(domain: string, action: string): void {
    this.incrementCounter('domain_events_total', { domain, action });
  }

  recordCache(result: 'hit' | 'miss'): void {
    this.incrementCounter('cache_lookups_total', { result });
  }

  recordRedis(status: 'up' | 'down' | 'memory'): void {
    this.incrementCounter('redis_status_total', { status });
  }

  toPrometheus(): string {
    const lines: string[] = [];
    const mem = process.memoryUsage();

    lines.push('# HELP process_resident_memory_bytes Resident set size.');
    lines.push('# TYPE process_resident_memory_bytes gauge');
    lines.push(`process_resident_memory_bytes ${mem.rss}`);

    lines.push('# HELP process_heap_used_bytes Heap used bytes.');
    lines.push('# TYPE process_heap_used_bytes gauge');
    lines.push(`process_heap_used_bytes ${mem.heapUsed}`);

    lines.push('# HELP http_requests_total Total HTTP requests processed.');
    lines.push('# TYPE http_requests_total counter');
    for (const [key, value] of this.counters) {
      if (key.startsWith('http_requests_total|')) {
        lines.push(this.formatCounterLine('http_requests_total', key, value));
      }
    }

    lines.push(
      '# HELP http_request_duration_ms HTTP request duration in milliseconds.',
    );
    lines.push('# TYPE http_request_duration_ms histogram');
    lines.push(
      ...this.formatHistogram(
        'http_request_duration_ms',
        HTTP_DURATION_BUCKETS,
      ),
    );

    for (const metric of [
      'queue_jobs_total',
      'storage_ops_total',
      'notification_push_total',
      'audit_events_total',
      'domain_events_total',
      'cache_lookups_total',
      'redis_status_total',
    ] as const) {
      lines.push(`# HELP ${metric} GuardTrak metric.`);
      lines.push(`# TYPE ${metric} counter`);
      for (const [key, value] of this.counters) {
        if (key.startsWith(`${metric}|`)) {
          lines.push(this.formatCounterLine(metric, key, value));
        }
      }
    }

    return `${lines.join('\n')}\n`;
  }

  private incrementCounter(name: string, labels: Record<string, string>): void {
    const key = this.counterKey({ name, labels });
    this.counters.set(key, (this.counters.get(key) ?? 0) + 1);
  }

  private observeHistogram(
    name: string,
    labels: Record<string, string>,
    value: number,
  ): void {
    this.histogramObservations.push({ labels, value });
    void name;
  }

  private counterKey(counter: CounterKey): string {
    const labelPart = Object.entries(counter.labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${this.escapeLabel(v)}"`)
      .join(',');
    return `${counter.name}|${labelPart}`;
  }

  private formatCounterLine(
    metricName: string,
    storageKey: string,
    value: number,
  ): string {
    const labels = storageKey.slice(metricName.length + 1);
    return labels
      ? `${metricName}{${labels}} ${value}`
      : `${metricName} ${value}`;
  }

  private formatHistogram(name: string, buckets: number[]): string[] {
    const lines: string[] = [];
    const grouped = new Map<string, number[]>();

    for (const observation of this.histogramObservations) {
      const labelKey = Object.entries(observation.labels)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}="${this.escapeLabel(v)}"`)
        .join(',');
      const values = grouped.get(labelKey) ?? [];
      values.push(observation.value);
      grouped.set(labelKey, values);
    }

    for (const [labelKey, values] of grouped) {
      for (const le of buckets) {
        const cumulative = values.filter((v) => v <= le).length;
        const bucketLabels = labelKey ? `${labelKey},le="${le}"` : `le="${le}"`;
        lines.push(`${name}_bucket{${bucketLabels}} ${cumulative}`);
      }
      const sum = values.reduce((acc, v) => acc + v, 0);
      const count = values.length;
      if (labelKey) {
        lines.push(`${name}_sum{${labelKey}} ${sum}`);
        lines.push(`${name}_count{${labelKey}} ${count}`);
      } else {
        lines.push(`${name}_sum ${sum}`);
        lines.push(`${name}_count ${count}`);
      }
    }

    return lines;
  }

  private escapeLabel(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n');
  }
}
