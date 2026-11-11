import { useId } from 'react';
import { investigationCopy as p } from '../content/investigation-en';
import {
  emptyInvestigation,
  investigationTopicSchema,
  type Investigation,
  type InvestigationTopic,
} from '../lib/investigation';

export function NextInvestigation({ onStart }: { onStart: (topic: InvestigationTopic) => void }) {
  return (
    <section className="panel next-investigation" aria-labelledby="next-investigation-title">
      <h2 id="next-investigation-title">{p.nextTitle}</h2>
      <p>{p.nextBody}</p>
      <div className="investigation-topics">
        {investigationTopicSchema.options.map((topic) => (
          <button key={topic} className="button outline" onClick={() => onStart(topic)}>
            {p.topics[topic]}
          </button>
        ))}
      </div>
    </section>
  );
}

export function InvestigationFields({
  value,
  onChange,
}: {
  value: Investigation | undefined;
  onChange: (value: Investigation | undefined) => void;
}) {
  const id = useId();
  if (!value)
    return (
      <div className="investigation-add">
        <h3>{p.planTitle}</h3>
        <p className="small muted">{p.planBody}</p>
        <div className="investigation-topics">
          {investigationTopicSchema.options.map((topic) => (
            <button
              key={topic}
              className="button outline"
              onClick={() => onChange(emptyInvestigation(topic))}
            >
              {p.topics[topic]}
            </button>
          ))}
        </div>
      </div>
    );
  const patch = (change: Partial<Investigation>) => onChange({ ...value, ...change });
  return (
    <fieldset className="investigation-fields" data-testid="investigation-plan">
      <legend>{p.planTitle}</legend>
      <p className="small muted">{p.planBody}</p>
      <label>
        <span>{p.topic}</span>
        <select
          value={value.topic}
          onChange={(event) => patch({ topic: event.target.value as InvestigationTopic })}
        >
          {investigationTopicSchema.options.map((topic) => (
            <option key={topic} value={topic}>
              {p.topics[topic]}
            </option>
          ))}
        </select>
      </label>
      <p className="investigation-question">{p.questions[value.topic]}</p>
      <div className="investigation-grid">
        <label>
          <span>{p.targetGroup}</span>
          <input
            maxLength={300}
            value={value.targetGroup}
            placeholder={p.targetPlaceholder}
            onChange={(event) => patch({ targetGroup: event.target.value })}
          />
        </label>
        <label>
          <span>{p.locality}</span>
          <input
            maxLength={300}
            value={value.locality}
            placeholder={p.localityPlaceholder}
            onChange={(event) => patch({ locality: event.target.value })}
          />
        </label>
        <label>
          <span>{p.evidenceNeeded}</span>
          <textarea
            rows={3}
            maxLength={1200}
            value={value.evidenceNeeded}
            placeholder={p.evidencePlaceholder}
            onChange={(event) => patch({ evidenceNeeded: event.target.value })}
          />
        </label>
        <label>
          <span>{p.sourceToCheck}</span>
          <textarea
            rows={3}
            maxLength={1000}
            value={value.sourceToCheck}
            placeholder={p.sourcePlaceholder}
            onChange={(event) => patch({ sourceToCheck: event.target.value })}
          />
        </label>
      </div>
      <label>
        <span>{p.decisionToInform}</span>
        <textarea
          rows={2}
          maxLength={1200}
          value={value.decisionToInform}
          placeholder={p.decisionPlaceholder}
          onChange={(event) => patch({ decisionToInform: event.target.value })}
        />
      </label>
      <label>
        <span>{p.status}</span>
        <select
          value={value.status}
          aria-describedby={`${id}-status-help`}
          onChange={(event) => patch({ status: event.target.value as Investigation['status'] })}
        >
          {(['unverified', 'checking', 'reviewed'] as const).map((status) => (
            <option value={status} key={status}>
              {p.statuses[status]}
            </option>
          ))}
        </select>
      </label>
      <p id={`${id}-status-help`} className="small muted">
        {p.statusHelp}
      </p>
      <button className="text-link" onClick={() => onChange(undefined)}>
        {p.remove}
      </button>
    </fieldset>
  );
}

export function SavedInvestigation({ value }: { value: Investigation }) {
  return (
    <div className="saved-investigation" data-testid="saved-investigation">
      <h4>
        {p.planTitle} · {p.topics[value.topic]}
      </h4>
      <p className="investigation-question">{p.questions[value.topic]}</p>
      <dl className="source-facts">
        {(
          [
            ['targetGroup', p.targetGroup],
            ['locality', p.locality],
            ['evidenceNeeded', p.evidenceNeeded],
            ['sourceToCheck', p.sourceToCheck],
            ['decisionToInform', p.decisionToInform],
          ] as const
        ).map(([key, label]) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>{value[key] || p.none}</dd>
          </div>
        ))}
        <div>
          <dt>{p.savedStatus}</dt>
          <dd>{p.statuses[value.status]}</dd>
        </div>
      </dl>
      <p className="small muted">{p.statusHelp}</p>
    </div>
  );
}
