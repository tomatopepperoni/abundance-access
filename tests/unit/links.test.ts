import { it, expect } from 'vitest';
import { classifyStatus, retryDelay } from '../../src/lib/link-report';
it('keeps restricted, rate-limited and temporary failures distinct from unavailable links', () => {
  expect(classifyStatus(403)).toBe('restricted');
  expect(classifyStatus(429)).toBe('rate-limited');
  expect(classifyStatus(503)).toBe('transient');
  expect(classifyStatus(null)).toBe('transient');
  expect(classifyStatus(404)).toBe('unavailable');
  expect(classifyStatus(200)).toBe('reachable');
  expect(retryDelay(1, '300')).toBe(10000);
  expect(retryDelay(2, null)).toBe(2000);
});
