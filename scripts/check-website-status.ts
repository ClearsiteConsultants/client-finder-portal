#!/usr/bin/env tsx

import { config } from 'dotenv';
config({ path: '.env.local', override: true });

import { Client } from 'pg';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set. Add it to .env.local before running this check.');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const unknownCountResult = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM businesses WHERE website_status::text = 'unknown'"
    );

    const statusCountsResult = await client.query<{
      website_status: string;
      count: string;
    }>(
      'SELECT website_status::text AS website_status, COUNT(*)::text AS count FROM businesses GROUP BY website_status ORDER BY website_status'
    );

    const enumValuesResult = await client.query<{ enum_value: string }>(
      `SELECT e.enumlabel AS enum_value
       FROM pg_type t
       JOIN pg_enum e ON t.oid = e.enumtypid
       WHERE t.typname = 'WebsiteStatus'
       ORDER BY e.enumsortorder`
    );

    const unknownCount = Number(unknownCountResult.rows[0]?.count || '0');

    console.log('WebsiteStatus enum values:');
    for (const row of enumValuesResult.rows) {
      console.log(`- ${row.enum_value}`);
    }

    console.log('\nBusiness counts by website_status:');
    for (const row of statusCountsResult.rows) {
      console.log(`- ${row.website_status}: ${row.count}`);
    }

    console.log(`\nUnknown rows remaining: ${unknownCount}`);

    if (unknownCount === 0) {
      console.log('PASS: No businesses are using legacy unknown website status.');
      return;
    }

    console.error('FAIL: Legacy unknown website status rows still exist.');
    process.exit(2);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Failed to check website statuses:', error);
  process.exit(1);
});
