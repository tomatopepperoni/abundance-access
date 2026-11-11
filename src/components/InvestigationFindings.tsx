import { useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { findingsCopy as f } from '../content/findings-en';
import {
  findingsLimits,
  findingsStatusSchema,
  investigationFindingsSchema,
  type InvestigationFindings as Findings,
  type InvestigationFindingsDraft as FindingsDraft,
} from '../lib/investigation';

const emptyDraft: FindingsDraft = {
  status: 'found',
  sourceTitle: '',
  sourceUrl: '',
  checkedOn: '',
  referencePeriod: '',
  locality: '',
  targetGroup: '',
  summary: '',
  uncertainty: '',
};

export function InvestigationFindings({
  value,
  draft,
  onDraftChange,
  onSave,
}: {
  value: Findings | undefined;
  draft: FindingsDraft | undefined;
  onDraftChange: (value: FindingsDraft | undefined) => void;
  onSave: (value: Findings) => void;
}) {
  const headingId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const outcome = useRef<HTMLSelectElement>(null);
  const returnFocus = useRef(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const input = draft ?? value ?? emptyDraft;

  const change = <K extends keyof FindingsDraft>(field: K, value: FindingsDraft[K]) => {
    setError('');
    onDraftChange({ ...input, [field]: value });
  };

  useLayoutEffect(() => {
    if (editing) outcome.current?.focus();
    else if (returnFocus.current) {
      returnFocus.current = false;
      trigger.current?.focus();
    }
  }, [editing]);

  const close = () => {
    returnFocus.current = true;
    setEditing(false);
  };
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const result = investigationFindingsSchema.safeParse(Object.fromEntries(new FormData(form)));
    if (!result.success) {
      const field = result.error.issues[0].path[0] as keyof typeof f.fields;
      setError(field === 'sourceUrl' ? f.invalidUrl : `${f.invalid} — ${f.fields[field]}.`);
      (form.elements.namedItem(field) as HTMLElement | null)?.focus();
      return;
    }
    onSave(result.data);
    close();
  };
  const fields = [
    'status',
    'sourceTitle',
    'sourceUrl',
    'checkedOn',
    'referencePeriod',
    'locality',
    'targetGroup',
    'summary',
    'uncertainty',
  ] as const;

  return (
    <section className="saved-investigation saved-findings" aria-labelledby={headingId}>
      <h4 id={headingId}>{f.heading}</h4>
      {editing ? (
        <form className="investigation-fields" aria-labelledby={headingId} onSubmit={save}>
          <p className="small muted">{f.required}</p>
          <p className="small muted">{f.draftHelp}</p>
          <div className="investigation-grid">
            <label>
              <span>{f.fields.status}</span>
              <select
                ref={outcome}
                name="status"
                value={input.status}
                onChange={(event) => change('status', event.target.value as Findings['status'])}
              >
                {findingsStatusSchema.options.map((option) => (
                  <option value={option} key={option}>
                    {f.statuses[option]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{f.fields.checkedOn}</span>
              <input
                type="date"
                name="checkedOn"
                required
                value={input.checkedOn}
                onChange={(event) => change('checkedOn', event.target.value)}
              />
            </label>
            <label>
              <span>{f.fields.sourceTitle}</span>
              <input
                name="sourceTitle"
                value={input.sourceTitle}
                onChange={(event) => change('sourceTitle', event.target.value)}
                maxLength={findingsLimits.sourceTitle}
                required={input.status === 'found'}
              />
            </label>
            <label>
              <span>{f.fields.sourceUrl}</span>
              <input
                type="url"
                name="sourceUrl"
                value={input.sourceUrl}
                onChange={(event) => change('sourceUrl', event.target.value)}
                maxLength={findingsLimits.sourceUrl}
              />
            </label>
            {(['referencePeriod', 'locality', 'targetGroup'] as const).map((field) => (
              <label key={field}>
                <span>{f.fields[field]}</span>
                <input
                  name={field}
                  value={input[field]}
                  onChange={(event) => change(field, event.target.value)}
                  maxLength={findingsLimits[field]}
                />
              </label>
            ))}
          </div>
          {(['summary', 'uncertainty'] as const).map((field) => (
            <label key={field}>
              <span>{f.fields[field]}</span>
              <textarea
                name={field}
                rows={3}
                value={input[field]}
                onChange={(event) => change(field, event.target.value)}
                maxLength={findingsLimits[field]}
                required={field === 'summary' && input.status === 'found'}
              />
            </label>
          ))}
          {error && <p role="alert">{error}</p>}
          <div className="findings-actions">
            <button type="submit" className="button dark">
              {f.save}
            </button>
            <button
              type="button"
              className="button outline"
              onClick={() => {
                onDraftChange(undefined);
                close();
              }}
            >
              {f.cancel}
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="small muted">{draft ? f.draftPending : value ? f.help : f.empty}</p>
          {value && (
            <dl className="source-facts">
              {fields.map((field) => (
                <div key={field}>
                  <dt>{f.fields[field]}</dt>
                  <dd>
                    {field === 'status' ? (
                      f.statuses[value.status]
                    ) : field === 'sourceUrl' && value.sourceUrl ? (
                      <a
                        href={value.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-link"
                      >
                        {value.sourceUrl}
                      </a>
                    ) : (
                      value[field] || f.none
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <button
            className="button outline"
            ref={trigger}
            onClick={() => {
              setError('');
              setEditing(true);
            }}
          >
            {draft ? f.resume : value ? f.edit : f.record}
          </button>
        </>
      )}
    </section>
  );
}
