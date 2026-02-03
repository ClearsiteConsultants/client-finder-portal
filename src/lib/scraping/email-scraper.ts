import { EmailSource } from '@prisma/client';

export interface EmailScrapingResult {
  emails: EmailInfo[];
  pagesScraped: number;
  robotsTxtAllowed: boolean;
  error?: string;
}

export interface EmailInfo {
  email: string;
  source: EmailSource;
  confidence: number;
  foundOnPage?: string;
}

export interface ScraperConfig {
  maxPages?: number;
  maxDepth?: number;
  timeoutMs?: number;
  respectRobotsTxt?: boolean;
  userAgent?: string;
}

const DEFAULT_CONFIG: Required<ScraperConfig> = {
  maxPages: 5,
  maxDepth: 2,
  timeoutMs: 10000,
  respectRobotsTxt: true,
  userAgent: 'Mozilla/5.0 (compatible; ClientFinderBot/1.0)',
};

// Email regex pattern - validates common email formats
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

// Common pages to check for contact information
const CONTACT_PATHS = [
  '/contact',
  '/contact-us',
  '/about',
  '/about-us',
];

/**
 * Extracts email addresses from HTML content
 */
export function extractEmailsFromHtml(html: string, pageUrl: string): EmailInfo[] {
  const emails: EmailInfo[] = [];
  const foundEmails = new Set<string>();

  // Extract from mailto links (high confidence)
  const mailtoRegex = /href=["']mailto:([^"']+)["']/gi;
  let match;
  while ((match = mailtoRegex.exec(html)) !== null) {
    const email = match[1].split('?')[0].split('&')[0].toLowerCase().trim();
    if (isValidEmail(email) && !foundEmails.has(email)) {
      foundEmails.add(email);
      emails.push({
        email,
        source: 'scraped' as EmailSource,
        confidence: 90,
        foundOnPage: pageUrl,
      });
    }
  }

  // Extract from plain text (medium confidence)
  const textMatches = html.match(EMAIL_REGEX);
  if (textMatches) {
    for (const email of textMatches) {
      const normalizedEmail = email.toLowerCase().trim();
      if (isValidEmail(normalizedEmail) && !foundEmails.has(normalizedEmail)) {
        foundEmails.add(normalizedEmail);
        emails.push({
          email: normalizedEmail,
          source: 'scraped' as EmailSource,
          confidence: 70,
          foundOnPage: pageUrl,
        });
      }
    }
  }

  return emails;
}

/**
 * Validates email format and filters out common false positives
 */
export function isValidEmail(email: string): boolean {
  if (!email || email.length < 5 || email.length > 254) {
    return false;
  }

  // Basic format check (create new regex to avoid lastIndex issues)
  const emailTest = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/;
  if (!emailTest.test(email)) {
    return false;
  }

  // Filter out common false positives
  const invalidPatterns = [
    /\.(png|jpg|jpeg|gif|svg|css|js|woff|ttf|eot)@/i, // File extensions before @
    /^(example|test|demo|noreply|no-reply)@/i,
    /@(test|localhost)\./, // Test and localhost domains
    /^.+@domain\./, // Emails at @domain.* (placeholder)
  ];

  for (const pattern of invalidPatterns) {
    if (pattern.test(email)) {
      return false;
    }
  }

  return true;
}

/**
 * Checks robots.txt to see if scraping is allowed for a given path
 */
export async function checkRobotsTxt(
  baseUrl: string,
  path: string,
  userAgent: string
): Promise<boolean> {
  try {
    const robotsUrl = new URL('/robots.txt', baseUrl).href;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(robotsUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': userAgent },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // If robots.txt doesn't exist or errors, assume allowed
      return true;
    }

    const robotsTxt = await response.text();
    
    // Simple robots.txt parser - checks for Disallow directives
    const lines = robotsTxt.split('\n');
    let relevantSection = false;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Check if this section applies to our user agent
      if (trimmedLine.toLowerCase().startsWith('user-agent:')) {
        const agent = trimmedLine.substring(11).trim();
        relevantSection = agent === '*' || agent.toLowerCase().includes('clientfinderbot');
      }
      
      // Check for Disallow rules in relevant section
      if (relevantSection && trimmedLine.toLowerCase().startsWith('disallow:')) {
        const disallowedPath = trimmedLine.substring(9).trim();
        if (disallowedPath === '/' || path.startsWith(disallowedPath)) {
          return false;
        }
      }
    }

    return true;
  } catch {
    // If we can't check robots.txt, assume allowed
    return true;
  }
}

/**
 * Fetches a page with timeout and returns HTML content
 */
async function fetchPage(url: string, timeoutMs: number, userAgent: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': userAgent,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return null;
    }

    return await response.text();
  } catch {
    return null;
  }
}

/**
 * Gets internal links from HTML that might contain contact information
 */
function extractContactLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const linkRegex = /href=["']([^"']+)["']/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    
    // Skip external links, anchors, and javascript
    if (href.startsWith('http') || href.startsWith('#') || href.startsWith('javascript:')) {
      continue;
    }

    try {
      const fullUrl = new URL(href, baseUrl).href;
      const path = new URL(fullUrl).pathname.toLowerCase();
      
      // Check if path looks like a contact page
      if (CONTACT_PATHS.some(cp => path.includes(cp))) {
        links.push(fullUrl);
      }
    } catch {
      // Invalid URL, skip
    }
  }

  return [...new Set(links)]; // Remove duplicates
}

/**
 * Scrapes a website for email addresses
 */
export async function scrapeEmailsFromWebsite(
  url: string,
  config: ScraperConfig = {}
): Promise<EmailScrapingResult> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const allEmails = new Map<string, EmailInfo>();
  const visitedUrls = new Set<string>();
  let pagesScraped = 0;
  let robotsTxtAllowed = true;

  try {
    const baseUrl = new URL(url);
    
    // Check robots.txt for the main page
    if (finalConfig.respectRobotsTxt) {
      robotsTxtAllowed = await checkRobotsTxt(
        baseUrl.origin,
        baseUrl.pathname,
        finalConfig.userAgent
      );
      
      if (!robotsTxtAllowed) {
        return {
          emails: [],
          pagesScraped: 0,
          robotsTxtAllowed: false,
        };
      }
    }

    // Fetch and process the main page
    const mainHtml = await fetchPage(url, finalConfig.timeoutMs, finalConfig.userAgent);
    
    if (mainHtml) {
      pagesScraped++;
      visitedUrls.add(url);
      
      const emails = extractEmailsFromHtml(mainHtml, url);
      emails.forEach(info => {
        if (!allEmails.has(info.email)) {
          allEmails.set(info.email, info);
        }
      });

      // If we found emails on the main page and we're at max depth 0, stop here
      if (allEmails.size > 0 && finalConfig.maxDepth === 0) {
        return {
          emails: Array.from(allEmails.values()),
          pagesScraped,
          robotsTxtAllowed,
        };
      }

      // Extract potential contact pages
      const contactLinks = extractContactLinks(mainHtml, url);
      
      // Visit contact pages (up to maxPages limit)
      for (const link of contactLinks) {
        if (pagesScraped >= finalConfig.maxPages) {
          break;
        }
        
        if (visitedUrls.has(link)) {
          continue;
        }

        // Check robots.txt for this path
        if (finalConfig.respectRobotsTxt) {
          const linkUrl = new URL(link);
          const allowed = await checkRobotsTxt(
            linkUrl.origin,
            linkUrl.pathname,
            finalConfig.userAgent
          );
          
          if (!allowed) {
            continue;
          }
        }

        const pageHtml = await fetchPage(link, finalConfig.timeoutMs, finalConfig.userAgent);
        
        if (pageHtml) {
          pagesScraped++;
          visitedUrls.add(link);
          
          const emails = extractEmailsFromHtml(pageHtml, link);
          emails.forEach(info => {
            if (!allEmails.has(info.email)) {
              allEmails.set(info.email, info);
            }
          });
        }
      }
    }

    return {
      emails: Array.from(allEmails.values()),
      pagesScraped,
      robotsTxtAllowed,
    };
  } catch (error) {
    return {
      emails: Array.from(allEmails.values()),
      pagesScraped,
      robotsTxtAllowed,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
