export const exportCopy = {
  title: 'Choose what to export',
  scope: 'Export scope',
  options: {
    comparison: 'Current comparison only',
    related: 'Comparison + matching notes',
    workspace: 'Entire workspace',
  },
  help: {
    comparison:
      'Exports the current values and sources. Drafts, saved notes and investigation plans are excluded.',
    related:
      'Includes only notes and drafts with the same countries, year, focused indicator and snapshot. Other notes are excluded.',
    workspace:
      'Includes all saved notes, the current draft and their investigation plans, including other countries, years and older snapshots. Review before sharing.',
  },
  included: 'Included notes',
  draft: 'draft',
  savedNotes: 'saved',
  csv: 'Export CSV',
  markdown: 'Export Markdown',
  unavailable:
    'Select a country to export this comparison, or choose Entire workspace to export existing notes.',
  planStatusMeaning:
    'User-authored investigation status; not verification by this dashboard or proof of a conclusion.',
} as const;
