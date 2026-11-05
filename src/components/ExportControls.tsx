import { useId, useState } from 'react';
import { exportCopy as c } from '../content/export-en';
import { canExport, exportScopes, exportSelection, type ExportScope } from '../lib/export';
import type { DataStore } from '../lib/query';
import type { Research } from '../lib/research';
import { Icon } from './Icon';

export function ExportControls({
  store,
  research,
  onExport,
}: {
  store: DataStore;
  research: Research;
  onExport: (type: 'csv' | 'md', scope: ExportScope) => void;
}) {
  const [scope, setScope] = useState<ExportScope>('comparison');
  const id = useId();
  const included = exportSelection(store, research, scope);
  const enabled = canExport(store, research, scope);
  return (
    <section className="export-controls" aria-label={c.title}>
      <label className="export-scope-field" htmlFor={id}>
        <span>{c.scope}</span>
        <select
          id={id}
          value={scope}
          aria-describedby={`${id}-help`}
          onChange={(event) => setScope(event.target.value as ExportScope)}
        >
          {exportScopes.map((value) => (
            <option key={value} value={value}>
              {c.options[value]}
            </option>
          ))}
        </select>
      </label>
      <p id={`${id}-help`} className="small muted">
        {c.help[scope]}
      </p>
      <p className="small" role="status">
        {c.included}: {included.notes.length} {c.savedNotes} · {included.draft ? 1 : 0} {c.draft}
      </p>
      <div className="button-group">
        <button
          className="button outline"
          disabled={!enabled}
          onClick={() => onExport('csv', scope)}
        >
          <Icon name="download" size={16} />
          {c.csv}
        </button>
        <button
          className="button outline"
          disabled={!enabled}
          onClick={() => onExport('md', scope)}
        >
          <Icon name="download" size={16} />
          {c.markdown}
        </button>
      </div>
      {!enabled && <p className="small muted">{c.unavailable}</p>}
    </section>
  );
}
