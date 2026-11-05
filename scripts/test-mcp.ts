import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { createStore, compare } from '../src/lib/query';
import { snapshotSchema, type Observation } from '../src/lib/schema';

const root = fileURLToPath(new URL('../', import.meta.url));
const store = createStore(
  snapshotSchema.parse(JSON.parse(await readFile(`${root}data/snapshots/latest.json`, 'utf8'))),
);
const runs = [];
for (const mode of ['legacy', 'modern'] as const) {
  const client = new Client(
    { name: 'abundance-access-verification', version: '1.0.0' },
    { versionNegotiation: { mode: mode === 'legacy' ? 'legacy' : { pin: '2026-07-28' } } },
  );
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--import', 'tsx', `${root}mcp/server.ts`],
    cwd: root,
    stderr: 'pipe',
  });
  let stderr = '';
  transport.stderr?.on('data', (c) => {
    stderr += String(c);
  });
  try {
    await client.connect(transport);
    const list = await client.listTools();
    assert.deepEqual(list.tools.map((t) => t.name).sort(), [
      'compare_countries',
      'get_country_metrics',
      'get_indicator_metadata',
      'list_countries',
    ]);
    assert(list.tools.every((t) => t.annotations?.readOnlyHint === true));
    const call = async (name: string, args: Record<string, unknown>) => {
      const value = await client.callTool({ name, arguments: args });
      assert(!value.isError, JSON.stringify(value));
      const payload = value.structuredContent as { records: Observation[]; [k: string]: unknown };
      assert(payload && typeof payload === 'object');
      return payload;
    };
    const countries = await call('list_countries', { query: 'Kenya', limit: 10 });
    assert.equal((countries.countries as { code: string }[])[0].code, 'KEN');
    const metadata = await call('get_indicator_metadata', { indicatorCode: 'SE.SEC.CMPT.LO.ZS' });
    assert.equal((metadata.indicator as { canExceed100: boolean }).canExceed100, true);
    const metrics = await call('get_country_metrics', {
      countryCode: 'KEN',
      indicatorCodes: ['IT.NET.USER.ZS'],
      startYear: 2022,
      endYear: 2022,
    });
    const compared = await call('compare_countries', {
      countryCodes: ['KOR', 'IND', 'KEN'],
      indicatorCodes: ['IT.NET.USER.ZS', 'EG.ELC.ACCS.ZS'],
      year: 2022,
    });
    assert.deepEqual(
      compared.records,
      compare(store, ['KOR', 'IND', 'KEN'], ['IT.NET.USER.ZS', 'EG.ELC.ACCS.ZS'], 2022).map(
        (o) => ({
          ...o,
          missing: o.value === null,
          interpretation:
            'An annual national statistic; not an individual assessment or a causal explanation.',
        }),
      ),
    );
    assert.equal(
      metrics.records[0].value,
      compared.records.find((o) => o.countryCode === 'KEN' && o.indicatorCode === 'IT.NET.USER.ZS')!
        .value,
    );
    const missing = await call('get_country_metrics', {
      countryCode: 'KEN',
      indicatorCodes: ['EG.ELC.ACCS.ZS'],
      startYear: 2025,
      endYear: 2025,
    });
    assert.equal(missing.records[0].value, null);
    assert.notEqual(missing.records[0].status, 'observed');
    for (const args of [
      { countryCodes: ['KOR', 'IND'], indicatorCodes: ['IT.NET.USER.ZS'], year: 2030 },
      { countryCodes: ['WLD', 'IND'], indicatorCodes: ['IT.NET.USER.ZS'], year: 2022 },
      { countryCodes: ['IND', 'IND'], indicatorCodes: ['IT.NET.USER.ZS'], year: 2022 },
      { countryCodes: ['KOR', 'IND'], indicatorCodes: ['invented'], year: 2022 },
    ]) {
      let rejected = false;
      try {
        const invalid = await client.callTool({ name: 'compare_countries', arguments: args });
        rejected = invalid.isError === true;
      } catch {
        rejected = true;
      }
      assert(rejected, 'Invalid tool arguments were accepted');
    }
    runs.push({
      mode,
      status: 'passed',
      tools: list.tools.map((t) => t.name),
      checked:
        'Actual stdio client handshake, tools/list, all four tools/call, invalid inputs, UI shared-query equality',
      example: compared,
    });
    console.log(
      `MCP ${mode}: handshake, 4 tools, input rejection, and shared-data equality passed.`,
    );
  } finally {
    await client.close();
    await transport.close();
    if (stderr.trim()) console.error(stderr);
  }
}
await writeFile(
  `${root}reports/mcp-verification.json`,
  JSON.stringify(
    {
      verifiedAt: new Date().toISOString(),
      sdk: '@modelcontextprotocol/server + client 2.4.0',
      runs,
    },
    null,
    2,
  ),
);
