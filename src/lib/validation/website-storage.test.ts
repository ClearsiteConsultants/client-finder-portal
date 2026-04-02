import { MAX_STORED_WEBSITE_LENGTH, normalizeStoredWebsite } from './website-storage';

describe('normalizeStoredWebsite', () => {
  it('returns undefined when website is omitted', () => {
    expect(normalizeStoredWebsite(undefined)).toBeUndefined();
  });

  it('returns null when website is empty after trimming', () => {
    expect(normalizeStoredWebsite('   ')).toBeNull();
  });

  it('removes Google Maps tracking suffixes before saving', () => {
    const website = 'https://www.bigotires.com/location/ut/south-jordan/10227-s-redwood-rd-84095/044245?utm_source=google&utm_medium=maps&utm_campaign=google+maps&y_source=1_ODY2OTU3My03MTUtbG9jYXRpb24ud2Vic2l0ZQ%3D%3D';

    expect(normalizeStoredWebsite(website)).toBe(
      'https://www.bigotires.com/location/ut/south-jordan/10227-s-redwood-rd-84095/044245'
    );
  });

  it('preserves non-tracking query parameters', () => {
    const website = 'https://example.com/location?store=44&utm_source=google&y_source=abc';

    expect(normalizeStoredWebsite(website)).toBe('https://example.com/location?store=44');
  });

  it('truncates after removing tracking parameters when still oversized', () => {
    const oversizedWebsite = `https://example.com/${'a'.repeat(MAX_STORED_WEBSITE_LENGTH + 50)}?utm_source=google`;

    expect(normalizeStoredWebsite(oversizedWebsite)).toBe(
      `https://example.com/${'a'.repeat(MAX_STORED_WEBSITE_LENGTH - 'https://example.com/'.length)}`
    );
  });
});