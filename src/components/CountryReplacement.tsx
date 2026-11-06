import { useId, useLayoutEffect, useRef, useState } from 'react';
import { mapFinderCopy as m } from '../content/map-finder-en';
import type { DataStore } from '../lib/query';
import type { Selection } from '../lib/research';

type Replacement = {
  oldCode: string;
  newCode: string;
  oldName: string;
  newName: string;
};

export function CountryReplacement({
  store,
  selection,
  newCountryCode,
  onReplace,
  onCompare,
  open,
  onOpenChange,
  onReplaced,
  primary = false,
}: {
  store: DataStore;
  selection: Selection;
  newCountryCode: string;
  onReplace: (oldCountryCode: string, newCountryCode: string) => void;
  onCompare: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReplaced?: () => void;
  primary?: boolean;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const firstChoice = useRef<HTMLButtonElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const comparisonButton = useRef<HTMLButtonElement>(null);
  const successStatus = useRef<HTMLParagraphElement>(null);
  const [lastReplacement, setLastReplacement] = useState<Replacement | null>(null);
  const announced = useRef<Replacement | null>(null);
  const country = store.countryByCode.get(newCountryCode);
  const candidates = selection.countryCodes.flatMap((code) => {
    const current = store.countryByCode.get(code);
    return current ? [current] : [];
  });
  const canReplace = Boolean(
    country && candidates.length && !selection.countryCodes.includes(newCountryCode),
  );
  const visible = open && canReplace;
  const confirmed = Boolean(
    lastReplacement &&
    lastReplacement.newCode === newCountryCode &&
    selection.countryCodes.includes(lastReplacement.newCode) &&
    !selection.countryCodes.includes(lastReplacement.oldCode),
  );

  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (visible && !element.open) {
      element.showModal();
      firstChoice.current?.focus();
    } else if (!visible && element.open) {
      element.close();
    }
  }, [visible]);

  useLayoutEffect(() => {
    if (open && !canReplace) onOpenChange(false);
  }, [open, canReplace, onOpenChange]);

  useLayoutEffect(() => {
    if (confirmed && lastReplacement && announced.current !== lastReplacement) {
      announced.current = lastReplacement;
      onReplaced?.();
      requestAnimationFrame(() => {
        const next = comparisonButton.current ?? successStatus.current;
        next?.focus({ preventScroll: true });
        const bounds = next?.getBoundingClientRect();
        if (bounds && (bounds.top < 0 || bounds.bottom > window.innerHeight))
          next?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
      });
    }
  }, [confirmed, lastReplacement, onReplaced]);

  const cancel = () => {
    onOpenChange(false);
    requestAnimationFrame(() => trigger.current?.focus());
  };

  if (!country) return null;
  return (
    <div className={`map-replace-control${confirmed ? ' has-success' : ''}`}>
      {canReplace && (
        <button
          ref={trigger}
          type="button"
          className={`button ${primary ? 'dark' : 'outline'} map-replace-trigger`}
          aria-label={m.replaceLabel(country.name)}
          aria-haspopup="dialog"
          aria-expanded={visible}
          aria-controls={`${id}-dialog`}
          onClick={() => {
            setLastReplacement(null);
            onOpenChange(true);
          }}
        >
          {m.replace}
        </button>
      )}
      <dialog
        ref={dialog}
        id={`${id}-dialog`}
        className="map-replace-dialog"
        aria-labelledby={visible ? `${id}-heading` : undefined}
        aria-describedby={visible ? `${id}-help` : undefined}
        onKeyDown={(event) => {
          if (event.key !== 'Tab' || !visible) return;
          if (event.shiftKey && document.activeElement === firstChoice.current) {
            event.preventDefault();
            cancelButton.current?.focus();
          } else if (!event.shiftKey && document.activeElement === cancelButton.current) {
            event.preventDefault();
            firstChoice.current?.focus();
          }
        }}
        onCancel={(event) => {
          event.preventDefault();
          cancel();
        }}
        onClose={(event) => {
          if (open && !event.currentTarget.open) onOpenChange(false);
        }}
      >
        {visible && (
          <>
            <h3 id={`${id}-heading`}>{m.replacementHeading(country.name)}</h3>
            <p id={`${id}-help`} className="small muted">
              {m.replacementHelp}
            </p>
            <div className="map-replace-options">
              {candidates.map((current, index) => (
                <button
                  key={current.code}
                  ref={index === 0 ? firstChoice : undefined}
                  type="button"
                  className="button outline"
                  aria-label={m.replaceChoiceLabel(current.name, country.name)}
                  onClick={() => {
                    setLastReplacement({
                      oldCode: current.code,
                      newCode: country.code,
                      oldName: current.name,
                      newName: country.name,
                    });
                    onReplace(current.code, country.code);
                    onOpenChange(false);
                  }}
                >
                  <strong>{current.name}</strong>
                  <span className="code">{current.code}</span>
                </button>
              ))}
            </div>
            <button
              ref={cancelButton}
              type="button"
              className="button outline map-replace-cancel"
              onClick={cancel}
            >
              {m.cancelReplacement}
            </button>
          </>
        )}
      </dialog>
      {confirmed && lastReplacement && (
        <div className="map-replace-success">
          <p
            ref={successStatus}
            id={`${id}-success`}
            className="map-replace-status small"
            role="status"
            aria-live="polite"
            tabIndex={-1}
          >
            {m.replaced(lastReplacement.oldName, lastReplacement.newName)}
          </p>
          {selection.countryCodes.length >= 2 && (
            <button
              ref={comparisonButton}
              type="button"
              className="button dark map-replace-view"
              aria-describedby={`${id}-success`}
              onClick={onCompare}
            >
              {m.viewComparison}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
