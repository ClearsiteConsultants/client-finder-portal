import { __internal, getDatabaseConnectionString } from './database-url';

describe('database-url', () => {
  describe('extractDatabaseUrlFromEnvContent', () => {
    it('extracts DATABASE_URL with $ in the middle of the password', () => {
      const content =
        'NEXTAUTH_SECRET=test\nDATABASE_URL=postgresql://postgres:abc$123def@localhost:5432/quizmaster\n';

      expect(__internal.extractDatabaseUrlFromEnvContent(content)).toBe(
        'postgresql://postgres:abc$123def@localhost:5432/quizmaster',
      );
    });

    it('extracts quoted DATABASE_URL and unescapes escaped dollar', () => {
      const content =
        'DATABASE_URL="postgresql://postgres:abc\\$123def@localhost:5432/quizmaster"';

      expect(__internal.extractDatabaseUrlFromEnvContent(content)).toBe(
        'postgresql://postgres:abc$123def@localhost:5432/quizmaster',
      );
    });
  });

  describe('getDatabaseConnectionString', () => {
    it('prefers raw local value when current env value appears expanded', () => {
      const currentValue = 'postgresql://postgres:abcdef@localhost:5432/quizmaster';
      const rawLocalValue = 'postgresql://postgres:abc$123def@localhost:5432/quizmaster';

      expect(getDatabaseConnectionString(currentValue, 'development', rawLocalValue)).toBe(
        rawLocalValue,
      );
    });

    it('keeps current value when it already contains dollar sign', () => {
      const currentValue = 'postgresql://postgres:abc$123def@localhost:5432/quizmaster';
      const rawLocalValue = 'postgresql://postgres:abc$123def@localhost:5432/quizmaster';

      expect(getDatabaseConnectionString(currentValue, 'development', rawLocalValue)).toBe(
        currentValue,
      );
    });

    it('never overrides in production', () => {
      const currentValue = 'postgresql://postgres:abcdef@db:5432/prod';
      const rawLocalValue = 'postgresql://postgres:abc$123def@localhost:5432/local';

      expect(getDatabaseConnectionString(currentValue, 'production', rawLocalValue)).toBe(
        currentValue,
      );
    });
  });
});
