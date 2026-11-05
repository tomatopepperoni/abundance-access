export const investigationCopy = {
  nextTitle: 'Choose what to investigate next',
  nextBody: 'National averages leave local questions open. Start a short investigation plan.',
  started:
    'Investigation plan started. Specify the intended learners, locality and evidence to check.',
  blocked:
    'Your existing investigation or draft context has been preserved. It is open below; save it before starting another plan.',
  topic: 'Access condition to investigate',
  topics: {
    'connection-costs': 'Connection costs',
    devices: 'Device access',
    'power-reliability': 'Power reliability',
    'learning-support': 'Learning support',
  },
  questions: {
    'connection-costs': 'What would a learner pay for enough data to use the course?',
    devices: 'Do intended learners have suitable devices they can use when needed?',
    'power-reliability': 'When and how often is usable power interrupted in the target community?',
    'learning-support':
      'What language, literacy or accessibility support do intended learners need?',
  },
  planTitle: 'Follow-up investigation plan',
  planBody:
    'Your research plan — not a finding or a recommendation generated from these statistics.',
  targetGroup: 'Target learners or group',
  targetPlaceholder: 'Who would this investigation concern?',
  locality: 'Target locality',
  localityPlaceholder: 'Which community, district or programme site?',
  evidenceNeeded: 'Evidence to collect',
  evidencePlaceholder: 'Name a specific measure, interview question or document to check.',
  sourceToCheck: 'Source to check',
  sourcePlaceholder: 'A local survey, provider tariff, organisation, report or URL.',
  status: 'Your investigation status',
  statuses: {
    unverified: 'Not checked',
    checking: 'In progress',
    reviewed: 'Reviewed by you',
  },
  statusHelp:
    'This status is your assessment. The tool does not verify your sources or conclusions.',
  decisionToInform: 'Decision this evidence would inform',
  decisionPlaceholder: 'What programme choice would you reconsider after checking the evidence?',
  remove: 'Remove investigation plan from draft',
  none: 'Not specified',
} as const;
