import { c } from '../content/en';
import { definitions } from '../lib/query';
import type { DataStore } from '../lib/query';
import { Icon } from './Icon';
export function Methods({ store }: { store: DataStore }) {
  return (
    <>
      <div className="method-grid">
        <article className="panel method-intro">
          <span className="eyebrow">01 · {c.scopeTitle}</span>
          <p>{c.scopeBody}</p>
          <dl className="source-facts">
            <div>
              <dt>{c.countryCount}</dt>
              <dd>{store.snapshot.countries.length}</dd>
            </div>
            <div>
              <dt>{c.observedCount}</dt>
              <dd>
                {store.snapshot.observations
                  .filter((o) => o.value !== null)
                  .length.toLocaleString('en')}
              </dd>
            </div>
            <div>
              <dt>{c.fetched}</dt>
              <dd>{store.snapshot.fetchedAt}</dd>
            </div>
            <div>
              <dt>{c.reviewed}</dt>
              <dd>{definitions.reviewedAt}</dd>
            </div>
          </dl>
        </article>
        <article className="panel method-intro">
          <span className="eyebrow">02 · {c.comparisonsTitle}</span>
          <p>{c.comparisonsBody}</p>
          <span className="eyebrow">03 · {c.dateTitle}</span>
          <p>{c.dateBody}</p>
        </article>
      </div>
      {definitions.indicators.map((def, index) => {
        const metadata = store.snapshot.indicatorMetadata.find((i) => i.code === def.code)!;
        return (
          <article className="panel definition-card" id={def.code} key={def.code}>
            <div className="definition-heading">
              <span className="measure-index">0{index + 1}</span>
              <div>
                <span className="eyebrow">{def.code}</span>
                <h2>{def.name}</h2>
                <span className="soft-badge">{def.unit} · Annual</span>
              </div>
            </div>
            <div className="definition-grid">
              <div>
                <h3>{c.definition}</h3>
                <p>{def.definition}</p>
                <h3>{c.method}</h3>
                <p>{def.methodology}</p>
              </div>
              <div>
                <h3>{c.limitations}</h3>
                <p>{def.limitation}</p>
                <dl className="source-facts">
                  <div>
                    <dt>{c.source}</dt>
                    <dd>
                      <a href={def.providerUrl} target="_blank" rel="noreferrer">
                        {def.provider}
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt>{c.distributor}</dt>
                    <dd>{definitions.distributor}</dd>
                  </div>
                  <div>
                    <dt>{c.sourceUpdated}</dt>
                    <dd>{metadata.sourceUpdatedAt ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>{c.reviewed}</dt>
                    <dd>{definitions.reviewedAt}</dd>
                  </div>
                </dl>
              </div>
            </div>
            <div className="definition-links">
              <a className="text-link" href={def.metadataUrl} target="_blank" rel="noreferrer">
                {c.definitionLink}
                <Icon name="external" size={14} />
              </a>
              <a
                className="text-link"
                href={definitions.licenseUrl}
                target="_blank"
                rel="noreferrer"
              >
                {c.license} · CC BY 4.0
                <Icon name="external" size={14} />
              </a>
            </div>
            <details>
              <summary>{c.apiMetadata}</summary>
              <dl className="source-facts">
                <div>
                  <dt>{c.definition}</dt>
                  <dd>{metadata.apiSourceNote}</dd>
                </div>
                <div>
                  <dt>{c.source}</dt>
                  <dd>{metadata.apiSourceOrganization}</dd>
                </div>
              </dl>
            </details>
          </article>
        );
      })}
      <div className="method-grid">
        <section className="panel method-intro">
          <span className="eyebrow">{c.snapshotIntegrity}</span>
          <p>{c.snapshotIntegrityBody}</p>
          <p className="small">
            {definitions.license}{' '}
            <a href={definitions.licenseUrl} target="_blank" rel="noreferrer">
              {c.license}
              <Icon name="external" size={12} />
            </a>
          </p>
          <p className="small mono">
            {store.snapshot.rawManifest.length} raw API responses · {store.snapshot.runId}
          </p>
          <details>
            <summary>
              {c.aggregateDetails} ({store.snapshot.aggregates.length})
            </summary>
            <ul className="aggregate-list">
              {store.snapshot.aggregates.map((a) => (
                <li key={a.code}>
                  {a.code} · {a.name}
                </li>
              ))}
            </ul>
          </details>
        </section>
        <section className="panel method-intro">
          <span className="eyebrow">{c.mapMethods}</span>
          <h3>{definitions.map.name}</h3>
          <p>{definitions.map.note}</p>
          <a
            className="text-link"
            href={definitions.map.documentationUrl}
            target="_blank"
            rel="noreferrer"
          >
            Natural Earth
            <Icon name="external" size={14} />
          </a>
          <p className="small">
            <a href={definitions.map.licenseUrl} target="_blank" rel="noreferrer">
              {definitions.map.license}
            </a>
          </p>
        </section>
      </div>
      <section className="panel mcp-panel">
        <span className="eyebrow">MCP · READ ONLY · LOCAL</span>
        <h2>{c.mcpTitle}</h2>
        <p>{c.mcpBody}</p>
        <div className="tool-list" aria-label={c.mcpTools}>
          {[
            'list_countries',
            'get_indicator_metadata',
            'get_country_metrics',
            'compare_countries',
          ].map((t) => (
            <code key={t}>{t}</code>
          ))}
        </div>
        <p className="small muted">{c.mcpNote}</p>
      </section>
    </>
  );
}
