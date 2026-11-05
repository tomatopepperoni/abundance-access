import { useState } from 'react';
import { sharingCopy as s } from '../content/sharing-en';
import { createComparisonLink } from '../lib/sharing';
import type { DataStore } from '../lib/query';
import type { Selection } from '../lib/research';

export function ShareComparison({ store, selection }: { store: DataStore; selection: Selection }) {
  const [open, setOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState('');
  const [failedLink, setFailedLink] = useState('');
  const link =
    selection.countryCodes.length >= 2
      ? createComparisonLink(window.location.href, selection, store)
      : '';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(link);
      setFailedLink('');
    } catch {
      setFailedLink(link);
      setCopiedLink('');
    }
  };
  return (
    <div className="share-comparison">
      <button
        className="text-link"
        disabled={!link}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {s.share}
      </button>
      {open && link && (
        <div className="share-link-panel">
          <p className="small">{s.scope}</p>
          <label>
            <span>{s.link}</span>
            <input
              type="text"
              readOnly
              value={link}
              onFocus={(event) => event.currentTarget.select()}
            />
          </label>
          <button className="button outline compact" onClick={copy}>
            {s.copy}
          </button>
          <p role="status" className="small">
            {copiedLink === link ? s.copied : failedLink === link ? s.manual : ''}
          </p>
        </div>
      )}
    </div>
  );
}
