import { z } from 'zod';

export const linkStatusSchema = z.enum([
  'reachable',
  'restricted',
  'rate-limited',
  'unavailable',
  'transient',
]);
export const linkReportSchema = z.object({
  generatedAt: z.iso.datetime().nullable(),
  results: z.array(
    z.object({
      url: z.url(),
      title: z.string(),
      status: linkStatusSchema,
      httpStatus: z.number().int().nullable(),
      checkedAt: z.iso.datetime(),
      attempts: z.number().int().positive(),
      finalUrl: z.string().nullable(),
      detail: z.string(),
    }),
  ),
});
export type LinkStatus = z.infer<typeof linkStatusSchema>;

export function classifyStatus(status: number | null): LinkStatus {
  if (status === null || status === 408 || status >= 500) return 'transient';
  if (status === 403 || status === 401) return 'restricted';
  if (status === 429) return 'rate-limited';
  if (status >= 200 && status < 400) return 'reachable';
  return 'unavailable';
}
export function retryDelay(attempt: number, retryAfter: string | null, now = Date.now()): number {
  const requested =
    retryAfter === null
      ? 0
      : /^\d+$/.test(retryAfter)
        ? Number(retryAfter) * 1000
        : Math.max(0, Date.parse(retryAfter) - now);
  return Math.min(
    10000,
    Math.max(1000 * 2 ** (attempt - 1), Number.isFinite(requested) ? requested : 0),
  );
}
