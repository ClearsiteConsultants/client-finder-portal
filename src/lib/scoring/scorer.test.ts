/**
 * Tests for business scoring system
 */

import {
  calculateScore,
  normalizeBusinessName,
  isKnownChain,
  hasUniqueDomain,
  hasTargetBusinessType,
  DEFAULT_SCORING_CONFIG,
  type BusinessScoringInput,
} from './scorer';

describe('normalizeBusinessName', () => {
  it('should convert to lowercase', () => {
    expect(normalizeBusinessName('McDonald\'s')).toBe('mcdonalds');
  });

  it('should remove punctuation', () => {
    expect(normalizeBusinessName('Joe\'s Pizza & Pasta!')).toBe('joes pizza pasta');
  });

  it('should trim whitespace', () => {
    expect(normalizeBusinessName('  Starbucks  ')).toBe('starbucks');
  });

  it('should normalize multiple spaces', () => {
    expect(normalizeBusinessName('Best   Buy')).toBe('best buy');
  });
});

describe('isKnownChain', () => {
  it('should detect exact chain matches', () => {
    expect(isKnownChain('McDonald\'s')).toBe(true);
    expect(isKnownChain('Starbucks')).toBe(true);
    expect(isKnownChain('walmart')).toBe(true);
  });

  it('should detect chains with store numbers', () => {
    expect(isKnownChain('Starbucks #1234')).toBe(true);
    expect(isKnownChain('Target Store 5678')).toBe(true);
  });

  it('should not detect non-chain businesses', () => {
    expect(isKnownChain('Joe\'s Coffee Shop')).toBe(false);
    expect(isKnownChain('Main Street Pizza')).toBe(false);
  });

  it('should be case-insensitive', () => {
    expect(isKnownChain('MCDONALDS')).toBe(true);
    expect(isKnownChain('starbucks')).toBe(true);
  });
});

describe('hasUniqueDomain', () => {
  it('should return false for null/undefined', () => {
    expect(hasUniqueDomain(null)).toBe(false);
    expect(hasUniqueDomain(undefined)).toBe(false);
    expect(hasUniqueDomain('')).toBe(false);
  });

  it('should return true for unique domains', () => {
    expect(hasUniqueDomain('https://joespizza.com')).toBe(true);
    expect(hasUniqueDomain('https://www.mainstreetcafe.com')).toBe(true);
    expect(hasUniqueDomain('example-business.com')).toBe(true);
  });

  it('should return false for corporate domains', () => {
    expect(hasUniqueDomain('https://facebook.com/joespizza')).toBe(false);
    expect(hasUniqueDomain('https://www.yelp.com/biz/joes-pizza')).toBe(false);
    expect(hasUniqueDomain('https://joespizza.wix.com')).toBe(false);
  });

  it('should handle URLs without protocol', () => {
    expect(hasUniqueDomain('joespizza.com')).toBe(true);
    expect(hasUniqueDomain('www.joespizza.com')).toBe(true);
  });

  it('should handle invalid URLs gracefully', () => {
    expect(hasUniqueDomain('not a valid url')).toBe(false);
  });
});

describe('hasTargetBusinessType', () => {
  it('should detect target business types', () => {
    expect(hasTargetBusinessType(['restaurant', 'food'])).toBe(true);
    expect(hasTargetBusinessType(['cafe', 'bakery'])).toBe(true);
    expect(hasTargetBusinessType(['dentist', 'doctor'])).toBe(true);
  });

  it('should return false for non-target types', () => {
    expect(hasTargetBusinessType(['bank', 'atm'])).toBe(false);
    expect(hasTargetBusinessType(['airport', 'bus_station'])).toBe(false);
  });

  it('should be case-insensitive', () => {
    expect(hasTargetBusinessType(['RESTAURANT'])).toBe(true);
    expect(hasTargetBusinessType(['Cafe'])).toBe(true);
  });

  it('should return false for empty array', () => {
    expect(hasTargetBusinessType([])).toBe(false);
  });
});

describe('calculateScore', () => {
  // Table-driven tests for various business scenarios
  const testCases: Array<{
    name: string;
    business: BusinessScoringInput;
    expectedScore: number;
    expectedQualified: boolean;
    expectedVIP: boolean;
    description: string;
  }> = [
    {
      name: 'Perfect small business',
      business: {
        name: 'Joe\'s Coffee Shop',
        reviewCount: 50,
        businessTypes: ['cafe', 'food'],
        website: 'https://joescoffee.com',
      },
      expectedScore: 100,
      expectedQualified: true,
      expectedVIP: false,
      description: 'Should score 100 with all criteria met',
    },
    {
      name: 'No website (VIP lead)',
      business: {
        name: 'Main Street Pizza',
        reviewCount: 100,
        businessTypes: ['restaurant', 'food'],
        website: null,
      },
      expectedScore: 80,
      expectedQualified: true,
      expectedVIP: true,
      description: 'Should be VIP with high score even without domain points',
    },
    {
      name: 'Known chain (McDonald\'s)',
      business: {
        name: 'McDonald\'s #1234',
        reviewCount: 150,
        businessTypes: ['restaurant', 'food'],
        website: 'https://mcdonalds.com',
      },
      expectedScore: 70,
      expectedQualified: true,
      expectedVIP: false,
      description: 'Should lose chain points but still qualify',
    },
    {
      name: 'Corporate website (Wix)',
      business: {
        name: 'Bella\'s Boutique',
        reviewCount: 75,
        businessTypes: ['clothing_store'],
        website: 'https://bellas.wix.com',
      },
      expectedScore: 80,
      expectedQualified: true,
      expectedVIP: false,
      description: 'Should lose domain points for Wix site',
    },
    {
      name: 'Too many reviews (enterprise)',
      business: {
        name: 'Tech Solutions Inc',
        reviewCount: 500,
        businessTypes: ['electronics_store'],
        website: 'https://techsolutions.com',
      },
      expectedScore: 70,
      expectedQualified: true,
      expectedVIP: false,
      description: 'Should lose review points for being too large',
    },
    {
      name: 'Too few reviews',
      business: {
        name: 'New Startup Cafe',
        reviewCount: 3,
        businessTypes: ['cafe'],
        website: 'https://newstartup.com',
      },
      expectedScore: 70,
      expectedQualified: true,
      expectedVIP: false,
      description: 'Should lose review points for too few reviews',
    },
    {
      name: 'Non-target business type',
      business: {
        name: 'City Bank Branch',
        reviewCount: 50,
        businessTypes: ['bank', 'atm', 'finance'],
        website: 'https://citybank.com',
      },
      expectedScore: 80,
      expectedQualified: true,
      expectedVIP: false,
      description: 'Should lose business type points',
    },
    {
      name: 'Unqualified lead',
      business: {
        name: 'Walmart Supercenter',
        reviewCount: 5000,
        businessTypes: ['department_store', 'grocery'],
        website: 'https://walmart.com',
      },
      expectedScore: 20,
      expectedQualified: false,
      expectedVIP: false,
      description: 'Chain with too many reviews should not qualify',
    },
    {
      name: 'Borderline qualified (threshold)',
      business: {
        name: 'Quick Fix Plumbing',
        reviewCount: 45,
        businessTypes: ['plumber'],
        website: 'https://quickfix.com',
      },
      expectedScore: 100,
      expectedQualified: true,
      expectedVIP: false,
      description: 'Should hit exactly the qualification threshold',
    },
    {
      name: 'No data business',
      business: {
        name: 'Mystery Shop',
        reviewCount: null,
        businessTypes: [],
        website: null,
      },
      expectedScore: 30,
      expectedQualified: false,
      expectedVIP: true,
      description: 'Should only get non-chain points and be VIP',
    },
  ];

  testCases.forEach(({ name, business, expectedScore, expectedQualified, expectedVIP, description }) => {
    it(`${name}: ${description}`, () => {
      const result = calculateScore(business);
      
      expect(result.score).toBe(expectedScore);
      expect(result.qualified).toBe(expectedQualified);
      expect(result.isVIP).toBe(expectedVIP);
    });
  });

  it('should provide detailed breakdown', () => {
    const business: BusinessScoringInput = {
      name: 'Joe\'s Coffee',
      reviewCount: 50,
      businessTypes: ['cafe'],
      website: 'https://joescoffee.com',
    };
    
    const result = calculateScore(business);
    
    expect(result.breakdown).toEqual({
      reviewCount: 30,
      notInChains: 30,
      uniqueDomain: 20,
      targetBusinessTypes: 20,
    });
  });

  it('should use custom config when provided', () => {
    const customConfig = {
      ...DEFAULT_SCORING_CONFIG,
      reviewCount: {
        min: 5,
        max: 100,
        points: 50,
      },
      qualifiedThreshold: 80,
    };
    
    const business: BusinessScoringInput = {
      name: 'Small Cafe',
      reviewCount: 8,
      businessTypes: ['cafe'],
      website: 'https://smallcafe.com',
    };
    
    const result = calculateScore(business, customConfig);
    
    expect(result.breakdown.reviewCount).toBe(50);
    expect(result.score).toBe(120); // 50 + 30 + 20 + 20
    expect(result.qualified).toBe(true); // > 80
  });

  it('should handle empty string website as VIP', () => {
    const business: BusinessScoringInput = {
      name: 'No Website Biz',
      reviewCount: 50,
      businessTypes: ['restaurant'],
      website: '   ',
    };
    
    const result = calculateScore(business);
    
    expect(result.isVIP).toBe(true);
  });
});
