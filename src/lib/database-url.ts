import fs from 'fs';
import path from 'path';

function extractDatabaseUrlFromEnvContent(fileContent: string): string | undefined {
  const line = fileContent
    .split(/\r?\n/)
    .find((entry) => entry.trimStart().startsWith('DATABASE_URL='));

  if (!line) {
    return undefined;
  }

  const rawValue = line.slice(line.indexOf('=') + 1).trim();
  if (!rawValue) {
    return undefined;
  }

  const unquoted =
    (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
    (rawValue.startsWith("'") && rawValue.endsWith("'"))
      ? rawValue.slice(1, -1)
      : rawValue;

  return unquoted.replace(/\\\$/g, '$');
}

function readRawDatabaseUrlFromLocalEnv(): string | undefined {
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    const fileContent = fs.readFileSync(envPath, 'utf8');
    return extractDatabaseUrlFromEnvContent(fileContent);
  } catch {
    return undefined;
  }
}

export function getDatabaseConnectionString(
  currentValue: string | undefined,
  nodeEnv: string | undefined,
  rawLocalValue: string | undefined = readRawDatabaseUrlFromLocalEnv(),
): string | undefined {
  if (process.env.CFP_FORCE_DATABASE_URL === '1') {
    return currentValue;
  }

  if (nodeEnv === 'production') {
    return currentValue;
  }

  if (!rawLocalValue) {
    return currentValue;
  }

  const localLooksExpanded =
    rawLocalValue.includes('$') && (!currentValue || !currentValue.includes('$'));

  return localLooksExpanded ? rawLocalValue : currentValue;
}

export const __internal = {
  extractDatabaseUrlFromEnvContent,
};
