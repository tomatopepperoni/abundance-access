import { fileURLToPath } from 'node:url';
console.log(
  JSON.stringify(
    {
      mcpServers: {
        'abundance-access': {
          command: process.execPath,
          args: [
            '--import',
            fileURLToPath(new URL('../node_modules/tsx/dist/loader.mjs', import.meta.url)),
            fileURLToPath(new URL('../mcp/server.ts', import.meta.url)),
          ],
        },
      },
    },
    null,
    2,
  ),
);
