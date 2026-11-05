import { compare, definitions, indicator } from './query';
import type { DataStore } from './query';
import { hasDraftContent, sameSelection, type Research } from './research';
import { formatDifference, type ComparisonSummary } from './analysis';
import { exportCopy } from '../content/export-en';
import { frozenSourceReference } from './provenance';

export const exportScopes = ['comparison', 'related', 'workspace'] as const;
export type ExportScope = (typeof exportScopes)[number];

export function exportSelection(store: DataStore, research: Research, scope: ExportScope) {
  if (!exportScopes.includes(scope)) throw new Error('Unknown export scope');
  const matching = (context: { selection: Research['selection']; datasetRunId: string }) =>
    context.datasetRunId === store.snapshot.runId &&
    sameSelection(context.selection, research.selection);
  const draft =
    hasDraftContent(research.draft) &&
    (scope === 'workspace' ||
      (scope === 'related' && research.draft.context && matching(research.draft.context)))
      ? research.draft
      : null;
  const notes =
    scope === 'workspace'
      ? research.notes
      : scope === 'related'
        ? research.notes.filter(matching)
        : [];
  return { scope, draft, notes };
}

export function canExport(store: DataStore, research: Research, scope: ExportScope) {
  const included = exportSelection(store, research, scope);
  return Boolean(
    research.selection.countryCodes.length ||
    (scope === 'workspace' && (included.draft || included.notes.length)),
  );
}

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
export function exportCSV(store: DataStore, research: Research, scope: ExportScope = 'comparison') {
  const included = exportSelection(store, research, scope);
  const headers = [
    'recordType',
    'exportScope',
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
    'sourceUpdatedAt',
    'rawFile',
    'rawRow',
    'frozenSourceUrl',
    'rawSha256',
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
    'leftCountryCode',
    'rightCountryCode',
    'leftValue',
    'rightValue',
    'differencePercentagePoints',
    'investigationTopic',
    'investigationTargetGroup',
    'investigationLocality',
    'investigationEvidenceNeeded',
    'investigationSourceToCheck',
    'investigationStatus',
    'investigationDecisionToInform',
    'investigationStatusMeaning',
  ];
  const rows: Record<string, string | number | null>[] = reportRows(store, research).map((o) => ({
    recordType: 'observation',
    exportScope: scope,
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
    sourceUpdatedAt: o.sourceUpdatedAt,
    rawFile: o.rawFile,
    rawRow: o.rawRow,
    frozenSourceUrl: frozenSourceReference(store, o)?.url ?? null,
    rawSha256: frozenSourceReference(store, o)?.sha256 ?? null,
    datasetRunId: store.snapshot.runId,
  }));
  rows.unshift({
    recordType: 'export-metadata',
    exportScope: scope,
    datasetRunId: store.snapshot.runId,
  });
  if (included.draft) {
    const context = included.draft.context;
    rows.push({
      recordType: 'draft',
      noteCountryCodes: context?.selection.countryCodes.join(';') ?? '',
      noteYear: context?.selection.year ?? null,
      noteIndicator: context?.selection.indicatorCode ?? '',
      noteDatasetRunId: context?.datasetRunId ?? '',
      contextStatus: context ? 'recorded' : 'unassigned',
      observedFacts: included.draft.facts,
      additionalQuestions: included.draft.questions,
    });
  }
  rows.push(
    ...included.notes.map((note) => ({
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
  const appendEvidence = (summary: ComparisonSummary, noteId: string) => {
    const context = {
      noteId,
      noteCountryCodes: summary.countryCodes.join(';'),
      noteYear: summary.year,
      noteIndicator: summary.indicatorCode,
      noteDatasetRunId: summary.snapshotRunId,
      datasetRunId: summary.snapshotRunId,
      contextStatus: 'recorded',
    };
    rows.push(
      ...summary.observations.map((row) => ({
        ...row,
        ...context,
        recordType: 'evidence-observation',
        frozenSourceUrl:
          summary.snapshotRunId === store.snapshot.runId
            ? (frozenSourceReference(store, row)?.url ?? null)
            : null,
        rawSha256:
          summary.snapshotRunId === store.snapshot.runId
            ? (frozenSourceReference(store, row)?.sha256 ?? null)
            : null,
      })),
    );
    rows.push(
      ...summary.pairs.map((pair) => ({
        ...context,
        recordType: 'calculated-comparison',
        indicatorCode: summary.indicatorCode,
        year: summary.year,
        unit: pair.unit,
        status: pair.difference === null ? 'not-calculated-missing' : 'calculated',
        leftCountryCode: pair.leftCountryCode,
        rightCountryCode: pair.rightCountryCode,
        leftValue: summary.observations.find((row) => row.countryCode === pair.leftCountryCode)!
          .value,
        rightValue: summary.observations.find((row) => row.countryCode === pair.rightCountryCode)!
          .value,
        differencePercentagePoints: pair.difference,
      })),
    );
  };
  if (included.draft?.evidence) appendEvidence(included.draft.evidence, 'draft');
  for (const note of included.notes) if (note.evidence) appendEvidence(note.evidence, note.id);
  const appendInvestigation = (
    investigation: NonNullable<Research['draft']['investigation']>,
    noteId: string,
    context: Research['draft']['context'],
  ) =>
    rows.push({
      recordType: 'investigation-plan',
      exportScope: scope,
      noteId,
      noteCountryCodes: context?.selection.countryCodes.join(';') ?? '',
      noteYear: context?.selection.year ?? null,
      noteIndicator: context?.selection.indicatorCode ?? '',
      noteDatasetRunId: context?.datasetRunId ?? '',
      contextStatus: context ? 'recorded' : 'unassigned',
      investigationTopic: investigation.topic,
      investigationTargetGroup: investigation.targetGroup,
      investigationLocality: investigation.locality,
      investigationEvidenceNeeded: investigation.evidenceNeeded,
      investigationSourceToCheck: investigation.sourceToCheck,
      investigationStatus: investigation.status,
      investigationDecisionToInform: investigation.decisionToInform,
      investigationStatusMeaning: exportCopy.planStatusMeaning,
    });
  if (included.draft?.investigation)
    appendInvestigation(included.draft.investigation, 'draft', included.draft.context);
  for (const note of included.notes)
    if (note.investigation)
      appendInvestigation(note.investigation, note.id, {
        selection: note.selection,
        datasetRunId: note.datasetRunId,
      });
  return (
    '\uFEFF' +
    [
      headers,
      ...rows.map((row) =>
        headers.map((key) => (key === 'exportScope' ? scope : (row[key] ?? null))),
      ),
    ]
      .map((row) => row.map(csvCell).join(','))
      .join('\r\n')
  );
}
export function exportMarkdown(
  store: DataStore,
  research: Research,
  scope: ExportScope = 'comparison',
) {
  const included = exportSelection(store, research, scope);
  const escape = (s: string) => s.replaceAll('|', '\\|').replaceAll('\n', ' ');
  const rows = reportRows(store, research);
  const frozen = (row: (typeof rows)[number], snapshotRunId = store.snapshot.runId) => {
    if (snapshotRunId !== store.snapshot.runId) return '';
    const reference = frozenSourceReference(store, row);
    return reference
      ? `; frozen raw response: ${reference.url}; SHA-256: ${reference.sha256}; response record index: ${reference.rawRecordIndex}`
      : '';
  };
  const note = (facts: string, questions: string) =>
    `\n### User-authored observations\n\n${facts || '(No observations recorded)'}\n\n### Additional research questions — not established conclusions\n\n${questions || '(No questions recorded)'}\n`;
  const context = included.draft?.context;
  const evidence = (summary?: ComparisonSummary) => {
    if (!summary) return '';
    return `\n### Calculated observations — recorded source arithmetic\n\nSnapshot: ${summary.snapshotRunId}; indicator: ${summary.indicatorCode}; year: ${summary.year}.\n\nDifferences use full source precision; pp means percentage points. These calculations do not establish causes or educational outcomes.\n\n${summary.pairs
      .map((pair) => {
        const left = summary.observations.find((row) => row.countryCode === pair.leftCountryCode)!;
        const right = summary.observations.find(
          (row) => row.countryCode === pair.rightCountryCode,
        )!;
        return pair.difference === null
          ? `- ${left.countryName} − ${right.countryName}: not calculated; at least one value is missing.`
          : `- ${left.countryName} − ${right.countryName}: ${formatDifference(pair.difference)}; full-precision calculation: ${left.value} − ${right.value} = ${pair.difference} percentage points.`;
      })
      .join(
        '\n',
      )}\n\nRecorded source observations:\n\n${summary.observations.map((row) => `- ${row.countryCode}, ${row.year}: ${row.value ?? 'No observation'} ${row.unit}; ${row.status}; ${row.sourceOrganization}; distributed by ${row.distributor}; fetched ${row.fetchedAt}; raw ${row.rawFile ?? 'none'}, row ${row.rawRow ?? 'none'}; ${row.sourceUrl}${frozen(row, summary.snapshotRunId)}`).join('\n')}\n`;
  };
  const investigation = (plan?: Research['draft']['investigation']) => {
    if (!plan) return '';
    return `\n### Follow-up investigation — user-authored plan\n\n- Topic: ${plan.topic}\n- Target learners or group: ${plan.targetGroup || '(Not specified)'}\n- Locality: ${plan.locality || '(Not specified)'}\n- Evidence needed: ${plan.evidenceNeeded || '(Not specified)'}\n- Source to check: ${plan.sourceToCheck || '(Not specified)'}\n- Status: ${plan.status}\n- Decision to inform: ${plan.decisionToInform || '(Not specified)'}\n\n${exportCopy.planStatusMeaning}\n`;
  };
  const draftContext = context
    ? `Draft dataset: ${context.datasetRunId}\n\nDraft countries/economies: ${context.selection.countryCodes.join(', ')}\n\nDraft indicator: ${context.selection.indicatorCode}\n\nDraft year: ${context.selection.year}`
    : 'Draft context: UNASSIGNED. The original country, year, indicator and snapshot were not recorded. Review before assigning a context.';
  const draftSection = included.draft
    ? `\n## Current draft — separate recorded context\n\n${draftContext}\n${evidence(included.draft.evidence)}${note(included.draft.facts, included.draft.questions)}${investigation(included.draft.investigation)}`
    : '';
  const notesSection = included.notes.length
    ? `\n## Saved notes\n\n${included.notes.map((n) => `### ${n.createdAt}\n\nDataset: ${n.datasetRunId}; ${n.selection.countryCodes.join(', ')}; ${n.selection.indicatorCode}; ${n.selection.year}\n${evidence(n.evidence)}${note(n.facts, n.questions)}${investigation(n.investigation)}`).join('\n')}`
    : '';
  return `# Abundance Access — research snapshot\n\nAnnual statistics, not live conditions.\n\nExport scope: **${exportCopy.options[scope]}** (${scope}).\n\n${exportCopy.help[scope]}\n\nIncluded notes: ${included.notes.length} saved; ${included.draft ? 1 : 0} draft.\n\n## Current comparison\n\n- Dataset: ${store.snapshot.runId}\n- Collection completed (UTC): ${store.snapshot.fetchedAt}\n- Manual metadata review: ${definitions.reviewedAt}\n- Selected year: ${research.selection.year}\n- Focused indicator: ${research.selection.indicatorCode}\n- Countries/economies: ${research.selection.countryCodes.join(', ')}\n\n| Country/economy | Indicator | Year | Value | Unit | Status |\n|---|---|---|---|---|---|\n${rows.map((o) => `| ${escape(o.countryName)} | ${o.indicatorCode} | ${o.year} | ${o.value ?? 'No observation'} | ${o.unit} | ${o.status} |`).join('\n')}\n\n## Source trail\n\n${rows.map((o) => `- ${o.countryCode}, ${o.indicatorCode}, ${o.year}: ${o.sourceOrganization}; distributed by World Bank; fetched ${o.fetchedAt}; ${o.sourceUrl}${frozen(o)}`).join('\n')}\n${draftSection}${notesSection}\n## Definitions and limits\n\n${definitions.indicators.map((i) => `- **${i.name}**: ${i.definition} ${i.limitation} ${i.metadataUrl}`).join('\n')}\n\nNo composite score, individual diagnosis, causal explanation, or proof of educational effectiveness is provided. Country averages can conceal local, gender, income, and accessibility differences. Missing observations have not been filled with zero or carried forward. Values above 100 in ${indicator('SE.SEC.CMPT.LO.ZS').shortName} are retained.\n`;
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
