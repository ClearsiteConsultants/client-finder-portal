/**
 * Integration tests for exclusions API endpoints
 */
import { POST, GET, DELETE } from './route';
import { disconnectPrisma, prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

// Mock next-auth
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

const mockAuth = auth as jest.MockedFunction<typeof auth>;

describe('Exclusions API', () => {
  const mockUserId = '11111111-1111-1111-1111-111111111111';
  const mockUserEmail = 'test@example.com';

  beforeAll(async () => {
    // Clean up and create test user
    await prisma.excludedBusiness.deleteMany({
      where: { addedByUserId: mockUserId },
    });
    await prisma.user.deleteMany({
      where: { id: mockUserId },
    });

    await prisma.user.create({
      data: {
        id: mockUserId,
        email: mockUserEmail,
        name: 'Test User',
      },
    });
  });

  beforeEach(async () => {
    await prisma.excludedBusiness.deleteMany({
      where: { addedByUserId: mockUserId },
    });
    
    // Mock authenticated session
    mockAuth.mockResolvedValue({
      user: { id: mockUserId, email: mockUserEmail },
      expires: new Date(Date.now() + 86400000).toISOString(),
    } as any);
  });

  afterAll(async () => {
    await prisma.excludedBusiness.deleteMany({
      where: { addedByUserId: mockUserId },
    });
    await prisma.user.deleteMany({
      where: { id: mockUserId },
    });
    await disconnectPrisma();
  });

  describe('POST /api/exclusions', () => {
    it('should add a business to exclude list', async () => {
      const uniqueBusinessName = `Starbucks-${Date.now()}`;

      const request = new Request('http://localhost/api/exclusions', {
        method: 'POST',
        body: JSON.stringify({
          businessName: uniqueBusinessName,
          reason: 'Too large',
        }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.id).toBeDefined();
      expect(data.message).toBe('Entry added to exclude list');

      // Verify created record by ID
      const excluded = await prisma.excludedBusiness.findUnique({
        where: { id: data.id },
      });
      expect(excluded).toBeTruthy();
      expect(excluded?.businessName).toBe(uniqueBusinessName);
      expect(excluded?.reason).toBe('Too large');
    });

    it('should return existing id if business already excluded', async () => {
      // Use unique name to avoid cross-test conflicts
      const uniqueName = `McDonald-${Date.now()}`;
      
      // Add first time
      const firstRequest = new Request('http://localhost/api/exclusions', {
        method: 'POST',
        body: JSON.stringify({
          businessName: uniqueName,
        }),
      });

      const firstResponse = await POST(firstRequest as any);
      const firstData = await firstResponse.json();
      const firstId = firstData.id;

      // Add again with different spacing
      const secondRequest = new Request('http://localhost/api/exclusions', {
        method: 'POST',
        body: JSON.stringify({
          businessName: `${uniqueName}  `, // Extra spaces
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

    it('should add a business type to exclude list', async () => {
      const request = new Request('http://localhost/api/exclusions', {
        method: 'POST',
        body: JSON.stringify({
          businessType: 'restaurant',
          reason: 'Skip this vertical',
        }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.id).toBeDefined();
      expect(data.message).toBe('Entry added to exclude list');

      const excluded = await prisma.excludedBusiness.findUnique({
        where: { id: data.id },
      });
      expect(excluded?.businessNameNormalized).toBe('type:restaurant');
    });

    it('should return 400 if both businessName and businessType are provided', async () => {
      const request = new Request('http://localhost/api/exclusions', {
        method: 'POST',
        body: JSON.stringify({
          businessName: 'Starbucks',
          businessType: 'cafe',
        }),
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
      await prisma.excludedBusiness.createMany({
        data: [
          {
            businessName: 'Walmart GET Test',
            businessNameNormalized: 'walmart get test',
            addedByUserId: mockUserId,
            reason: 'Too big',
          },
          {
            businessName: 'Target GET Test',
            businessNameNormalized: 'target get test',
            addedByUserId: mockUserId,
          },
        ],
      });

      const response = await GET();
      const data = await response.json();
      const seededEntries = data.excluded.filter((entry: { businessName: string }) =>
        ['Walmart GET Test', 'Target GET Test'].includes(entry.businessName)
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(data.excluded)).toBe(true);
      expect(seededEntries).toHaveLength(2);
      expect(seededEntries.map((entry: { businessName: string }) => entry.businessName)).toEqual(
        expect.arrayContaining(['Walmart GET Test', 'Target GET Test'])
      );
      expect(
        seededEntries.find((entry: { businessName: string }) => entry.businessName === 'Walmart GET Test')
      ).toMatchObject({
        businessName: 'Walmart GET Test',
        addedBy: 'Test User',
        reason: 'Too big',
      });
      expect(
        seededEntries.find((entry: { businessName: string }) => entry.businessName === 'Target GET Test')
      ).toMatchObject({
        businessName: 'Target GET Test',
        addedBy: 'Test User',
      });
      expect(seededEntries[0].createdAt).toBeDefined();
    });

    it('should return excluded array shape', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.excluded)).toBe(true);
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
