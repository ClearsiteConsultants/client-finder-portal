#!/usr/bin/env tsx

import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { Client } from "pg";

function quoteIdent(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function parseDatabaseName(databaseUrl: string) {
  const url = new URL(databaseUrl);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, "")).trim();
  if (!databaseName) {
    throw new Error(
      "DATABASE_URL must include a database name (e.g. postgresql://user:pass@localhost:5432/mydb)"
    );
  }
  return databaseName;
}

function buildAdminUrl(databaseUrl: string, adminDbName: string) {
  const url = new URL(databaseUrl);
  url.pathname = `/${encodeURIComponent(adminDbName)}`;
  return url.toString();
}

async function ensureDatabaseExists(databaseUrl: string) {
  const targetDbName = parseDatabaseName(databaseUrl);
  const adminDbName = process.env.POSTGRES_ADMIN_DB ?? "postgres";

  const adminUrl = buildAdminUrl(databaseUrl, adminDbName);
  const client = new Client({ connectionString: adminUrl });

  await client.connect();
  try {
    const existsResult = await client.query(
      "select 1 from pg_database where datname = $1",
      [targetDbName]
    );

    if (existsResult.rowCount && existsResult.rowCount > 0) {
      console.log(`✓ Database already exists: ${targetDbName}`);
      return;
    }

    console.log(`Creating database: ${targetDbName}`);
    await client.query(`create database ${quoteIdent(targetDbName)}`);
    console.log(`✓ Database created: ${targetDbName}`);
  } finally {
    await client.end();
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(
      "DATABASE_URL is not set. Add it to .env.local (or export it) before running db setup."
    );
    process.exit(1);
  }

  try {
    await ensureDatabaseExists(databaseUrl);
  } catch (error) {
    console.error("❌ Failed to ensure database exists:", error);
    console.error(
      "Tip: Ensure your Postgres user has CREATEDB privileges, or create the database manually and re-run."
    );
    process.exit(1);
  }
}

main();
