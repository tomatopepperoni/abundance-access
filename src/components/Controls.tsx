import { c } from '../content/en';
import { definitions, indicator } from '../lib/query';
import type { DataStore } from '../lib/query';
import type { Selection } from '../lib/research';
import type { IndicatorCode } from '../lib/schema';
import { Icon } from './Icon';
export type SelectionControls = {
  store: DataStore;
  selection: Selection;
  onChange: (patch: Partial<Selection>) => void;
  onToggle: (code: string) => void;
  onCompare?: () => void;
  variant?: 'default' | 'comparison';
  onChooseCountries?: () => void;
};
export function Controls({
  store,
  selection,
  onChange,
  onToggle,
  onCompare,
  variant = 'default',
  onChooseCountries,
}: SelectionControls) {
  const compact = variant === 'comparison';
  return (
    <section
      className={`research-controls ${compact ? 'comparison-controls' : ''}`}
      aria-label={c.focus}
    >
      <div className="filter-fields">
        {!compact && (
          <label>
            <span>{c.indicator}</span>
            <select
              value={selection.indicatorCode}
              onChange={(e) => onChange({ indicatorCode: e.target.value as IndicatorCode })}
            >
              {definitions.indicators.map((i) => (
                <option key={i.code} value={i.code}>
                  {i.shortName}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="year-field">
          <span>{c.year}</span>
          <select
            value={selection.year}
            onChange={(e) => onChange({ year: Number(e.target.value) })}
          >
            {Array.from({ length: 11 }, (_, i) => 2025 - i).map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </label>
        <span className="annual-tag">
          <span className="status-dot" />
          {c.annual}
        </span>
        {onChooseCountries && (
          <button className="button outline compact change-countries" onClick={onChooseCountries}>
            {c.changeCountries}
            <Icon name="arrow" size={16} />
          </button>
        )}
      </div>
      <div className="selection-row">
        <span className="selection-label">
          {c.selected}
          <small>{selection.countryCodes.length} / 3</small>
        </span>
        <div className="country-chips">
          {selection.countryCodes.map((code) => (
            <button
              key={code}
              className="country-chip"
              onClick={() => onToggle(code)}
              aria-label={`${c.remove} ${store.countryByCode.get(code)!.name}`}
            >
              <span className="code">{code}</span>
              {store.countryByCode.get(code)!.name}
              <Icon name="close" size={13} />
            </button>
          ))}
          {!selection.countryCodes.length && <span className="muted">{c.selectedEmpty}</span>}
        </div>
        {onCompare && (
          <button
            className="button dark compact"
            disabled={selection.countryCodes.length < 2}
            onClick={onCompare}
          >
            {c.compareCTA}
            <Icon name="arrow" size={17} />
          </button>
        )}
      </div>
      {!compact && (
        <p className="filter-note">
          {indicator(selection.indicatorCode).unit} ·{' '}
          {selection.countryCodes.length === 3 ? c.selectionLimit : c.footerLimit}
        </p>
      )}
      <p className={compact ? 'comparison-scope' : 'selection-help'}>
        {compact ? c.comparisonScope : c.selectionScope}
      </p>
    </section>
  );
}
