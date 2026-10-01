import { GenericContainer } from 'testcontainers';
import type { StartedTestContainer } from 'testcontainers';

let container: StartedTestContainer | null = null;

export const startedPostgreSqlContainer = (async () => {
  container = await new GenericContainer('postgres:16-alpine')
    .withEnvironment({
      POSTGRES_USER: 'chronos',
      POSTGRES_PASSWORD: 'chronos',
      POSTGRES_DB: 'chronos',
    })
    .withExposedPorts(5432)
    .withHealthCheck({
      test: ['CMD-SHELL', 'pg_isready -U chronos -d chronos'],
      interval: 5000,
      timeout: 5000,
      retries: 5,
      startPeriod: 10000,
    })
    .start();
  
  return container;
})();

export function getDatabaseUrl(): string {
  if (!container) {
    throw new Error('PostgreSQL container not started');
  }
  const host = container.getHost();
  const port = container.getMappedPort(5432);
  return `postgresql://chronos:chronos@${host}:${port}/chronos`;
}

export async function stopPostgreSqlContainer(): Promise<void> {
  if (container) {
    await container.stop();
    container = null;
  }
}