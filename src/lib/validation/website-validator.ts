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
  html: string;
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
    const html = await response.text();

    return {
      startTime,
      endTime,
      responseCode: response.status,
      hasSSL: url.startsWith('https://'),
      html,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Checks for mobile viewport meta tag
 */
function checkMobileViewport(html: string): boolean {
  const lowerHtml = html.toLowerCase();
  return (
    lowerHtml.includes('viewport') &&
    (lowerHtml.includes('width=device-width') || lowerHtml.includes('initial-scale'))
  );
}

async function detectOutdatedIssues(baseUrl: string, html: string): Promise<string[]> {
  const issues: string[] = [];

  // Mixed content indicates old/insecure page composition.
  if (/(?:src|href)=['\"]http:\/\//i.test(html)) {
    issues.push('Mixed content (HTTP assets on HTTPS page)');
  }

  const links = Array.from(html.matchAll(/<a\s+[^>]*href=['"]([^'"]+)['"]/gi))
    .map(match => match[1])
    .filter(link => {
      const trimmed = link.trim().toLowerCase();
      return (
        trimmed.length > 0 &&
        !trimmed.startsWith('#') &&
        !trimmed.startsWith('mailto:') &&
        !trimmed.startsWith('tel:') &&
        !trimmed.startsWith('javascript:')
      );
    })
    .slice(0, 5);

  for (const link of links) {
    try {
      const resolved = new URL(link, baseUrl).toString();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(resolved, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ClientFinderBot/1.0)',
        },
      });

      clearTimeout(timeoutId);

      if (response.status >= 400) {
        issues.push(`Broken link detected (${response.status})`);
        break;
      }
    } catch {
      issues.push('Broken link detected (unreachable)');
      break;
    }
  }

  return issues;
}

/**
 * Classifies a website based on validation results
 */
function classifyWebsite(
  url: string | null,
  metrics: FetchMetrics | null,
  hasMobileViewport: boolean,
  outdatedIssues: string[],
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
  const technicalIssues: string[] = [];

  if (!hasSSL) {
    technicalIssues.push('No HTTPS/SSL');
  }

  if (loadTimeMs > SLOW_LOAD_THRESHOLD_MS) {
    technicalIssues.push(`Slow load time: ${loadTimeMs}ms`);
  }

  if (!hasMobileViewport) {
    technicalIssues.push('No mobile viewport meta tag');
  }

  if (outdatedIssues.length > 0) {
    return { status: 'outdated', issues: outdatedIssues };
  }

  if (technicalIssues.length > 0) {
    return { status: 'technical_issues', issues: technicalIssues };
  }

  return { status: 'acceptable', issues };
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
  let outdatedIssues: string[] = [];

  try {
    metrics = await fetchWithMetrics(normalizedUrl);
    
    // Only check mobile viewport if the initial fetch succeeded
    if (metrics.responseCode >= 200 && metrics.responseCode < 400) {
      hasMobileViewport = checkMobileViewport(metrics.html);
      outdatedIssues = await detectOutdatedIssues(normalizedUrl, metrics.html);
    }
  } catch (err) {
    error = err as Error;
  }

  const { status, issues } = classifyWebsite(
    normalizedUrl,
    metrics,
    hasMobileViewport ?? false,
    outdatedIssues,
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
