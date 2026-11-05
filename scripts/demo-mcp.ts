import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { z } from 'zod';
import { INDICATOR_CODES, observationSchema, yearSchema } from '../src/lib/schema';

const root = fileURLToPath(new URL('../', import.meta.url));
const year = yearSchema.parse(Number(process.argv[2] ?? '2022'));
const countryCodes = ['KOR', 'IND', 'KEN'];
const client = new Client({ name: 'abundance-access-demo', version: '1.0.0' });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [
    '--import',
    fileURLToPath(new URL('../node_modules/tsx/dist/loader.mjs', import.meta.url)),
    `${root}mcp/server.ts`,
  ],
  cwd: root,
  stderr: 'pipe',
});
transport.stderr?.on('data', (data) => process.stderr.write(data));
async function call(name: string, args: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: args });
  if (result.isError)
    throw new Error(`MCP ${name} returned an error: ${JSON.stringify(result.content)}`);
  return result.structuredContent;
}
try {
  await client.connect(transport);
  const tools = await client.listTools();
  console.log(`Connected to local MCP server. Tools: ${tools.tools.map((t) => t.name).join(', ')}`);
  const metadata = [];
  for (const indicatorCode of INDICATOR_CODES)
    metadata.push(await call('get_indicator_metadata', { indicatorCode }));
  const arguments_ = { countryCodes, indicatorCodes: [...INDICATOR_CODES], year };
  const response = await call('compare_countries', arguments_);
  const comparison = z
    .object({
      datasetRunId: z.string(),
      collectionCompletedAt: z.iso.datetime(),
      records: z.array(observationSchema).length(9),
    })
    .parse(response);
  console.log(`tools/call → compare_countries ${JSON.stringify(arguments_)}`);
  const display = (code: string, indicatorCode: string) => {
    const record = comparison.records.find(
      (r) => r.countryCode === code && r.indicatorCode === indicatorCode,
    );
    if (!record) throw new Error('Comparison is missing a requested record');
    return record.value === null
      ? 'No observation'
      : `${new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(record.value)}%`;
  };
  console.table(
    countryCodes.map((code) => ({
      Country: comparison.records.find((r) => r.countryCode === code)!.countryName,
      Year: year,
      'Internet use': display(code, 'IT.NET.USER.ZS'),
      'Electricity access': display(code, 'EG.ELC.ACCS.ZS'),
      'Lower secondary proxy': display(code, 'SE.SEC.CMPT.LO.ZS'),
    })),
  );
  console.log(`Snapshot collected (UTC): ${comparison.collectionCompletedAt}`);
  console.log(
    'Annual national statistics; not live conditions. Education completion is a gross intake proxy, not a learning-quality score.',
  );
  console.log(
    'This demo uses an actual local MCP client. It does not register the server in Codex or send data to an LLM.',
  );
  const report = {
    executedAt: new Date().toISOString(),
    method: 'Actual stdio MCP client: tools/list, get_indicator_metadata, compare_countries',
    arguments: arguments_,
    response,
    metadata,
  };
  await mkdir(`${root}reports`, { recursive: true });
  await writeFile(`${root}reports/mcp-demo-${year}.json`, JSON.stringify(report, null, 2));
  console.log(`Raw tool response and source metadata: reports/mcp-demo-${year}.json`);
} finally {
  await client.close();
  await transport.close();
}
