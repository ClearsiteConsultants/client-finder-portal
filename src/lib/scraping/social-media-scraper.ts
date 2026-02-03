export interface SocialMediaUrls {
  facebookUrl?: string;
  instagramUrl?: string;
  linkedinUrl?: string;
}

export interface SocialMediaScrapingResult extends SocialMediaUrls {
  foundUrls: number;
  error?: string;
}

// Patterns for social media URLs
const SOCIAL_PATTERNS = {
  facebook: /(?:https?:\/\/)?(?:www\.)?(?:facebook\.com|fb\.com)\/(?:pages\/)?(?:[\w\-\.]+\/)*?([\w\-\.]+)/gi,
  instagram: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([\w\-\.]+)/gi,
  linkedin: /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:company|in)\/([\w\-]+)/gi,
};

/**
 * Normalizes a social media URL by removing tracking parameters and standardizing format
 */
export function normalizeSocialUrl(url: string, platform: 'facebook' | 'instagram' | 'linkedin'): string | null {
  try {
    const trimmed = url.trim();
    
    // Add protocol if missing
    let fullUrl = trimmed;
    if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
      fullUrl = 'https://' + fullUrl;
    }

    const parsedUrl = new URL(fullUrl);
    
    // Normalize hostname to lowercase
    parsedUrl.hostname = parsedUrl.hostname.toLowerCase();
    
    // Platform-specific normalization
    switch (platform) {
      case 'facebook': {
        // Normalize to facebook.com (not fb.com)
        if (parsedUrl.hostname.includes('fb.com')) {
          parsedUrl.hostname = 'www.facebook.com';
        } else if (!parsedUrl.hostname.includes('www.')) {
          parsedUrl.hostname = 'www.facebook.com';
        }
        
        // Remove query params (tracking)
        parsedUrl.search = '';
        parsedUrl.hash = '';
        
        // Clean up common paths
        let path = parsedUrl.pathname;
        path = path.replace(/\/pages\/[^\/]+\//, '/');
        path = path.replace(/\/$/, ''); // Remove trailing slash
        
        // Filter out generic pages
        const invalidPaths = ['/home', '/login', '/signup', '/marketplace', '/groups'];
        if (invalidPaths.some(p => path === p || path.startsWith(p + '/'))) {
          return null;
        }
        
        parsedUrl.pathname = path;
        break;
      }
      
      case 'instagram': {
        // Normalize hostname
        if (!parsedUrl.hostname.includes('www.')) {
          parsedUrl.hostname = 'www.instagram.com';
        }
        
        // Remove query params and hash
        parsedUrl.search = '';
        parsedUrl.hash = '';
        
        // Clean path
        let path = parsedUrl.pathname.replace(/\/$/, '');
        
        // Filter out generic pages
        const invalidPaths = ['/explore', '/accounts', '/direct', '/stories', '/tv', '/reels'];
        if (invalidPaths.some(p => path === p || path.startsWith(p + '/'))) {
          return null;
        }
        
        parsedUrl.pathname = path;
        break;
      }
      
      case 'linkedin': {
        // Normalize hostname
        if (!parsedUrl.hostname.includes('www.')) {
          parsedUrl.hostname = 'www.linkedin.com';
        }
        
        // Remove query params and hash
        parsedUrl.search = '';
        parsedUrl.hash = '';
        
        // Clean path
        let path = parsedUrl.pathname.replace(/\/$/, '');
        
        // Only keep /company/ or /in/ paths
        if (!path.startsWith('/company/') && !path.startsWith('/in/')) {
          return null;
        }
        
        parsedUrl.pathname = path;
        break;
      }
    }
    
    const result = parsedUrl.href;
    
    // Validate the URL has a meaningful path
    if (result.endsWith('facebook.com/') || result.endsWith('instagram.com/') || result.endsWith('linkedin.com/')) {
      return null;
    }
    
    return result;
  } catch {
    return null;
  }
}

/**
 * Extracts social media URLs from HTML content
 */
export function extractSocialMediaFromHtml(html: string): SocialMediaUrls {
  const result: SocialMediaUrls = {};
  
  // Extract Facebook URLs
  const facebookUrls = new Set<string>();
  let match;
  const fbRegex = new RegExp(SOCIAL_PATTERNS.facebook.source, 'gi');
  while ((match = fbRegex.exec(html)) !== null) {
    const normalized = normalizeSocialUrl(match[0], 'facebook');
    if (normalized) {
      facebookUrls.add(normalized);
    }
  }
  
  // Take the first valid Facebook URL (most prominent)
  if (facebookUrls.size > 0) {
    result.facebookUrl = Array.from(facebookUrls)[0];
  }
  
  // Extract Instagram URLs
  const instagramUrls = new Set<string>();
  const igRegex = new RegExp(SOCIAL_PATTERNS.instagram.source, 'gi');
  while ((match = igRegex.exec(html)) !== null) {
    const normalized = normalizeSocialUrl(match[0], 'instagram');
    if (normalized) {
      instagramUrls.add(normalized);
    }
  }
  
  if (instagramUrls.size > 0) {
    result.instagramUrl = Array.from(instagramUrls)[0];
  }
  
  // Extract LinkedIn URLs
  const linkedinUrls = new Set<string>();
  const liRegex = new RegExp(SOCIAL_PATTERNS.linkedin.source, 'gi');
  while ((match = liRegex.exec(html)) !== null) {
    const normalized = normalizeSocialUrl(match[0], 'linkedin');
    if (normalized) {
      linkedinUrls.add(normalized);
    }
  }
  
  if (linkedinUrls.size > 0) {
    result.linkedinUrl = Array.from(linkedinUrls)[0];
  }
  
  return result;
}

/**
 * Scrapes a website for social media URLs
 */
export async function scrapeSocialMediaFromWebsite(
  url: string,
  timeoutMs: number = 10000
): Promise<SocialMediaScrapingResult> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ClientFinderBot/1.0)',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        foundUrls: 0,
        error: `HTTP ${response.status}`,
      };
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return {
        foundUrls: 0,
        error: 'Not an HTML page',
      };
    }

    const html = await response.text();
    const socialUrls = extractSocialMediaFromHtml(html);
    
    const foundUrls = [
      socialUrls.facebookUrl,
      socialUrls.instagramUrl,
      socialUrls.linkedinUrl,
    ].filter(Boolean).length;

    return {
      ...socialUrls,
      foundUrls,
    };
  } catch (error) {
    return {
      foundUrls: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Determines if a business should be marked as social_only based on website and social presence
 */
export function isSocialOnly(
  hasWorkingWebsite: boolean,
  socialUrls: SocialMediaUrls
): boolean {
  if (hasWorkingWebsite) {
    return false;
  }
  
  // If no working website but has at least one social profile
  const hasSocialProfiles = !!(
    socialUrls.facebookUrl ||
    socialUrls.instagramUrl ||
    socialUrls.linkedinUrl
  );
  
  return hasSocialProfiles;
}
