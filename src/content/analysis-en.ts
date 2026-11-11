export const analysisCopy = {
  coverage: 'Comparison completeness',
  allThree:
    'Across all three indicators in this snapshot for your selected countries. Completeness describes data availability only.',
  latestComplete: 'Use latest complete year',
  noCompleteYear: 'No complete common year',
  noneComplete:
    'No year in this snapshot has all three indicators for every selected country. Missing values remain missing.',
  sameComplete: 'You are viewing the latest complete common year.',
  availability: 'Check annual data availability',
  year: 'Year',
  observed: 'Reported values',
  missing: 'Missing values',
  calculated: 'Calculated observations',
  recordedBody:
    'Calculated from the saved World Bank WDI observations. This evidence stays tied to the original comparison.',
  calculatedBody:
    'Same-year differences for the chart indicator. These are arithmetic results, not explanations or a country ranking.',
  percentagePoints: 'pp = percentage points.',
  precision:
    'Each difference is the first country’s reported value minus the second country’s reported value. Calculations use full source precision; displayed results are rounded to one decimal place, so subtracting rounded chart labels can differ.',
  missingPair: 'Not calculated — at least one value is missing.',
  missingPairShort: 'Not calculated',
  sourceDetails: 'Inspect source values and calculation',
  source: 'Source observation',
  collected: 'Collected',
  raw: 'Raw reference',
  provider: 'Original provider',
  unrounded: 'Unrounded value',
  noObservation: 'No observation',
  referenceYear: 'Reference year',
  snapshot: 'Snapshot',
  record: 'Use calculated observations in notebook',
  recordHelp:
    'Keep the calculation and its sources with the comparison context. Add your interpretation and follow-up questions separately.',
} as const;
