import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import snapshotUrl from '../data/snapshots/latest.json?url';
import { snapshotSchema } from './lib/schema';
import { createStore, definitions } from './lib/query';
import type { DataStore } from './lib/query';
import {
  addDraftNote,
  attachCalculatedEvidence,
  assignDraftContext,
  defaultResearch,
  editDraft,
  editInvestigationFindingsDraft,
  hasDraftContent,
  loadResearch,
  resetResearch,
  removeCalculatedEvidence,
  recordInvestigationFindings,
  replaceComparisonCountry,
  startInvestigation,
  RESEARCH_SCHEMA_VERSION,
  saveResearch,
} from './lib/research';
import type { DraftPatch, Research, Selection } from './lib/research';
import type {
  InvestigationFindings,
  InvestigationFindingsDraft,
  InvestigationTopic,
} from './lib/investigation';
import { investigationCopy as investigation } from './content/investigation-en';
import { findingsCopy } from './content/findings-en';
import { downloadText, exportCSV, exportMarkdown } from './lib/export';
import type { ExportScope } from './lib/export';
import { c } from './content/en';
import { Icon } from './components/Icon';
import { Explorer } from './components/Explorer';
import { Comparison } from './components/Comparison';
import { Methods } from './components/Methods';
import { Notebook } from './components/Notebook';
import { readSharedComparison } from './lib/sharing';
import type { SharedComparison } from './lib/sharing';
import type { ComparisonSummary } from './lib/analysis';
import { comparisonSummary } from './lib/analysis';
import { sharingCopy as s } from './content/sharing-en';
import { SidebarResizer } from './components/SidebarResizer';
import { sidebarCopy } from './content/sidebar-en';

type View = keyof typeof c.nav;
const SIDEBAR_COLLAPSED_KEY = 'abundance-access:sidebar-collapsed:v1';
const views = Object.keys(c.nav) as View[];
const readView = (): View =>
  views.includes(window.location.hash.slice(1).split('?')[0] as View)
    ? (window.location.hash.slice(1).split('?')[0] as View)
    : 'overview';
export default function App() {
  const [store, setStore] = useState<DataStore | null>(null),
    [error, setError] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    fetch(snapshotUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Snapshot unavailable');
        return response.json();
      })
      .then((data) => {
        if (!controller.signal.aborted) setStore(createStore(snapshotSchema.parse(data)));
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [attempt]);
  if (!store)
    return (
      <main className="load-screen">
        <Brand />
        <div className="panel">
          <Icon name="database" size={32} />
          <h1>{error ? c.loadError : c.loading}</h1>
          {error && (
            <button className="button dark" onClick={() => setAttempt((n) => n + 1)}>
              {c.retry}
            </button>
          )}
        </div>
      </main>
    );
  return <Dashboard key={`${store.snapshot.runId}:${RESEARCH_SCHEMA_VERSION}`} store={store} />;
}
function Brand() {
  return (
    <span className="brand-lockup">
      <span className="brand-symbol">
        <svg width="27" height="30" viewBox="0 0 32 34" fill="none" aria-hidden="true">
          <path
            d="M5 27 16 6l11 21M10 20h12M16 7v22"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span>
        {c.brand}
        <strong>
          {c.brandSecond}
          <i>.</i>
        </strong>
      </span>
    </span>
  );
}
function Dashboard({ store }: { store: DataStore }) {
  const layout = useRef<HTMLDivElement>(null);
  const resetDialog = useRef<HTMLDialogElement>(null);
  const resetCancel = useRef<HTMLButtonElement>(null);
  const [loaded] = useState(() => {
    const shared = readSharedComparison(window.location.hash, store);
    let saved;
    try {
      saved = loadResearch(store, window.localStorage);
    } catch {
      saved = { data: defaultResearch(store), status: 'unavailable' as const };
    }
    return {
      ...saved,
      shared,
      data: shared.status === 'ready' ? { ...saved.data, selection: shared.selection } : saved.data,
    };
  });
  const [shared, setShared] = useState<SharedComparison>(loaded.shared);
  const [readFailure, setReadFailure] = useState(loaded.status === 'ok' ? null : loaded);
  const [research, setResearch] = useState(loaded.data),
    [storageAvailable, setStorageAvailable] = useState(loaded.status === 'ok');
  const [view, setView] = useState<View>(readView),
    [navOpen, setNavOpen] = useState(false),
    [notice, setNotice] = useState('');
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 800px)').matches);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const desktopSidebarHidden = !mobile && sidebarCollapsed;
  const sidebarHidden = mobile ? !navOpen : sidebarCollapsed;
  const sidebarToggleLabel = sidebarCollapsed ? sidebarCopy.expand : sidebarCopy.collapse;
  useEffect(() => {
    if (readFailure) return;
    try {
      setStorageAvailable(saveResearch(research, window.localStorage, store));
    } catch {
      setStorageAvailable(false);
    }
  }, [research, store, readFailure]);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 800px)');
    const handler = () => {
      setMobile(query.matches);
      setNavOpen(false);
    };
    query.addEventListener('change', handler);
    return () => query.removeEventListener('change', handler);
  }, []);
  useEffect(() => {
    const handler = () => {
      const next = readSharedComparison(window.location.hash, store);
      setShared(next);
      if (next.status === 'ready')
        setResearch((previous) => ({ ...previous, selection: next.selection }));
      setView(readView());
      setNavOpen(false);
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, [store]);
  useEffect(() => {
    document.title = `${c.nav[view]} · Abundance Access`;
  }, [view]);
  useLayoutEffect(() => {
    if (navOpen) document.querySelector<HTMLAnchorElement>('.nav-item.active')?.focus();
  }, [navOpen]);
  useEffect(() => {
    if (!navOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !resetDialog.current?.open) {
        setNavOpen(false);
        document.getElementById('menu-toggle')?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navOpen]);
  const update = (patch: Partial<Research>) => {
    setResearch((previous) => ({ ...previous, ...patch }));
    setNotice('');
  };
  const select = (patch: Partial<Selection>) => {
    if (window.location.hash.startsWith('#compare?')) {
      window.history.replaceState(null, '', '#compare');
      setShared({ status: 'none' });
    }
    setResearch((previous) => ({ ...previous, selection: { ...previous.selection, ...patch } }));
    setNotice('');
  };
  const changeDraft = (patch: DraftPatch) => {
    setResearch((previous) => editDraft(previous, patch, store.snapshot.runId));
    setNotice('');
  };
  const confirmDraftContext = () => {
    setResearch((previous) => assignDraftContext(previous, store.snapshot.runId));
    setNotice('');
  };
  const toggle = (code: string) => {
    if (window.location.hash.startsWith('#compare?')) {
      window.history.replaceState(null, '', '#compare');
      setShared({ status: 'none' });
    }
    if (
      !research.selection.countryCodes.includes(code) &&
      research.selection.countryCodes.length === 3
    ) {
      setNotice(c.selectionLimit);
      return;
    }
    setResearch((previous) => ({
      ...previous,
      selection: {
        ...previous.selection,
        countryCodes: previous.selection.countryCodes.includes(code)
          ? previous.selection.countryCodes.filter((v) => v !== code)
          : previous.selection.countryCodes.length < 3
            ? [...previous.selection.countryCodes, code]
            : previous.selection.countryCodes,
      },
    }));
    setNotice('');
  };
  const replaceCountry = (oldCode: string, newCode: string) => {
    if (window.location.hash.startsWith('#compare?')) {
      window.history.replaceState(null, '', '#compare');
      setShared({ status: 'none' });
    }
    setResearch((previous) => replaceComparisonCountry(previous, oldCode, newCode, store.snapshot));
    setNotice('');
  };
  const navigate = (next: View, focusCountrySearch = false) => {
    setView(next);
    window.location.hash = next;
    setNavOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
    requestAnimationFrame(() => {
      const search = focusCountrySearch
        ? document.querySelector<HTMLInputElement>('.map-country-finder input[type="search"]')
        : null;
      (search ?? document.getElementById('main-content'))?.focus({ preventScroll: true });
      search?.scrollIntoView({ block: 'center', behavior: 'instant' });
    });
  };
  const openExample = () => {
    setResearch((previous) => ({
      ...previous,
      selection: {
        countryCodes: ['KOR', 'IND', 'KEN'],
        indicatorCode: 'IT.NET.USER.ZS',
        year: 2022,
      },
      search: '',
      region: 'all',
    }));
    setNotice('');
    navigate('compare');
  };
  const reset = () => {
    resetDialog.current?.close();
    if (readFailure?.status !== 'unavailable') {
      try {
        if (!resetResearch(window.localStorage)) {
          setNotice(c.resetFailed);
          return;
        }
      } catch {
        setNotice(c.resetFailed);
        return;
      }
      setReadFailure(null);
    }
    setResearch(defaultResearch(store));
    setNotice(readFailure?.status === 'unavailable' ? c.resetSessionDone : c.resetDone);
    navigate('overview');
  };
  const saveNote = () => {
    if (
      !research.draft.context?.selection.countryCodes.length ||
      !hasDraftContent(research.draft) ||
      research.notes.length >= 100
    )
      return;
    const createdAt = new Date().toISOString(),
      id = crypto.randomUUID();
    setResearch((previous) => addDraftNote(previous, id, createdAt));
    setNotice(c.noteSaved);
  };
  const saveFindings = (noteId: string, value: InvestigationFindings) => {
    setResearch((previous) => recordInvestigationFindings(previous, noteId, value));
    setNotice(findingsCopy.saved);
  };
  const changeFindingsDraft = (noteId: string, value: InvestigationFindingsDraft | undefined) => {
    setResearch((previous) => editInvestigationFindingsDraft(previous, noteId, value));
  };
  const onExport = (type: 'csv' | 'md', scope: ExportScope) => {
    if (
      !research.selection.countryCodes.length &&
      !hasDraftContent(research.draft) &&
      !research.notes.length
    )
      return;
    downloadText(
      `abundance-access-${scope}-${research.selection.year}.${type}`,
      type === 'csv' ? exportCSV(store, research, scope) : exportMarkdown(store, research, scope),
      type === 'csv' ? 'text/csv;charset=utf-8' : 'text/markdown;charset=utf-8',
    );
  };
  const recordSummary = (summary: ComparisonSummary) => {
    const next = attachCalculatedEvidence(research, summary);
    if (next === research) {
      setNotice(s.evidenceBlocked);
      navigate('notes');
      return;
    }
    setResearch(next);
    setNotice(s.evidenceAttached);
    navigate('notes');
  };
  const investigate = (topic: InvestigationTopic) => {
    const next = startInvestigation(research, topic, store.snapshot.runId);
    if (next === research) {
      setNotice(investigation.blocked);
      navigate('notes');
      return;
    }
    setResearch(
      research.selection.countryCodes.length >= 2
        ? attachCalculatedEvidence(next, comparisonSummary(store, research.selection))
        : next,
    );
    setNotice(investigation.started);
    navigate('notes');
  };
  const title =
    view === 'overview'
      ? null
      : view === 'explore'
        ? c.exploreTitle
        : view === 'compare'
          ? c.compareTitle
          : view === 'methodology'
            ? c.methodsTitle
            : c.notebookTitle;
  const body =
    view === 'explore'
      ? c.exploreBody
      : view === 'compare'
        ? c.compareBody
        : view === 'methodology'
          ? c.methodsBody
          : c.notebookBody;
  const observed = store.snapshot.observations.filter((o) => o.value !== null).length;
  return (
    <div className={`app-shell${desktopSidebarHidden ? ' sidebar-collapsed' : ''}`} ref={layout}>
      <a
        href="#main-content"
        className="skip-link"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        {c.skip}
      </a>
      {navOpen && mobile && (
        <button
          className="nav-scrim"
          aria-label={c.closeNav}
          onClick={() => {
            setNavOpen(false);
            document.getElementById('menu-toggle')?.focus();
          }}
        />
      )}
      <aside
        id="research-sidebar"
        className={`sidebar ${navOpen ? 'open' : ''}`}
        aria-label={c.workspace}
        aria-hidden={sidebarHidden}
        inert={sidebarHidden}
      >
        <a
          className="brand"
          href="#overview"
          aria-label={c.brandHome}
          onClick={(event) => {
            event.preventDefault();
            navigate('overview');
          }}
        >
          <Brand />
        </a>
        <p className="sidebar-tagline">{c.tagline}</p>
        <span className="nav-label">{c.workspace}</span>
        <nav aria-label={c.mainNav}>
          {views.map((key) => (
            <a
              className={`nav-item ${view === key ? 'active' : ''}`}
              aria-current={view === key ? 'page' : undefined}
              key={key}
              href={`#${key}`}
              onClick={(event) => {
                event.preventDefault();
                navigate(key);
              }}
            >
              <Icon name={key} />
              <span>{c.nav[key]}</span>
              {view === key && <i />}
            </a>
          ))}
        </nav>
        <div className="sidebar-dataset">
          <Icon name="database" size={25} />
          <span className="eyebrow">WORLD BANK · WDI</span>
          <strong>2015—2025</strong>
          <span>
            {store.snapshot.countries.length} {c.countryCount.toLowerCase()}
          </span>
          <span>
            {definitions.indicators.length} {c.annualIndicators}
          </span>
          <span className="dataset-kind">{c.datasetKind}</span>
        </div>
        <div className="sidebar-bottom">
          <p>
            <Icon name="info" size={16} />
            {c.annual}
          </p>
          <button
            className="text-link reset-button"
            type="button"
            aria-haspopup="dialog"
            onClick={() => {
              resetDialog.current?.showModal();
              resetCancel.current?.focus();
            }}
          >
            <Icon name="reset" size={15} />
            {c.reset}
          </button>
        </div>
      </aside>
      <dialog
        ref={resetDialog}
        className="workspace-reset-dialog"
        aria-labelledby="reset-workspace-title"
        aria-describedby="reset-workspace-help"
      >
        <h2 id="reset-workspace-title">{c.resetTitle}</h2>
        <p id="reset-workspace-help">
          {readFailure?.status === 'invalid'
            ? c.resetUnreadable
            : readFailure?.status === 'unavailable'
              ? c.resetSessionHelp
              : c.resetHelp}
        </p>
        <div className="button-group">
          <button
            type="button"
            ref={resetCancel}
            className="button outline"
            onClick={() => resetDialog.current?.close()}
          >
            {c.resetCancel}
          </button>
          <button type="button" className="button dark" onClick={reset}>
            {c.resetConfirm}
          </button>
        </div>
      </dialog>
      <SidebarResizer containerRef={layout} />
      <div className="workspace" id="research-workspace">
        <header className="topbar">
          <button
            id="menu-toggle"
            type="button"
            className={mobile ? 'icon-button menu-toggle' : 'button outline sidebar-toggle'}
            aria-label={mobile ? (navOpen ? c.closeNav : c.openNav) : sidebarToggleLabel}
            aria-expanded={!sidebarHidden}
            aria-controls="research-sidebar"
            onClick={() => {
              if (mobile) {
                setNavOpen((open) => !open);
                return;
              }
              const collapsed = !sidebarCollapsed;
              setSidebarCollapsed(collapsed);
              try {
                window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
              } catch {
                // The toggle still works for the current page when storage is blocked.
              }
            }}
          >
            <Icon name={mobile ? 'menu' : 'sidebar'} />
            {!mobile && sidebarToggleLabel}
          </button>
          <div className="breadcrumb">
            <span>{c.breadcrumb}</span>
            <span aria-hidden="true">/</span>
            <strong>{c.nav[view]}</strong>
          </div>
          <span className={`storage-status ${storageAvailable ? '' : 'unavailable'}`}>
            <i />
            {storageAvailable ? c.saved : c.session}
          </span>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className={`main-content${desktopSidebarHidden && view === 'compare' ? ' wide-comparison' : ''}`}
        >
          <div className={`notice ${notice ? 'visible' : ''}`} role="status" aria-live="polite">
            {notice}
          </div>
          {readFailure && (
            <div className="share-warning">
              <p role="alert">
                {readFailure.status === 'invalid' ? c.workspacePreserved : c.workspaceReadBlocked}
              </p>
              {readFailure.status === 'invalid' && (
                <button
                  type="button"
                  className="button outline compact"
                  onClick={() =>
                    downloadText('abundance-access-preserved-workspace.json', readFailure.raw)
                  }
                >
                  {c.downloadPreserved}
                </button>
              )}
            </div>
          )}
          {shared.status === 'invalid' && (
            <div className="share-warning" role="alert">
              {s.invalid}
            </div>
          )}
          {shared.status === 'mismatch' && (
            <div className="share-warning" role="alert">
              <p>{s.mismatch}</p>
              <p className="small mono">
                {s.requested}: {shared.snapshotRunId}
                <br />
                {s.current}: {store.snapshot.runId}
              </p>
              <button
                className="button outline compact"
                onClick={() => {
                  select(shared.selection);
                  setNotice(s.currentApplied);
                }}
              >
                {s.useCurrent}
              </button>
            </div>
          )}
          {view === 'overview' ? (
            <>
              <section className="hero">
                <div className="hero-copy">
                  <span className="eyebrow">{c.heroEyebrow}</span>
                  <h1>{c.heroTitle}</h1>
                  <p>{c.heroBody}</p>
                  <div className="hero-actions">
                    <button className="button dark" onClick={openExample}>
                      {c.heroCTA}
                      <Icon name="arrow" size={18} />
                    </button>
                    <button className="text-link" onClick={() => navigate('explore')}>
                      {c.exploreCTA}
                      <Icon name="arrow" size={16} />
                    </button>
                  </div>
                  <p className="purpose-summary">{c.heroLimit}</p>
                </div>
                <div className="hero-provenance">
                  <Icon name="database" size={14} />
                  <span>{c.snapshot}</span>
                  <span>World Bank · WDI</span>
                </div>
              </section>
              <section className="start-guide" aria-label={c.guideLabel}>
                <ol>
                  {c.guideSteps.map((step, index) => (
                    <li key={step.title}>
                      <span className="step-number" aria-hidden="true">
                        {index + 1}
                      </span>
                      <div>
                        <strong>{step.title}</strong>
                        <p>{step.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
              <section className="overview-stats" aria-label={c.overviewCoverage}>
                <div>
                  <strong>{store.snapshot.countries.length}</strong>
                  <span>{c.countryCount}</span>
                </div>
                <div>
                  <strong>{observed.toLocaleString('en')}</strong>
                  <span>{c.observedCount}</span>
                </div>
                <div>
                  <strong>2015—2025</strong>
                  <span>{c.period}</span>
                </div>
                <div className="stat-dates">
                  <span>
                    {c.fetched}
                    <b>{store.snapshot.fetchedAt.slice(0, 10)}</b>
                  </span>
                  <span>
                    {c.reviewed}
                    <b>{definitions.reviewedAt}</b>
                  </span>
                </div>
              </section>
              <section className="measure-section">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">{c.focus}</span>
                    <h2>{c.focusTitle}</h2>
                  </div>
                  <p>{c.focusBody}</p>
                </div>
                <div className="measure-cards">
                  {definitions.indicators.map((def, index) => (
                    <button
                      key={def.code}
                      className={`measure-card ${research.selection.indicatorCode === def.code ? 'active' : ''}`}
                      onClick={() => select({ indicatorCode: def.code })}
                      aria-pressed={research.selection.indicatorCode === def.code}
                    >
                      <span className="measure-number">
                        0{index + 1}
                        <Icon name="arrow" size={18} />
                      </span>
                      <h3>{def.shortName}</h3>
                      <p>{c.measureDescriptions[def.code]}</p>
                      <span className="measure-provider">{def.provider}</span>
                    </button>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <section className={`page-heading ${view === 'compare' ? 'comparison-heading' : ''}`}>
              <span className="eyebrow">{c.nav[view]}</span>
              <h1>{title}</h1>
              <p>{body}</p>
            </section>
          )}
          {(view === 'overview' || view === 'explore') && (
            <Explorer
              store={store}
              research={research}
              onChange={update}
              onSelection={select}
              onToggle={toggle}
              onNavigate={navigate}
              onExample={openExample}
              onReplace={replaceCountry}
              showExample={view === 'explore'}
            />
          )}
          {view === 'compare' && (
            <Comparison
              store={store}
              research={research}
              onSelection={select}
              onToggle={toggle}
              onNavigate={(next) => navigate(next, next === 'explore')}
              onExport={onExport}
              onInvestigate={investigate}
              onRecordSummary={recordSummary}
            />
          )}
          {view === 'methodology' && <Methods store={store} />}
          {view === 'notes' && (
            <Notebook
              store={store}
              research={research}
              onDraftChange={changeDraft}
              onConfirmContext={confirmDraftContext}
              storageAvailable={storageAvailable}
              onSelection={select}
              onToggle={toggle}
              onSave={saveNote}
              onSaveFindings={saveFindings}
              onFindingsDraftChange={changeFindingsDraft}
              onExport={onExport}
              onRemoveEvidence={() => setResearch((previous) => removeCalculatedEvidence(previous))}
            />
          )}
          <footer className="site-footer">
            <span className="footer-brand">Abundance Access</span>
            <p>{c.footer}</p>
            <p>{c.footerLimit}</p>
            <a
              href="https://github.com/tomatopepperoni/abundance-access"
              target="_blank"
              rel="noreferrer"
            >
              {c.sourceCode}
            </a>
          </footer>
        </main>
      </div>
    </div>
  );
}
