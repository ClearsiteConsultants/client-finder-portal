import { WebsiteStatus } from '@prisma/client';

export interface WebsiteValidationResult {
  status: WebsiteStatus;
  responseCode?: number;
  loadTimeMs?: number;
  hasSSL?: boolean;
  hasMobileViewport?: boolean;
  detectedIssues: string[];
  error?: string;
}

interface FetchMetrics {
  startTime: number;
  endTime: number;
  responseCode: number;
  hasSSL: boolean;
}

const TIMEOUT_MS = 10000; // 10 seconds
const SLOW_LOAD_THRESHOLD_MS = 5000; // 5 seconds

/**
 * Normalizes a website URL to a standard format
 */
export function normalizeUrl(url: string | null | undefined): string | null {
  if (!url || url.trim() === '') {
    return null;
  }

  let normalized = url.trim().toLowerCase();

  // Add protocol if missing
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = 'https://' + normalized;
  }

  try {
    const parsedUrl = new URL(normalized);
    return parsedUrl.href;
  } catch {
    return null;
  }
}

/**
 * Fetches a URL with timeout and returns metrics
 */
async function fetchWithMetrics(url: string): Promise<FetchMetrics> {
  const startTime = Date.now();
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ClientFinderBot/1.0)',
      },
    });

    clearTimeout(timeoutId);
    const endTime = Date.now();

    return {
      startTime,
      endTime,
      responseCode: response.status,
      hasSSL: url.startsWith('https://'),
    };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Checks for mobile viewport meta tag
 */
async function checkMobileViewport(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ClientFinderBot/1.0)',
      },
    });

    clearTimeout(timeoutId);

    const html = await response.text();
    const hasMobileViewport = html.toLowerCase().includes('viewport') &&
                             (html.toLowerCase().includes('width=device-width') ||
                              html.toLowerCase().includes('initial-scale'));

    return hasMobileViewport;
  } catch {
    return false;
  }
}

/**
 * Classifies a website based on validation results
 */
function classifyWebsite(
  url: string | null,
  metrics: FetchMetrics | null,
  hasMobileViewport: boolean,
  error: Error | null
): { status: WebsiteStatus; issues: string[] } {
  const issues: string[] = [];

  // No website
  if (!url) {
    return { status: 'no_website', issues };
  }

  // Network/fetch errors
  if (error) {
    if (error.name === 'AbortError') {
      issues.push('Request timed out');
      return { status: 'broken', issues };
    }
    issues.push(`Network error: ${error.message}`);
    return { status: 'broken', issues };
  }

  if (!metrics) {
    issues.push('Unable to fetch website');
    return { status: 'broken', issues };
  }

  const { responseCode, hasSSL, startTime, endTime } = metrics;
  const loadTimeMs = endTime - startTime;

  // Broken - 4xx/5xx errors
  if (responseCode >= 400) {
    issues.push(`HTTP ${responseCode} error`);
    return { status: 'broken', issues };
  }

  // Check for technical issues
  if (!hasSSL) {
    issues.push('No HTTPS/SSL');
  }

  if (loadTimeMs > SLOW_LOAD_THRESHOLD_MS) {
    issues.push(`Slow load time: ${loadTimeMs}ms`);
  }

  if (!hasMobileViewport) {
    issues.push('No mobile viewport meta tag');
  }

  // Determine final status
  if (issues.length === 0) {
    return { status: 'acceptable', issues };
  }

  // If it has SSL issues or is very slow, it's outdated
  if (!hasSSL || loadTimeMs > SLOW_LOAD_THRESHOLD_MS) {
    return { status: 'outdated', issues };
  }

  // Otherwise, technical issues
  return { status: 'technical_issues', issues };
}

/**
 * Validates a website URL and returns structured result
 */
export async function validateWebsite(
  url: string | null | undefined
): Promise<WebsiteValidationResult> {
  const normalizedUrl = normalizeUrl(url);

  // No website
  if (!normalizedUrl) {
    return {
      status: 'no_website',
      detectedIssues: [],
    };
  }

  let metrics: FetchMetrics | null = null;
  let error: Error | null = null;
  let hasMobileViewport: boolean | undefined = undefined;

  try {
    metrics = await fetchWithMetrics(normalizedUrl);
    
    // Only check mobile viewport if the initial fetch succeeded
    if (metrics.responseCode >= 200 && metrics.responseCode < 400) {
      hasMobileViewport = await checkMobileViewport(normalizedUrl);
    }
  } catch (err) {
    error = err as Error;
  }

  const { status, issues } = classifyWebsite(
    normalizedUrl,
    metrics,
    hasMobileViewport ?? false,
    error
  );

  return {
    status,
    responseCode: metrics?.responseCode,
    loadTimeMs: metrics ? metrics.endTime - metrics.startTime : undefined,
    hasSSL: metrics?.hasSSL,
    hasMobileViewport,
    detectedIssues: issues,
    error: error?.message,
  };
}
