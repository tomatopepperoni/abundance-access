import { z } from 'zod';

export const investigationTopicSchema = z.enum([
  'connection-costs',
  'devices',
  'power-reliability',
  'learning-support',
]);
export const investigationSchema = z.object({
  topic: investigationTopicSchema,
  targetGroup: z.string().max(300),
  locality: z.string().max(300),
  evidenceNeeded: z.string().max(1200),
  sourceToCheck: z.string().max(1000),
  status: z.enum(['unverified', 'checking', 'reviewed']),
  decisionToInform: z.string().max(1200),
});
export type InvestigationTopic = z.infer<typeof investigationTopicSchema>;
export type Investigation = z.infer<typeof investigationSchema>;
export const findingsStatusSchema = z.enum(['found', 'not-found', 'deferred']);
export const findingsLimits = {
  sourceTitle: 300,
  sourceUrl: 2048,
  referencePeriod: 120,
  locality: 300,
  targetGroup: 300,
  summary: 2000,
  uncertainty: 2000,
} as const;

export const investigationFindingsDraftSchema = z.object({
  status: findingsStatusSchema,
  sourceTitle: z.string().max(findingsLimits.sourceTitle),
  sourceUrl: z.string().max(findingsLimits.sourceUrl),
  checkedOn: z.string().max(16),
  referencePeriod: z.string().max(findingsLimits.referencePeriod),
  locality: z.string().max(findingsLimits.locality),
  targetGroup: z.string().max(findingsLimits.targetGroup),
  summary: z.string().max(findingsLimits.summary),
  uncertainty: z.string().max(findingsLimits.uncertainty),
});
export type InvestigationFindingsDraft = z.infer<typeof investigationFindingsDraftSchema>;

export const investigationFindingsSchema = investigationFindingsDraftSchema
  .extend({
    sourceTitle: z.string().trim().max(findingsLimits.sourceTitle),
    sourceUrl: z.union([
      z.literal(''),
      z
        .url({ protocol: /^https?$/ })
        .regex(/^https?:\/\//i)
        .max(findingsLimits.sourceUrl),
    ]),
    checkedOn: z.iso.date(),
    referencePeriod: z.string().trim().max(findingsLimits.referencePeriod),
    locality: z.string().trim().max(findingsLimits.locality),
    targetGroup: z.string().trim().max(findingsLimits.targetGroup),
    summary: z.string().trim().max(findingsLimits.summary),
    uncertainty: z.string().trim().max(findingsLimits.uncertainty),
  })
  .refine(({ status, sourceTitle }) => status !== 'found' || Boolean(sourceTitle), {
    path: ['sourceTitle'],
  })
  .refine(({ status, summary }) => status !== 'found' || Boolean(summary), {
    path: ['summary'],
  });
export type InvestigationFindings = z.infer<typeof investigationFindingsSchema>;

export const emptyInvestigation = (topic: InvestigationTopic): Investigation => ({
  topic,
  targetGroup: '',
  locality: '',
  evidenceNeeded: '',
  sourceToCheck: '',
  status: 'unverified',
  decisionToInform: '',
});
