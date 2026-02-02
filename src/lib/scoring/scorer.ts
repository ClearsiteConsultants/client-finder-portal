/**
 * Small Business Scoring System
 * 
 * Assigns a score (0-100) to each business based on defined criteria.
 * Higher scores indicate better prospects for website services.
 */

export interface ScoringConfig {
  reviewCount: {
    min: number;
    max: number;
    points: number;
  };
  notInChains: {
    points: number;
  };
  uniqueDomain: {
    points: number;
  };
  targetBusinessTypes: {
    points: number;
  };
  qualifiedThreshold: number;
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  reviewCount: {
    min: 10,
    max: 200,
    points: 30,
  },
  notInChains: {
    points: 30,
  },
  uniqueDomain: {
    points: 20,
  },
  targetBusinessTypes: {
    points: 20,
  },
  qualifiedThreshold: 70,
};

export interface BusinessScoringInput {
  name: string;
  reviewCount?: number | null;
  businessTypes: string[];
  website?: string | null;
}

export interface ScoringResult {
  score: number;
  breakdown: {
    reviewCount: number;
    notInChains: number;
    uniqueDomain: number;
    targetBusinessTypes: number;
  };
  qualified: boolean;
  isVIP: boolean; // no_website or social_only
}

// Known chains and franchises (case-insensitive matching)
const KNOWN_CHAINS = new Set([
  'mcdonalds',
  'starbucks',
  'subway',
  'walmart',
  'target',
  'walgreens',
  'cvs',
  'wendys',
  'burger king',
  'taco bell',
  'pizza hut',
  'dominos',
  'papa johns',
  'kfc',
  'chipotle',
  '7-eleven',
  'dunkin',
  'panera',
  'applebees',
  'chilis',
  'olive garden',
  'red lobster',
  'outback',
  'panda express',
  'five guys',
  'in-n-out',
  'shake shack',
  'sonic',
  'arbys',
  'jack in the box',
  'popeyes',
  'whataburger',
  'carls jr',
  'hardees',
  'dairy queen',
  'jimmyjohns',
  'jersey mikes',
  'firehouse subs',
  'qdoba',
  'moes',
  'buffalo wild wings',
  'wingstop',
  'ihop',
  'dennys',
  'waffle house',
  'cracker barrel',
  'chick-fil-a',
  'raising canes',
  'zaxbys',
  'el pollo loco',
  'del taco',
  'wienerschnitzel',
  'white castle',
  'culvers',
  'checkers',
  'rallys',
  'churchs chicken',
  'bojangles',
  'pollo tropical',
  'tropical smoothie',
  'smoothie king',
  'jamba juice',
  'baskin-robbins',
  'cold stone',
  'dairy queen',
  'ben & jerrys',
  'haagen-dazs',
  'auntie annes',
  'cinnabon',
  'krispy kreme',
  'tim hortons',
  'peets coffee',
  'caribou coffee',
  'costa coffee',
  'the coffee bean',
  // Retail chains
  'best buy',
  'home depot',
  'lowes',
  'costco',
  'sams club',
  'publix',
  'kroger',
  'safeway',
  'albertsons',
  'whole foods',
  'trader joes',
  'aldi',
  'lidl',
  'food lion',
  'giant eagle',
  'wegmans',
  'heb',
  'meijer',
  'winn-dixie',
  'fred meyer',
  // Service chains
  'great clips',
  'supercuts',
  'sport clips',
  'fantastic sams',
  'regis',
  'smartstyle',
  'mastercuts',
  '24 hour fitness',
  'planet fitness',
  'la fitness',
  'anytime fitness',
  'golds gym',
  'crunch fitness',
  'equinox',
  'orange theory',
  'f45',
  'crossfit',
  // Auto services
  'jiffy lube',
  'midas',
  'meineke',
  'pep boys',
  'autozone',
  'advance auto',
  'oreilly',
  'napa',
  'firestone',
  'goodyear',
  'discount tire',
  // Banks & Financial
  'bank of america',
  'chase',
  'wells fargo',
  'citibank',
  'us bank',
  'pnc',
  'td bank',
  'capital one',
  'regions',
  'fifth third',
  'suntrust',
  'bbt',
  // Other
  'fedex',
  'ups',
  'usps',
  'dhl',
  'shell',
  'exxon',
  'chevron',
  'bp',
  'texaco',
  'mobil',
  'marathon',
  'speedway',
  'circle k',
  'ampm',
]);

// Target business types (Google Places API types)
// See: https://developers.google.com/maps/documentation/places/web-service/supported_types
const TARGET_BUSINESS_TYPES = new Set([
  'restaurant',
  'cafe',
  'bar',
  'bakery',
  'food',
  'meal_delivery',
  'meal_takeaway',
  'clothing_store',
  'store',
  'jewelry_store',
  'shoe_store',
  'home_goods_store',
  'furniture_store',
  'electronics_store',
  'book_store',
  'florist',
  'gift_shop',
  'beauty_salon',
  'hair_care',
  'spa',
  'gym',
  'dentist',
  'doctor',
  'lawyer',
  'accounting',
  'real_estate_agency',
  'insurance_agency',
  'plumber',
  'electrician',
  'general_contractor',
  'roofing_contractor',
  'painter',
  'moving_company',
  'locksmith',
  'car_repair',
  'car_wash',
  'veterinary_care',
  'pet_store',
  'pharmacy',
  'physiotherapist',
  'primary_school',
  'secondary_school',
  'university',
]);

// Corporate/shared domains that indicate enterprise websites
const CORPORATE_DOMAINS = new Set([
  'facebook.com',
  'instagram.com',
  'yelp.com',
  'yellowpages.com',
  'google.com',
  'wordpress.com',
  'wix.com',
  'squarespace.com',
  'weebly.com',
  'godaddy.com',
  'shopify.com',
  'bigcartel.com',
  'etsy.com',
  'amazon.com',
  'ebay.com',
  'craigslist.org',
  'nextdoor.com',
  'angieslist.com',
  'homeadvisor.com',
  'thumbtack.com',
  'houzz.com',
  'zomato.com',
  'opentable.com',
  'grubhub.com',
  'doordash.com',
  'ubereats.com',
  'seamless.com',
  'postmates.com',
]);

/**
 * Normalize business name for comparison
 * - Lowercase
 * - Remove punctuation and special characters
 * - Trim whitespace
 */
export function normalizeBusinessName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if a business name matches a known chain
 */
export function isKnownChain(businessName: string): boolean {
  const normalized = normalizeBusinessName(businessName);
  
  // Check for exact matches
  if (KNOWN_CHAINS.has(normalized)) {
    return true;
  }
  
  // Check for partial matches (chain name appears in business name)
  for (const chain of KNOWN_CHAINS) {
    if (normalized.includes(chain)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if business has a unique domain (not a shared corporate site)
 */
export function hasUniqueDomain(website: string | null | undefined): boolean {
  if (!website) {
    return false;
  }
  
  try {
    const url = new URL(website.startsWith('http') ? website : `https://${website}`);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    
    // Check if it's a corporate/shared domain
    for (const domain of CORPORATE_DOMAINS) {
      if (hostname === domain || hostname.endsWith(`.${domain}`)) {
        return false;
      }
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if business has target business types
 */
export function hasTargetBusinessType(businessTypes: string[]): boolean {
  return businessTypes.some(type => TARGET_BUSINESS_TYPES.has(type.toLowerCase()));
}

/**
 * Calculate small business score
 */
export function calculateScore(
  business: BusinessScoringInput,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG
): ScoringResult {
  const breakdown = {
    reviewCount: 0,
    notInChains: 0,
    uniqueDomain: 0,
    targetBusinessTypes: 0,
  };
  
  // Review count (10-200 range)
  if (
    business.reviewCount !== null &&
    business.reviewCount !== undefined &&
    business.reviewCount >= config.reviewCount.min &&
    business.reviewCount <= config.reviewCount.max
  ) {
    breakdown.reviewCount = config.reviewCount.points;
  }
  
  // Not in known chains
  if (!isKnownChain(business.name)) {
    breakdown.notInChains = config.notInChains.points;
  }
  
  // Unique domain
  if (hasUniqueDomain(business.website)) {
    breakdown.uniqueDomain = config.uniqueDomain.points;
  }
  
  // Target business types
  if (hasTargetBusinessType(business.businessTypes)) {
    breakdown.targetBusinessTypes = config.targetBusinessTypes.points;
  }
  
  const score = Object.values(breakdown).reduce((sum, points) => sum + points, 0);
  const qualified = score >= config.qualifiedThreshold;
  
  // VIP leads are businesses without websites (these are top priority)
  const isVIP = !business.website || business.website.trim() === '';
  
  return {
    score,
    breakdown,
    qualified,
    isVIP,
  };
}

/**
 * Export for external configuration/testing
 */
export const SCORING_CONSTANTS = {
  KNOWN_CHAINS,
  TARGET_BUSINESS_TYPES,
  CORPORATE_DOMAINS,
};
