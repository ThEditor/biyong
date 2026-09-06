import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

export function createDatabaseClient(connectionString: string) {
  const client = postgres(connectionString, { max: 10 });
  const db = drizzle(client, { schema });
  return { db, client };
}

export type BiyongDatabase = ReturnType<typeof createDatabaseClient>['db'];
