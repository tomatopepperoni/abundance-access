import { compare, definitions, indicator } from './query';
import type { DataStore } from './query';
import { hasDraftText, type Research } from './research';

export function csvCell(value: string | number | null) {
  const text = value === null ? '' : String(value);
  const safe = typeof value === 'string' && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function reportRows(store: DataStore, research: Research) {
  return compare(
    store,
    research.selection.countryCodes,
    definitions.indicators.map((i) => i.code),
    research.selection.year,
  );
}
export function exportCSV(store: DataStore, research: Research) {
  const headers = [
    'recordType',
    'countryCode',
    'countryName',
    'indicatorCode',
    'year',
    'value',
    'unit',
    'status',
    'sourceOrganization',
    'distributor',
    'sourceUrl',
    'fetchedAt',
    'datasetRunId',
    'noteId',
    'noteCreatedAt',
    'noteCountryCodes',
    'noteYear',
    'noteIndicator',
    'noteDatasetRunId',
    'contextStatus',
    'observedFacts',
    'additionalQuestions',
  ];
  const rows: Record<string, string | number | null>[] = reportRows(store, research).map((o) => ({
    recordType: 'observation',
    countryCode: o.countryCode,
    countryName: o.countryName,
    indicatorCode: o.indicatorCode,
    year: o.year,
    value: o.value,
    unit: o.unit,
    status: o.status,
    sourceOrganization: o.sourceOrganization,
    distributor: o.distributor,
    sourceUrl: o.sourceUrl,
    fetchedAt: o.fetchedAt,
    datasetRunId: store.snapshot.runId,
  }));
  if (hasDraftText(research.draft)) {
    const context = research.draft.context;
    rows.push({
      recordType: 'draft',
      noteCountryCodes: context?.selection.countryCodes.join(';') ?? '',
      noteYear: context?.selection.year ?? null,
      noteIndicator: context?.selection.indicatorCode ?? '',
      noteDatasetRunId: context?.datasetRunId ?? '',
      contextStatus: context ? 'recorded' : 'unassigned',
      observedFacts: research.draft.facts,
      additionalQuestions: research.draft.questions,
    });
  }
  rows.push(
    ...research.notes.map((note) => ({
      recordType: 'saved-note',
      noteId: note.id,
      noteCreatedAt: note.createdAt,
      noteCountryCodes: note.selection.countryCodes.join(';'),
      noteYear: note.selection.year,
      noteIndicator: note.selection.indicatorCode,
      noteDatasetRunId: note.datasetRunId,
      contextStatus: 'recorded',
      observedFacts: note.facts,
      additionalQuestions: note.questions,
    })),
  );
  return (
    '\uFEFF' +
    [headers, ...rows.map((row) => headers.map((key) => row[key] ?? null))]
      .map((row) => row.map(csvCell).join(','))
      .join('\r\n')
  );
}
export function exportMarkdown(store: DataStore, research: Research) {
  const escape = (s: string) => s.replaceAll('|', '\\|').replaceAll('\n', ' ');
  const rows = reportRows(store, research);
  const note = (facts: string, questions: string) =>
    `\n### User-authored observations\n\n${facts || '(No observations recorded)'}\n\n### Additional research questions — not established conclusions\n\n${questions || '(No questions recorded)'}\n`;
  const context = research.draft.context;
  const draftContext = context
    ? `Draft dataset: ${context.datasetRunId}\n\nDraft countries/economies: ${context.selection.countryCodes.join(', ')}\n\nDraft indicator: ${context.selection.indicatorCode}\n\nDraft year: ${context.selection.year}`
    : hasDraftText(research.draft)
      ? 'Draft context: UNASSIGNED. The original country, year, indicator and snapshot were not recorded. Review before assigning a context.'
      : '(No draft recorded)';
  return `# Abundance Access — research snapshot\n\nAnnual statistics, not live conditions.\n\n## Current comparison\n\n- Dataset: ${store.snapshot.runId}\n- Collection completed (UTC): ${store.snapshot.fetchedAt}\n- Manual metadata review: ${definitions.reviewedAt}\n- Selected year: ${research.selection.year}\n- Focused indicator: ${research.selection.indicatorCode}\n- Countries/economies: ${research.selection.countryCodes.join(', ')}\n\n| Country/economy | Indicator | Year | Value | Unit | Status |\n|---|---|---|---|---|---|\n${rows.map((o) => `| ${escape(o.countryName)} | ${o.indicatorCode} | ${o.year} | ${o.value ?? 'No observation'} | ${o.unit} | ${o.status} |`).join('\n')}\n\n## Source trail\n\n${rows.map((o) => `- ${o.countryCode}, ${o.indicatorCode}, ${o.year}: ${o.sourceOrganization}; distributed by World Bank; fetched ${o.fetchedAt}; ${o.sourceUrl}`).join('\n')}\n\n## Current draft — separate recorded context\n\n${draftContext}\n${note(research.draft.facts, research.draft.questions)}\n## Saved notes\n\n${research.notes.map((n) => `### ${n.createdAt}\n\nDataset: ${n.datasetRunId}; ${n.selection.countryCodes.join(', ')}; ${n.selection.indicatorCode}; ${n.selection.year}\n${note(n.facts, n.questions)}`).join('\n')}\n## Definitions and limits\n\n${definitions.indicators.map((i) => `- **${i.name}**: ${i.definition} ${i.limitation} ${i.metadataUrl}`).join('\n')}\n\nNo composite score, individual diagnosis, causal explanation, or proof of educational effectiveness is provided. Country averages can conceal local, gender, income, and accessibility differences. Missing observations have not been filled with zero or carried forward. Values above 100 in ${indicator('SE.SEC.CMPT.LO.ZS').shortName} are retained.\n`;
}
export function downloadText(name: string, text: string, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
