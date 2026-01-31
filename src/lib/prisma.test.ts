/**
 * Integration tests for Prisma database schema
 * These tests verify the database schema, relationships, and constraints
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

describe('Database Integration Tests', () => {
  let prisma: PrismaClient;
  let pool: pg.Pool;

  beforeAll(async () => {
    // Use DATABASE_URL_TEST environment variable for test database
    const connectionString = process.env.DATABASE_URL_TEST || 'postgresql://postgres:postgres@localhost:5432/quizmaster_test';
    
    pool = new pg.Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    
    // Create a new Prisma client
    prisma = new PrismaClient({ adapter });
    
    // Clean up any existing data
    await cleanupDatabase();
  });

  afterAll(async () => {
    await cleanupDatabase();
    await prisma.$disconnect();
    await pool.end();
  });

  afterEach(async () => {
    // Clean up after each test
    await cleanupDatabase();
  });

  async function cleanupDatabase() {
    // Delete in correct order due to foreign key constraints
    await prisma.outreachTracking.deleteMany();
    await prisma.optOut.deleteMany();
    await prisma.contactInfo.deleteMany();
    await prisma.business.deleteMany();
    await prisma.emailCampaign.deleteMany();
    await prisma.excludedBusiness.deleteMany();
    await prisma.searchRun.deleteMany();
    await prisma.user.deleteMany();
  }

  describe('Business and ContactInfo Relationships', () => {
    it('should insert a Business and related ContactInfo and load relations correctly', async () => {
      // Create a user first (for potential future relations)
      await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          passwordHash: 'hashed_password',
        },
      });

      // Create a business
      const business = await prisma.business.create({
        data: {
          placeId: 'test_place_id_001',
          name: 'Test Business',
          address: '123 Main St',
          lat: 30.2672,
          lng: -97.7431,
          phone: '+15125551234',
          website: 'https://testbusiness.com',
          businessTypes: ['restaurant', 'cafe'],
          rating: 4.5,
          reviewCount: 100,
          websiteStatus: 'acceptable',
          leadStatus: 'pending',
          source: 'google_maps',
        },
      });

      // Create contact info for the business
      await prisma.contactInfo.create({
        data: {
          businessId: business.id,
          email: 'contact@testbusiness.com',
          emailSource: 'scraped',
          emailConfidence: 85,
          phone: '+15125551234',
          facebookUrl: 'https://facebook.com/testbusiness',
        },
      });

      // Load business with relations
      const loadedBusiness = await prisma.business.findUnique({
        where: { id: business.id },
        include: {
          contactInfo: true,
        },
      });

      expect(loadedBusiness).toBeDefined();
      expect(loadedBusiness?.contactInfo).toHaveLength(1);
      expect(loadedBusiness?.contactInfo[0].email).toBe('contact@testbusiness.com');
      expect(loadedBusiness?.contactInfo[0].emailSource).toBe('scraped');
    });
  });

  describe('Manual Lead Support (NULL place_id)', () => {
    it('should insert a Business with NULL place_id (manual lead) and confirm it persists', async () => {
      const business = await prisma.business.create({
        data: {
          name: 'Manual Business Entry',
          address: '456 Oak Ave',
          source: 'manual',
          websiteStatus: 'unknown',
          leadStatus: 'pending',
        },
      });

      const loadedBusiness = await prisma.business.findUnique({
        where: { id: business.id },
      });

      expect(loadedBusiness).toBeDefined();
      expect(loadedBusiness?.placeId).toBeNull();
      expect(loadedBusiness?.name).toBe('Manual Business Entry');
      expect(loadedBusiness?.source).toBe('manual');
    });
  });

  describe('Unique Constraint on place_id', () => {
    it('should fail when inserting two Businesses with the same non-null place_id', async () => {
      const placeId = 'unique_place_id_001';

      // First insert should succeed
      await prisma.business.create({
        data: {
          placeId,
          name: 'First Business',
          address: '123 First St',
          source: 'google_maps',
        },
      });

      // Second insert with same place_id should fail
      await expect(
        prisma.business.create({
          data: {
            placeId,
            name: 'Second Business',
            address: '456 Second St',
            source: 'google_maps',
          },
        })
      ).rejects.toThrow();
    });

    it('should allow multiple businesses with NULL place_id', async () => {
      // Create first business with NULL place_id
      const business1 = await prisma.business.create({
        data: {
          name: 'Manual Business 1',
          address: '111 Manual St',
          source: 'manual',
        },
      });

      // Create second business with NULL place_id
      const business2 = await prisma.business.create({
        data: {
          name: 'Manual Business 2',
          address: '222 Manual St',
          source: 'manual',
        },
      });

      expect(business1.placeId).toBeNull();
      expect(business2.placeId).toBeNull();
      expect(business1.id).not.toBe(business2.id);
    });
  });

  describe('SearchRun Counters', () => {
    it('should create a SearchRun record and persist summary counters correctly', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'searcher@example.com',
          name: 'Search User',
        },
      });

      const searchRun = await prisma.searchRun.create({
        data: {
          createdByUserId: user.id,
          queryText: 'restaurants near Austin',
          locationText: 'Austin, TX',
          lat: 30.2672,
          lng: -97.7431,
          radiusMeters: 5000,
          types: ['restaurant'],
          status: 'completed',
          completedAt: new Date(),
          resultsFound: 50,
          resultsSavedNew: 30,
          resultsDedupedExisting: 20,
        },
      });

      const loadedSearchRun = await prisma.searchRun.findUnique({
        where: { id: searchRun.id },
      });

      expect(loadedSearchRun).toBeDefined();
      expect(loadedSearchRun?.resultsFound).toBe(50);
      expect(loadedSearchRun?.resultsSavedNew).toBe(30);
      expect(loadedSearchRun?.resultsDedupedExisting).toBe(20);
      expect(loadedSearchRun?.status).toBe('completed');
    });
  });

  describe('Email Campaign and Outreach Tracking', () => {
    it('should create an EmailCampaign and link it to OutreachTracking', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'outreach@example.com',
          name: 'Outreach User',
        },
      });

      const business = await prisma.business.create({
        data: {
          name: 'Campaign Target',
          address: '789 Campaign Rd',
          source: 'manual',
        },
      });

      const campaign = await prisma.emailCampaign.create({
        data: {
          name: 'Test Campaign',
          subjectTouch1: 'Hello from Client Finder Portal',
          subjectTouch2: 'Following up',
          templateTouch1: '<html><body>Touch 1</body></html>',
          templateTouch2: '<html><body>Touch 2</body></html>',
          waitDaysBetweenTouches: 7,
        },
      });

      const outreach = await prisma.outreachTracking.create({
        data: {
          businessId: business.id,
          createdByUserId: user.id,
          channel: 'email',
          touchNumber: 1,
          campaignId: campaign.id,
          deliveryStatus: 'sent',
        },
      });

      const loadedOutreach = await prisma.outreachTracking.findUnique({
        where: { id: outreach.id },
        include: {
          campaign: true,
          business: true,
        },
      });

      expect(loadedOutreach).toBeDefined();
      expect(loadedOutreach?.campaign?.name).toBe('Test Campaign');
      expect(loadedOutreach?.business.name).toBe('Campaign Target');
    });
  });

  describe('OptOut Compliance', () => {
    it('should create an OptOut record and enforce unique constraint', async () => {
      const business = await prisma.business.create({
        data: {
          name: 'Opted Out Business',
          address: '999 OptOut St',
          source: 'manual',
        },
      });

      const optOut = await prisma.optOut.create({
        data: {
          businessId: business.id,
          email: 'optout@example.com',
          channel: 'email',
          reason: 'User requested',
        },
      });

      expect(optOut).toBeDefined();
      expect(optOut.email).toBe('optout@example.com');

      // Try to create duplicate opt-out for same channel/email
      await expect(
        prisma.optOut.create({
          data: {
            email: 'optout@example.com',
            channel: 'email',
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('User Relations', () => {
    it('should create a User and relate to SearchRuns', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'relations@example.com',
          name: 'Relations User',
        },
      });

      await prisma.searchRun.create({
        data: {
          createdByUserId: user.id,
          queryText: 'test query',
          radiusMeters: 1000,
          types: ['test'],
          status: 'started',
        },
      });

      const userWithSearchRuns = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          searchRuns: true,
        },
      });

      expect(userWithSearchRuns?.searchRuns).toHaveLength(1);
      expect(userWithSearchRuns?.searchRuns[0].queryText).toBe('test query');
    });
  });

  describe('ExcludedBusiness', () => {
    it('should create an ExcludedBusiness with normalized name', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'excluder@example.com',
          name: 'Excluder User',
        },
      });

      const excluded = await prisma.excludedBusiness.create({
        data: {
          businessName: 'Starbucks',
          businessNameNormalized: 'starbucks',
          reason: 'Chain store',
          addedByUserId: user.id,
        },
      });

      expect(excluded.businessName).toBe('Starbucks');
      expect(excluded.businessNameNormalized).toBe('starbucks');
    });
  });
});
