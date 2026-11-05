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
export const emptyInvestigation = (topic: InvestigationTopic): Investigation => ({
  topic,
  targetGroup: '',
  locality: '',
  evidenceNeeded: '',
  sourceToCheck: '',
  status: 'unverified',
  decisionToInform: '',
});
