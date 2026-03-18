/**
 * Tests for business exclusion system
 */

import { disconnectPrisma, prisma } from '../prisma';
import {
  checkBusinessExclusion,
  checkBusinessTypeExclusion,
  checkBusinessExclusionBatch,
  checkBusinessExclusionBatchWithTypes,
  getExcludedBusinessTypes,
  addBusinessToExcludeList,
  addBusinessTypeToExcludeList,
  removeBusinessFromExcludeList,
  getExcludedBusinesses,
} from './exclusions';
import { normalizeBusinessName } from './scorer';

// Mock user ID for tests
const TEST_USER_ID = '00000000-0000-0000-0000-00000000aa01';
const TEST_USER_EMAIL = 'exclusions-test-user@example.com';

// Helper to create a test user
async function createTestUser() {
  await prisma.user.upsert({
    where: { id: TEST_USER_ID },
    update: {
      email: TEST_USER_EMAIL,
      name: 'Test User',
      passwordHash: 'not-a-real-hash',
    },
    create: {
      id: TEST_USER_ID,
      email: TEST_USER_EMAIL,
      name: 'Test User',
      passwordHash: 'not-a-real-hash',
    },
  });
}

// Clean up test data
async function cleanupTestData() {
  await prisma.excludedBusiness.deleteMany({
    where: {
      addedByUserId: TEST_USER_ID,
    },
  });
}

describe('exclusions', () => {
  beforeAll(async () => {
    await createTestUser();
  });

  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.user.deleteMany({
      where: { id: TEST_USER_ID },
    });
    await disconnectPrisma();
  });

  describe('normalizeBusinessName', () => {
    it('should normalize business names consistently', () => {
      const variations = [
        'McDonald\'s',
        'MCDONALDS',
        'McDonalds',
        'mcdonald\'s',
        'Mc Donald\'s!!!',
      ];
      
      const normalized = variations.map(normalizeBusinessName);
      const uniqueNormalized = new Set(normalized);
      
      expect(uniqueNormalized.size).toBe(1);
      expect(uniqueNormalized.has('mcdonalds')).toBe(true);
    });
  });

  describe('addBusinessToExcludeList', () => {
    it('should add a business to the exclude list', async () => {
      const id = await addBusinessToExcludeList(
        'Starbucks',
        TEST_USER_ID,
        'Corporate chain'
      );
      
      expect(id).toBeTruthy();
      
      const excluded = await prisma.excludedBusiness.findUnique({
        where: { id },
      });
      
      expect(excluded).toBeTruthy();
      expect(excluded?.businessName).toBe('Starbucks');
      expect(excluded?.businessNameNormalized).toBe('starbucks');
      expect(excluded?.reason).toBe('Corporate chain');
    });

    it('should return existing ID if business already excluded', async () => {
      const id1 = await addBusinessToExcludeList('Starbucks', TEST_USER_ID);
      const id2 = await addBusinessToExcludeList('STARBUCKS', TEST_USER_ID);
      
      expect(id1).toBe(id2);
      
      const count = await prisma.excludedBusiness.count({
        where: {
          businessNameNormalized: 'starbucks',
        },
      });
      
      expect(count).toBe(1);
    });
  });

  describe('checkBusinessExclusion', () => {
    beforeEach(async () => {
      await addBusinessToExcludeList('Starbucks', TEST_USER_ID, 'Chain');
      await addBusinessToExcludeList('McDonald\'s', TEST_USER_ID, 'Fast food chain');
    });

    it('should detect excluded businesses', async () => {
      const result = await checkBusinessExclusion('Starbucks');
      
      expect(result.isExcluded).toBe(true);
      expect(result.excludedBusinessId).toBeTruthy();
      expect(result.reason).toBe('Chain');
    });

    it('should be case-insensitive', async () => {
      const result1 = await checkBusinessExclusion('STARBUCKS');
      const result2 = await checkBusinessExclusion('starbucks');
      const result3 = await checkBusinessExclusion('StArBuCkS');
      
      expect(result1.isExcluded).toBe(true);
      expect(result2.isExcluded).toBe(true);
      expect(result3.isExcluded).toBe(true);
    });

    it('should handle punctuation variations', async () => {
      const result = await checkBusinessExclusion('McDonald\'s #1234');
      
      expect(result.isExcluded).toBe(true);
    });

    it('should match spacing variants introduced by normalization candidates', async () => {
      await addBusinessToExcludeList('MainStreetPizza', TEST_USER_ID, 'Spacing variant');

      const result = await checkBusinessExclusion('Main Street Pizza');

      expect(result.isExcluded).toBe(true);
      expect(result.reason).toBe('Spacing variant');
    });

    it('should match mc spacing variants introduced by normalization candidates', async () => {
      const result = await checkBusinessExclusion('Mc Donalds');

      expect(result.isExcluded).toBe(true);
      expect(result.reason).toBe('Fast food chain');
    });

    it('should match names after removing standalone numbers from candidates', async () => {
      await addBusinessToExcludeList('Studio Cafe', TEST_USER_ID, 'Number variant');

      const result = await checkBusinessExclusion('Studio 54 Cafe');

      expect(result.isExcluded).toBe(true);
      expect(result.reason).toBe('Number variant');
    });

    it('should not exclude non-excluded businesses', async () => {
      const result = await checkBusinessExclusion('Joe\'s Coffee Shop');
      
      expect(result.isExcluded).toBe(false);
      expect(result.excludedBusinessId).toBeUndefined();
      expect(result.reason).toBeUndefined();
    });
  });

  describe('checkBusinessExclusionBatch', () => {
    beforeEach(async () => {
      await addBusinessToExcludeList('Starbucks', TEST_USER_ID);
      await addBusinessToExcludeList('McDonald\'s', TEST_USER_ID);
      await addBusinessToExcludeList('Walmart', TEST_USER_ID);
    });

    it('should check multiple businesses at once', async () => {
      const businesses = [
        'Starbucks',
        'Joe\'s Coffee',
        'McDonald\'s',
        'Main Street Pizza',
        'Walmart',
      ];
      
      const results = await checkBusinessExclusionBatch(businesses);
      
      expect(results.size).toBe(5);
      expect(results.get('Starbucks')?.isExcluded).toBe(true);
      expect(results.get('Joe\'s Coffee')?.isExcluded).toBe(false);
      expect(results.get('McDonald\'s')?.isExcluded).toBe(true);
      expect(results.get('Main Street Pizza')?.isExcluded).toBe(false);
      expect(results.get('Walmart')?.isExcluded).toBe(true);
    });

    it('should preserve original business names in results', async () => {
      const businesses = ['STARBUCKS', 'starbucks', 'StArBuCkS'];
      
      const results = await checkBusinessExclusionBatch(businesses);
      
      expect(results.has('STARBUCKS')).toBe(true);
      expect(results.has('starbucks')).toBe(true);
      expect(results.has('StArBuCkS')).toBe(true);
      
      expect(results.get('STARBUCKS')?.isExcluded).toBe(true);
      expect(results.get('starbucks')?.isExcluded).toBe(true);
      expect(results.get('StArBuCkS')?.isExcluded).toBe(true);
    });

    it('should apply normalization candidates consistently in batch checks', async () => {
      await addBusinessToExcludeList('SuiteDental', TEST_USER_ID, 'Batch candidate');

      const results = await checkBusinessExclusionBatch([
        'Suite Dental',
        'Suite 200 Dental',
        'Unrelated Business',
      ]);

      expect(results.get('Suite Dental')?.isExcluded).toBe(true);
      expect(results.get('Suite 200 Dental')?.isExcluded).toBe(true);
      expect(results.get('Unrelated Business')?.isExcluded).toBe(false);
    });
  });

  describe('business type exclusions', () => {
    beforeEach(async () => {
      await addBusinessTypeToExcludeList('restaurant', TEST_USER_ID, 'Excluded vertical');
      await addBusinessTypeToExcludeList('gym', TEST_USER_ID);
    });

    it('should detect an excluded business type', async () => {
      const result = await checkBusinessTypeExclusion(['food', 'restaurant']);

      expect(result.isExcluded).toBe(true);
      expect(result.exclusionMode).toBe('business_type');
      expect(result.matchedValue).toBe('restaurant');
      expect(result.reason).toBe('Excluded vertical');
    });

    it('should not exclude when no types match', async () => {
      const result = await checkBusinessTypeExclusion(['dentist', 'doctor']);

      expect(result.isExcluded).toBe(false);
    });

    it('should check batch exclusions by name and type', async () => {
      await addBusinessToExcludeList('Starbucks', TEST_USER_ID, 'Chain');

      const results = await checkBusinessExclusionBatchWithTypes([
        { name: 'Starbucks', businessTypes: ['cafe'] },
        { name: 'Local Grill', businessTypes: ['restaurant', 'food'] },
        { name: 'Healthy Clinic', businessTypes: ['doctor'] },
      ]);

      expect(results.get('Starbucks')?.isExcluded).toBe(true);
      expect(results.get('Starbucks')?.exclusionMode).toBe('business_name');
      expect(results.get('Local Grill')?.isExcluded).toBe(true);
      expect(results.get('Local Grill')?.exclusionMode).toBe('business_type');
      expect(results.get('Healthy Clinic')?.isExcluded).toBe(false);
    });

    it('should return distinct excluded business types', async () => {
      await addBusinessTypeToExcludeList('Restaurant', TEST_USER_ID);

      const excludedTypes = await getExcludedBusinessTypes();

      expect(excludedTypes).toEqual(expect.arrayContaining(['restaurant', 'gym']));
      expect(excludedTypes.filter((type) => type === 'restaurant')).toHaveLength(1);
    });
  });

  describe('removeBusinessFromExcludeList', () => {
    it('should remove a business from the exclude list', async () => {
      const id = await addBusinessToExcludeList('Starbucks', TEST_USER_ID);
      
      let result = await checkBusinessExclusion('Starbucks');
      expect(result.isExcluded).toBe(true);
      
      await removeBusinessFromExcludeList(id);
      
      result = await checkBusinessExclusion('Starbucks');
      expect(result.isExcluded).toBe(false);
    });
  });

  describe('getExcludedBusinesses', () => {
    beforeEach(async () => {
      await addBusinessToExcludeList('Starbucks', TEST_USER_ID, 'Coffee chain');
      await addBusinessToExcludeList('McDonald\'s', TEST_USER_ID, 'Fast food');
      await addBusinessToExcludeList('Walmart', TEST_USER_ID);
      await addBusinessTypeToExcludeList('restaurant', TEST_USER_ID, 'Type exclusion');
    });

    it('should return all excluded businesses', async () => {
      const excluded = await getExcludedBusinesses();
      
      const testUserExcluded = excluded.filter(e => 
        ['Starbucks', 'McDonald\'s', 'Walmart'].includes(e.businessName)
      );
      
      expect(testUserExcluded.length).toBeGreaterThanOrEqual(3);
      
      const starbucks = testUserExcluded.find(e => e.businessName === 'Starbucks');
      expect(starbucks?.reason).toBe('Coffee chain');
      expect(starbucks?.addedBy).toBeTruthy();
      expect(starbucks?.createdAt).toBeInstanceOf(Date);

      const restaurantType = excluded.find(e => e.exclusionMode === 'business_type' && e.businessType === 'restaurant');
      expect(restaurantType).toBeTruthy();
    });

    it('should be ordered by most recent first', async () => {
      const excluded = await getExcludedBusinesses();
      
      if (excluded.length > 1) {
        for (let i = 0; i < excluded.length - 1; i++) {
          expect(excluded[i].createdAt.getTime()).toBeGreaterThanOrEqual(
            excluded[i + 1].createdAt.getTime()
          );
        }
      }
    });
  });
});
