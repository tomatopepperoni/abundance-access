import { z } from 'zod';
import { indicatorCodeSchema, yearSchema, type Snapshot } from './schema';
import { defaultYear, type DataStore } from './query';

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
export const emptyDraft = (): Research['draft'] => ({ facts: '', questions: '', context: null });
export const hasDraftText = (draft: Research['draft']) =>
  Boolean(draft.facts.trim() || draft.questions.trim());
export const sameSelection = (a: Selection, b: Selection) =>
  a.year === b.year &&
  a.indicatorCode === b.indicatorCode &&
  a.countryCodes.length === b.countryCodes.length &&
  a.countryCodes.every((code) => b.countryCodes.includes(code));

export function editDraft(
  research: Research,
  patch: Partial<Pick<Research['draft'], 'facts' | 'questions'>>,
  datasetRunId: string,
): Research {
  const draft = { ...research.draft, ...patch };
  if (!hasDraftText(draft)) return { ...research, draft: emptyDraft() };
  if (!hasDraftText(research.draft) && research.selection.countryCodes.length)
    draft.context = { selection: structuredClone(research.selection), datasetRunId };
  return { ...research, draft };
}

export function assignDraftContext(research: Research, datasetRunId: string): Research {
  if (
    research.draft.context ||
    !hasDraftText(research.draft) ||
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
    !hasDraftText(draft) ||
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
      },
    ],
    draft: emptyDraft(),
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
