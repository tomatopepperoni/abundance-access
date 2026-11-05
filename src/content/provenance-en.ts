export const provenanceCopy = {
  open: 'Open saved raw response',
  unavailable: 'No published raw-response link is available for this recorded observation.',
  recordIndex: 'Record index (zero-based)',
  recordHelp:
    'Find this index in the second array of the saved API response: response[1][index]. It is not a file line number.',
  hash: 'Response SHA-256',
  archived:
    'Saved response at a fixed source-code revision. The hash checks file integrity; it does not establish the accuracy of the statistic.',
  comparability:
    'Same year does not establish the same measurement method. Country-specific survey, estimate and method-change notes have not been collected in this snapshot.',
} as const;
