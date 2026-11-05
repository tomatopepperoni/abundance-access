import { z } from 'zod';
import { indicatorCodeSchema, yearSchema, type Snapshot } from './schema';
import { defaultYear, type DataStore } from './query';
import { comparisonSummarySchema, type ComparisonSummary } from './analysis';
import {
  investigationSchema,
  investigationTopicSchema,
  emptyInvestigation,
  type InvestigationTopic,
} from './investigation';

export const STORAGE_KEY = 'abundance-access:research:v1';
export const RESEARCH_SCHEMA_VERSION = 2;
const selectionSchema = z.object({
  countryCodes: z.array(z.string()).max(3),
  indicatorCode: indicatorCodeSchema,
  year: yearSchema,
});
const noteSchema = z.object({
  id: z.string(),
  createdAt: z.iso.datetime(),
  datasetRunId: z.string(),
  selection: selectionSchema,
  facts: z.string().max(6000),
  questions: z.string().max(6000),
  evidence: comparisonSummarySchema.optional(),
  investigation: investigationSchema.optional(),
});
const draftContextSchema = z.object({
  selection: selectionSchema,
  datasetRunId: z.string().min(1).max(200),
});
export const researchSchema = z.object({
  schemaVersion: z.literal(RESEARCH_SCHEMA_VERSION),
  selection: selectionSchema,
  search: z.string().max(200),
  region: z.string(),
  draft: z.object({
    facts: z.string().max(6000),
    questions: z.string().max(6000),
    context: draftContextSchema.nullable(),
    evidence: comparisonSummarySchema.optional(),
    investigation: investigationSchema.optional(),
  }),
  notes: z.array(noteSchema).max(100),
});
const legacyResearchSchema = researchSchema.extend({
  schemaVersion: z.literal(1),
  draft: z.object({ facts: z.string().max(6000), questions: z.string().max(6000) }),
});
export type Selection = z.infer<typeof selectionSchema>;
export type Research = z.infer<typeof researchSchema>;
export type ResearchNote = z.infer<typeof noteSchema>;
export type DraftPatch = Partial<Pick<Research['draft'], 'facts' | 'questions' | 'investigation'>>;
export const emptyDraft = (): Research['draft'] => ({ facts: '', questions: '', context: null });
export const hasDraftText = (draft: Research['draft']) =>
  Boolean(draft.facts.trim() || draft.questions.trim());
export const hasDraftContent = (draft: Research['draft']) =>
  hasDraftText(draft) || Boolean(draft.evidence) || Boolean(draft.investigation);
export const sameSelection = (a: Selection, b: Selection) =>
  a.year === b.year &&
  a.indicatorCode === b.indicatorCode &&
  a.countryCodes.length === b.countryCodes.length &&
  a.countryCodes.every((code) => b.countryCodes.includes(code));

export function editDraft(research: Research, patch: DraftPatch, datasetRunId: string): Research {
  const draft = { ...research.draft, ...patch };
  if (!hasDraftContent(draft)) return { ...research, draft: emptyDraft() };
  if (!hasDraftContent(research.draft) && research.selection.countryCodes.length)
    draft.context = { selection: structuredClone(research.selection), datasetRunId };
  return { ...research, draft };
}

export function assignDraftContext(research: Research, datasetRunId: string): Research {
  if (
    research.draft.context ||
    !hasDraftContent(research.draft) ||
    !research.selection.countryCodes.length
  )
    return research;
  return {
    ...research,
    draft: {
      ...research.draft,
      context: { selection: structuredClone(research.selection), datasetRunId },
    },
  };
}

export function addDraftNote(research: Research, id: string, createdAt: string): Research {
  const { draft } = research;
  if (
    !draft.context?.selection.countryCodes.length ||
    !hasDraftContent(draft) ||
    research.notes.length >= 100
  )
    return research;
  return {
    ...research,
    notes: [
      ...research.notes,
      {
        id,
        createdAt,
        datasetRunId: draft.context.datasetRunId,
        selection: structuredClone(draft.context.selection),
        facts: draft.facts,
        questions: draft.questions,
        ...(draft.evidence ? { evidence: structuredClone(draft.evidence) } : {}),
        ...(draft.investigation ? { investigation: structuredClone(draft.investigation) } : {}),
      },
    ],
    draft: emptyDraft(),
  };
}
export function attachCalculatedEvidence(
  research: Research,
  evidence: ComparisonSummary,
): Research {
  const valid = comparisonSummarySchema.parse(evidence);
  const selection: Selection = {
    countryCodes: valid.countryCodes,
    indicatorCode: valid.indicatorCode,
    year: valid.year,
  };
  if (
    hasDraftContent(research.draft) &&
    (!research.draft.context ||
      research.draft.context.datasetRunId !== valid.snapshotRunId ||
      !sameSelection(research.draft.context.selection, selection))
  )
    return research;
  return {
    ...research,
    draft: {
      ...research.draft,
      evidence: valid,
      context: { selection: structuredClone(selection), datasetRunId: valid.snapshotRunId },
    },
  };
}
export function removeCalculatedEvidence(research: Research): Research {
  const { evidence: _evidence, ...draft } = research.draft;
  return { ...research, draft: hasDraftContent(draft) ? draft : emptyDraft() };
}
export function startInvestigation(
  research: Research,
  topic: InvestigationTopic,
  datasetRunId: string,
): Research {
  investigationTopicSchema.parse(topic);
  if (!research.selection.countryCodes.length || research.draft.investigation) return research;
  if (
    hasDraftContent(research.draft) &&
    (!research.draft.context ||
      research.draft.context.datasetRunId !== datasetRunId ||
      !sameSelection(research.draft.context.selection, research.selection))
  )
    return research;
  return {
    ...research,
    draft: {
      ...research.draft,
      investigation: emptyInvestigation(topic),
      context: { selection: structuredClone(research.selection), datasetRunId },
    },
  };
}
export function defaultResearch(store: DataStore): Research {
  return {
    schemaVersion: 2,
    selection: {
      countryCodes: ['KOR', 'KEN'].filter((c) => store.countryByCode.has(c)),
      indicatorCode: 'IT.NET.USER.ZS',
      year: defaultYear(store),
    },
    search: '',
    region: 'all',
    draft: emptyDraft(),
    notes: [],
  };
}
export function validateResearch(value: unknown, snapshot: Snapshot): Research {
  const current = researchSchema.safeParse(value);
  const data: Research = current.success
    ? current.data
    : (() => {
        const legacy = legacyResearchSchema.parse(value);
        // Earlier drafts did not record their context. Preserve the text without guessing it.
        return { ...legacy, schemaVersion: 2, draft: { ...legacy.draft, context: null } };
      })();
  const countries = new Set(snapshot.countries.map((c) => c.code));
  for (const selection of [
    data.selection,
    ...data.notes.map((n) => n.selection),
    ...(data.draft.context ? [data.draft.context.selection] : []),
  ]) {
    if (
      new Set(selection.countryCodes).size !== selection.countryCodes.length ||
      selection.countryCodes.some((c) => !countries.has(c))
    )
      throw new Error('Invalid saved country selection');
  }
  if (data.region !== 'all' && !snapshot.countries.some((c) => c.region === data.region))
    throw new Error('Unknown saved region');
  if (new Set(data.notes.map((n) => n.id)).size !== data.notes.length)
    throw new Error('Duplicate note id');
  for (const record of [
    ...data.notes.map((note) => ({
      evidence: note.evidence,
      context: { selection: note.selection, datasetRunId: note.datasetRunId },
    })),
    { evidence: data.draft.evidence, context: data.draft.context },
  ]) {
    if (!record.evidence) continue;
    const summary = record.evidence;
    if (
      !record.context ||
      record.context.datasetRunId !== summary.snapshotRunId ||
      !sameSelection(record.context.selection, {
        countryCodes: summary.countryCodes,
        indicatorCode: summary.indicatorCode,
        year: summary.year,
      }) ||
      summary.countryCodes.some((code) => !countries.has(code))
    )
      throw new Error('Calculated evidence context mismatch');
    if (
      summary.snapshotRunId === snapshot.runId &&
      summary.observations.some(
        (row) =>
          JSON.stringify(
            snapshot.observations.find(
              (source) =>
                source.countryCode === row.countryCode &&
                source.indicatorCode === row.indicatorCode &&
                source.year === row.year,
            ),
          ) !== JSON.stringify(row),
      )
    )
      throw new Error('Calculated evidence differs from the current source snapshot');
  }
  return data;
}
export function loadResearch(store: DataStore, storage: Pick<Storage, 'getItem'>) {
  try {
    const text = storage.getItem(STORAGE_KEY);
    if (!text) return { data: defaultResearch(store), status: 'ok' as const };
    try {
      return { data: validateResearch(JSON.parse(text), store.snapshot), status: 'ok' as const };
    } catch {
      return { data: defaultResearch(store), status: 'invalid' as const };
    }
  } catch {
    return { data: defaultResearch(store), status: 'unavailable' as const };
  }
}
export function saveResearch(
  data: Research,
  storage: Pick<Storage, 'setItem' | 'removeItem'>,
  store: DataStore,
) {
  try {
    const valid = validateResearch(data, store.snapshot);
    if (JSON.stringify(valid) === JSON.stringify(defaultResearch(store)))
      storage.removeItem(STORAGE_KEY);
    else storage.setItem(STORAGE_KEY, JSON.stringify(valid));
    return true;
  } catch {
    return false;
  }
}
export function resetResearch(storage: Pick<Storage, 'removeItem'>) {
  try {
    storage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
