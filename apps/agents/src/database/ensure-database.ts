import { agentsDatabaseUrl, ensureNamedDatabase } from '@app/common';

export async function ensureAgentsDatabase() {
  await ensureNamedDatabase({
    targetUrl: agentsDatabaseUrl(),
    fallbackName: 'agents',
    loggerContext: 'AgentsDatabase',
  });
}
