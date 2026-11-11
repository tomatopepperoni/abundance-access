import { c } from '../content/en';
import { indicator } from '../lib/query';
import type { DataStore } from '../lib/query';
import type { DraftPatch, Research, ResearchNote, Selection } from '../lib/research';
import { downloadText, exportNoteCSV, exportNoteMarkdown, type ExportScope } from '../lib/export';
import { hasDraftContent, sameSelection } from '../lib/research';
import { Controls } from './Controls';
import { Icon } from './Icon';
import { RecordedComparison } from './ComparisonEvidence';
import { sharingCopy as s } from '../content/sharing-en';
import { InvestigationFields, SavedInvestigation } from './Investigation';
import { InvestigationFindings } from './InvestigationFindings';
import type {
  InvestigationFindings as Findings,
  InvestigationFindingsDraft as FindingsDraft,
} from '../lib/investigation';
import { ExportControls } from './ExportControls';
import { exportCopy } from '../content/export-en';
export function Notebook({
  store,
  research,
  onDraftChange,
  onConfirmContext,
  storageAvailable,
  onSelection,
  onToggle,
  onSave,
  onSaveFindings,
  onFindingsDraftChange,
  onExport,
  onRemoveEvidence,
}: {
  store: DataStore;
  research: Research;
  onDraftChange: (patch: DraftPatch) => void;
  onConfirmContext: () => void;
  storageAvailable: boolean;
  onSelection: (patch: Partial<Selection>) => void;
  onToggle: (code: string) => void;
  onSave: () => void;
  onSaveFindings: (noteId: string, value: Findings) => void;
  onFindingsDraftChange: (noteId: string, value: FindingsDraft | undefined) => void;
  onExport: (type: 'csv' | 'md', scope: ExportScope) => void;
  onRemoveEvidence: () => void;
}) {
  const { selection, draft, notes } = research;
  const hasText = hasDraftContent(draft),
    context = draft.context;
  const contextSelection = context?.selection ?? selection;
  const contextChanged = Boolean(
    hasText && context && !sameSelection(context.selection, selection),
  );
  const downloadNote = (note: ResearchNote, format: 'csv' | 'md') => {
    const label = [...note.selection.countryCodes, note.selection.year].join('-');
    downloadText(
      `abundance-access-note-${label}.${format}`,
      format === 'csv' ? exportNoteCSV(store, note) : exportNoteMarkdown(store, note),
      format === 'csv' ? 'text/csv;charset=utf-8' : 'text/markdown;charset=utf-8',
    );
  };
  return (
    <>
      <Controls store={store} selection={selection} onChange={onSelection} onToggle={onToggle} />
      <section className="panel notebook-composer">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">{c.noteContext}</span>
            <h2 data-testid="draft-context">
              {hasText && !context
                ? c.draftUnassigned
                : `${indicator(contextSelection.indicatorCode).shortName} · ${contextSelection.year}`}
            </h2>
            <p>
              {hasText && !context
                ? c.draftNeedsContext
                : contextSelection.countryCodes
                    .map((code) => `${store.countryByCode.get(code)!.name} (${code})`)
                    .join(' · ') || c.selectedEmpty}
            </p>
            {context && (
              <span className="cell-note mono">
                {c.draftDataset}: {context.datasetRunId}
              </span>
            )}
          </div>
          <span className="soft-badge">{c.notebookDraft}</span>
        </div>
        {contextChanged && context && (
          <div className="draft-context-warning" role="status">
            <p>{c.draftFiltersChanged}</p>
            <button className="text-link" onClick={() => onSelection(context.selection)}>
              {c.restoreDraftSelection}
              <Icon name="arrow" size={16} />
            </button>
          </div>
        )}
        {context && context.datasetRunId !== store.snapshot.runId && (
          <p className="callout">{c.draftOlderSnapshot}</p>
        )}
        {hasText && !context && (
          <div className="draft-context-warning" role="status">
            <p>{c.draftUnknownContext}</p>
            <button
              className="button outline"
              disabled={!selection.countryCodes.length}
              onClick={onConfirmContext}
            >
              {c.assignDraftContext}
            </button>
          </div>
        )}
        {draft.evidence && (
          <div data-testid="draft-calculated-evidence" className="draft-calculated-evidence">
            <RecordedComparison summary={draft.evidence} store={store} />
            <p className="small muted">{s.evidenceExplanation}</p>
            <button className="text-link" onClick={onRemoveEvidence}>
              {s.removeEvidence}
            </button>
          </div>
        )}
        <InvestigationFields
          value={draft.investigation}
          onChange={(investigation) => onDraftChange({ investigation })}
        />
        <div className="note-fields">
          <label>
            <span>{c.facts}</span>
            <textarea
              rows={6}
              maxLength={6000}
              value={draft.facts}
              placeholder={c.factsPlaceholder}
              onChange={(e) => onDraftChange({ facts: e.target.value })}
            />
          </label>
          <label>
            <span>{c.questions}</span>
            <textarea
              rows={6}
              maxLength={6000}
              value={draft.questions}
              placeholder={c.questionsPlaceholder}
              onChange={(e) => onDraftChange({ questions: e.target.value })}
            />
          </label>
        </div>
        <div className="note-actions">
          <button
            className="button dark"
            disabled={!context?.selection.countryCodes.length || !hasText || notes.length >= 100}
            onClick={onSave}
          >
            <Icon name="notes" size={16} />
            {c.saveNote}
          </button>
          <span className="small muted">
            {notes.length} / 100 · {storageAvailable ? c.saved : c.session}
          </span>
        </div>
        {!storageAvailable && (
          <p className="callout" role="status">
            {c.sessionRetention}
          </p>
        )}
        {notes.length >= 100 && <p className="callout">{c.noteLimit}</p>}
      </section>
      <ExportControls store={store} research={research} onExport={onExport} />
      <section aria-labelledby="saved-notes-title">
        <div className="section-heading">
          <h2 id="saved-notes-title">{c.savedNotes}</h2>
          <span className="soft-badge">{notes.length}</span>
        </div>
        {!notes.length ? (
          <div className="panel empty-state">
            <Icon name="notes" size={32} />
            <p>{c.noNotes}</p>
          </div>
        ) : (
          <div className="saved-notes">
            {[...notes].reverse().map((note) => (
              <article className="panel saved-note" key={note.id}>
                <div className="saved-note-heading">
                  <span className="eyebrow">
                    {note.selection.countryCodes.join(' · ')} · {note.selection.year}
                  </span>
                  <time>{note.createdAt.replace('T', ' ').replace('Z', ' UTC')}</time>
                </div>
                <h3>{indicator(note.selection.indicatorCode).shortName}</h3>
                <span className="small muted mono">{note.datasetRunId}</span>
                {note.datasetRunId !== store.snapshot.runId && (
                  <p className="callout">{s.oldEvidence}</p>
                )}
                {note.evidence && <RecordedComparison summary={note.evidence} store={store} />}
                {note.investigation && <SavedInvestigation value={note.investigation} />}
                <div className="saved-note-text">
                  <div>
                    <h4>{c.factLabel}</h4>
                    <p>{note.facts || '—'}</p>
                  </div>
                  <div>
                    <h4>{c.questionLabel}</h4>
                    <p>{note.questions || '—'}</p>
                  </div>
                </div>
                {note.investigation && (
                  <InvestigationFindings
                    value={note.findings}
                    draft={note.findingsDraft}
                    onDraftChange={(value) => onFindingsDraftChange(note.id, value)}
                    onSave={(value) => onSaveFindings(note.id, value)}
                  />
                )}
                <button className="text-link" onClick={() => onSelection(note.selection)}>
                  {c.restoreNote}
                  <Icon name="arrow" size={14} />
                </button>
                <details className="note-export">
                  <summary>{c.exportNote}</summary>
                  <p className="small muted">{exportCopy.note.help}</p>
                  <div className="button-group">
                    <button className="button outline" onClick={() => downloadNote(note, 'csv')}>
                      {c.exportNoteCsv}
                    </button>
                    <button className="button outline" onClick={() => downloadNote(note, 'md')}>
                      {c.exportNoteMarkdown}
                    </button>
                  </div>
                </details>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
