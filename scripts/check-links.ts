import { mkdir, writeFile } from 'node:fs/promises';
import { definitions } from '../src/lib/query';
import { classifyStatus, retryDelay, linkReportSchema } from '../src/lib/link-report';

const REPORT_DIR = new URL('../reports/', import.meta.url);
const TIMEOUT_MS = 8000;
const MAX_ATTEMPTS = 3;
const REQUEST_INTERVAL_MS = 1100;
let nextRequestAt = 0;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function request(url: string, method: 'HEAD' | 'GET') {
  await sleep(Math.max(0, nextRequestAt - Date.now()));
  nextRequestAt = Date.now() + REQUEST_INTERVAL_MS;
  const response = await fetch(url, {
    method,
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      'User-Agent': 'AbundanceAccess-LinkCheck/1.0',
      ...(method === 'GET' ? { Range: 'bytes=0-1023' } : {}),
    },
  });
  const result = {
    status: response.status,
    finalUrl: response.url,
    retryAfter: response.headers.get('retry-after'),
  };
  await response.body?.cancel();
  return result;
}

async function check(url: string, title: string) {
  let httpStatus: number | null = null;
  let finalUrl: string | null = null;
  let detail = '';
  let attempts = 0;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    attempts = attempt;
    let retryAfter: string | null = null;
    try {
      let response = await request(url, 'HEAD');
      // Some sites deny HEAD while allowing normal reading. This is still reachability only.
      if ([403, 405, 501].includes(response.status)) response = await request(url, 'GET');
      httpStatus = response.status;
      finalUrl = response.finalUrl;
      retryAfter = response.retryAfter;
      detail =
        httpStatus >= 200 && httpStatus < 400
          ? 'HTTP request succeeded; page content was not re-reviewed.'
          : 'HTTP response requires human review; content was not changed.';
    } catch (error) {
      httpStatus = null;
      finalUrl = null;
      detail = `Inconclusive network/timeout error: ${error instanceof Error ? error.message : String(error)}`;
    }
    const status = classifyStatus(httpStatus);
    if ((status !== 'transient' && status !== 'rate-limited') || attempt === MAX_ATTEMPTS) break;
    await sleep(retryDelay(attempt, retryAfter));
  }
  return {
    url,
    title,
    status: classifyStatus(httpStatus),
    httpStatus,
    checkedAt: new Date().toISOString(),
    attempts,
    finalUrl,
    detail,
  };
}

const sources = new Map<string, string>();
definitions.indicators.forEach((i) => {
  sources.set(i.metadataUrl, i.name);
  sources.set(i.providerUrl, i.provider);
});
sources.set(definitions.apiDocumentationUrl, 'World Bank Indicators API documentation');
sources.set(definitions.licenseUrl, 'World Bank indicator license');
sources.set(definitions.map.documentationUrl, definitions.map.name);
sources.set(definitions.map.licenseUrl, 'Natural Earth terms of use');
const results = [];
for (const [url, title] of sources) {
  const result = await check(url, title);
  results.push(result);
  console.log(`${result.status.padEnd(12)} ${result.httpStatus ?? 'network'} ${url}`);
}
const report = linkReportSchema.parse({ generatedAt: new Date().toISOString(), results });
await mkdir(REPORT_DIR, { recursive: true });
const stamp = report.generatedAt!.replaceAll(':', '-').replace(/\.\d+Z$/, 'Z');
const json = JSON.stringify(report, null, 2) + '\n';
const markdown = `# External link check\n\nChecked at: ${report.generatedAt}\n\nReachability is not content verification. Content and review dates have not been modified. 401/403, 429, and transient failures are inconclusive; no link is automatically removed.\n\nTimeout: ${TIMEOUT_MS}ms per request; maximum ${MAX_ATTEMPTS} attempts; at least ${REQUEST_INTERVAL_MS}ms between request starts; sequential checks; backoff capped at 10s.\n\n| Resource | Status | HTTP | Attempts |\n|---|---|---|---|\n${results.map((r) => `| [${r.title.replaceAll('|', '\\|')}](${r.url}) | ${r.status} | ${r.httpStatus ?? 'network'} | ${r.attempts} |`).join('\n')}\n`;
await writeFile(new URL(`link-check-${stamp}.json`, REPORT_DIR), json);
await writeFile(new URL(`link-check-${stamp}.md`, REPORT_DIR), markdown);
await writeFile(new URL('link-check.latest.json', REPORT_DIR), json);
console.log('Reports written to reports/. No content or content-review date was changed.');
