/**
 * Integration tests for exclusions API endpoints
 */
import { POST, GET, DELETE } from './route';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

// Mock next-auth
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

const mockAuth = auth as jest.MockedFunction<typeof auth>;

describe('Exclusions API', () => {
  const mockUserId = 'test-user-id';
  const mockUserEmail = 'test@example.com';

  beforeAll(async () => {
    // Clean up and create test user
    await prisma.excludedBusiness.deleteMany();
    await prisma.user.deleteMany();

    await prisma.user.create({
      data: {
        id: mockUserId,
        email: mockUserEmail,
        name: 'Test User',
      },
    });
  });

  beforeEach(async () => {
    await prisma.excludedBusiness.deleteMany();
    
    // Mock authenticated session
    mockAuth.mockResolvedValue({
      user: { id: mockUserId, email: mockUserEmail },
      expires: new Date(Date.now() + 86400000).toISOString(),
    } as any);
  });

  afterAll(async () => {
    await prisma.excludedBusiness.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  describe('POST /api/exclusions', () => {
    it('should add a business to exclude list', async () => {
      const request = new Request('http://localhost/api/exclusions', {
        method: 'POST',
        body: JSON.stringify({
          businessName: 'Starbucks',
          reason: 'Too large',
        }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.id).toBeDefined();
      expect(data.message).toBe('Business added to exclude list');

      // Verify in database
      const excluded = await prisma.excludedBusiness.findFirst({
        where: { businessNameNormalized: 'starbucks' },
      });
      expect(excluded).toBeDefined();
      expect(excluded?.businessName).toBe('Starbucks');
      expect(excluded?.reason).toBe('Too large');
    });

    it('should return existing id if business already excluded', async () => {
      // Add first time
      const firstRequest = new Request('http://localhost/api/exclusions', {
        method: 'POST',
        body: JSON.stringify({
          businessName: 'McDonald\'s',
        }),
      });

      const firstResponse = await POST(firstRequest as any);
      const firstData = await firstResponse.json();
      const firstId = firstData.id;

      // Add again
      const secondRequest = new Request('http://localhost/api/exclusions', {
        method: 'POST',
        body: JSON.stringify({
          businessName: 'McDonalds', // Different spacing
        }),
      });

      const secondResponse = await POST(secondRequest as any);
      const secondData = await secondResponse.json();

      expect(secondData.id).toBe(firstId);
    });

    it('should return 400 if businessName is missing', async () => {
      const request = new Request('http://localhost/api/exclusions', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request as any);
      expect(response.status).toBe(400);
    });

    it('should return 400 if businessName is empty', async () => {
      const request = new Request('http://localhost/api/exclusions', {
        method: 'POST',
        body: JSON.stringify({ businessName: '   ' }),
      });

      const response = await POST(request as any);
      expect(response.status).toBe(400);
    });

    it('should return 401 if not authenticated', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const request = new Request('http://localhost/api/exclusions', {
        method: 'POST',
        body: JSON.stringify({ businessName: 'Test' }),
      });

      const response = await POST(request as any);
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/exclusions', () => {
    it('should return all excluded businesses', async () => {
      // Add some excluded businesses
      await prisma.excludedBusiness.createMany({
        data: [
          {
            businessName: 'Walmart',
            businessNameNormalized: 'walmart',
            addedByUserId: mockUserId,
            reason: 'Too big',
          },
          {
            businessName: 'Target',
            businessNameNormalized: 'target',
            addedByUserId: mockUserId,
          },
        ],
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.excluded).toHaveLength(2);
      expect(data.excluded[0].businessName).toBeDefined();
      expect(data.excluded[0].addedBy).toBeDefined();
      expect(data.excluded[0].createdAt).toBeDefined();
    });

    it('should return empty array if no exclusions', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.excluded).toEqual([]);
    });

    it('should return 401 if not authenticated', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const response = await GET();
      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/exclusions', () => {
    it('should remove a business from exclude list', async () => {
      // Add a business
      const excluded = await prisma.excludedBusiness.create({
        data: {
          businessName: 'Costco',
          businessNameNormalized: 'costco',
          addedByUserId: mockUserId,
        },
      });

      const request = new Request('http://localhost/api/exclusions', {
        method: 'DELETE',
        body: JSON.stringify({ excludedBusinessId: excluded.id }),
      });

      const response = await DELETE(request as any);
      expect(response.status).toBe(200);

      // Verify removed from database
      const found = await prisma.excludedBusiness.findUnique({
        where: { id: excluded.id },
      });
      expect(found).toBeNull();
    });

    it('should return 400 if excludedBusinessId is missing', async () => {
      const request = new Request('http://localhost/api/exclusions', {
        method: 'DELETE',
        body: JSON.stringify({}),
      });

      const response = await DELETE(request as any);
      expect(response.status).toBe(400);
    });

    it('should return 401 if not authenticated', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const request = new Request('http://localhost/api/exclusions', {
        method: 'DELETE',
        body: JSON.stringify({ excludedBusinessId: 'test' }),
      });

      const response = await DELETE(request as any);
      expect(response.status).toBe(401);
    });
  });
});
