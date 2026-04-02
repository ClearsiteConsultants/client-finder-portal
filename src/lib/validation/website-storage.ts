export const MAX_STORED_WEBSITE_LENGTH = 100;

const TRACKING_QUERY_PARAM_NAMES = new Set([
  'y_source',
]);

function isTrackingQueryParam(paramName: string): boolean {
  return /^utm_/i.test(paramName) || TRACKING_QUERY_PARAM_NAMES.has(paramName.toLowerCase());
}

function stripTrackingQueryParams(url: string): string {
  try {
    const parsedUrl = new URL(url);
    const originalParams = Array.from(parsedUrl.searchParams.keys());

    for (const paramName of originalParams) {
      if (isTrackingQueryParam(paramName)) {
        parsedUrl.searchParams.delete(paramName);
      }
    }

    if (originalParams.length === Array.from(parsedUrl.searchParams.keys()).length) {
      return url;
    }

    return parsedUrl.toString();
  } catch {
    return url;
  }
}

export function normalizeStoredWebsite(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmedValue = value?.trim();
  if (!trimmedValue) {
    return null;
  }

  const sanitizedValue = stripTrackingQueryParams(trimmedValue);

  if (sanitizedValue.length <= MAX_STORED_WEBSITE_LENGTH) {
    return sanitizedValue;
  }

  return sanitizedValue.slice(0, MAX_STORED_WEBSITE_LENGTH);
}