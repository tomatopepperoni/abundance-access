export const exportCopy = {
  title: 'Choose what to export',
  scope: 'Export scope',
  options: {
    comparison: 'Current comparison only',
    related: 'Comparison + matching notes',
    workspace: 'Entire workspace',
  },
  note: {
    title: 'Saved note only',
    help: 'Includes this saved note, its original context and any recorded evidence or findings.',
    noEvidence: 'No source observations were saved with this note.',
    definitionHeading: 'Current indicator definition and limits',
  },
  help: {
    comparison:
      'Exports the current values and sources. Drafts, saved notes and investigation plans are excluded.',
    related:
      'Includes notes, drafts and recorded findings with the same countries, year, focused indicator and snapshot.',
    workspace:
      'Includes all saved notes, the current draft, plans and recorded findings, including other countries, years and older snapshots. Review before sharing.',
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
  findingsMeaning: 'User-recorded follow-up. Verify its source and scope before citing it.',
} as const;
