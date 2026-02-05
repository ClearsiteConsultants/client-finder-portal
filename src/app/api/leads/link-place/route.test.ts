/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';

const mockGetServerSession = jest.fn();
const mockPrismaFindUnique = jest.fn();
const mockPrismaUpdate = jest.fn();

jest.mock('next-auth', () => ({
  getServerSession: (...args: any[]) => mockGetServerSession(...args),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    business: {
      findUnique: (...args: any[]) => mockPrismaFindUnique(...args),
      update: (...args: any[]) => mockPrismaUpdate(...args),
    },
  },
}));

import { POST } from './route';

describe('POST /api/leads/link-place', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockClear();
    mockPrismaFindUnique.mockClear();
    mockPrismaUpdate.mockClear();
  });

  it('should reject unauthenticated requests', async () => {
    mockGetServerSession.mockResolvedValueOnce(null);

    const req = new NextRequest('http://localhost/api/leads/link-place', {
      method: 'POST',
      body: JSON.stringify({ businessId: 'biz-123', placeId: 'place-123' }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should link a manual lead to a place_id when place_id is unused', async () => {
    mockGetServerSession.mockResolvedValueOnce({
      user: { id: 'user-123', email: 'test@example.com' },
      expires: '2024-12-31',
    });

    mockPrismaFindUnique.mockResolvedValueOnce(null);

    const mockUpdatedBusiness = {
      id: 'business-123',
      name: 'Test Business',
      placeId: 'place-123',
      source: 'google_maps',
    };

    mockPrismaUpdate.mockResolvedValueOnce(mockUpdatedBusiness);

    const req = new NextRequest('http://localhost/api/leads/link-place', {
      method: 'POST',
      body: JSON.stringify({ businessId: 'business-123', placeId: 'place-123' }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.business.placeId).toBe('place-123');
    expect(data.business.source).toBe('google_maps');
    expect(mockPrismaUpdate).toHaveBeenCalledWith({
      where: { id: 'business-123' },
      data: {
        placeId: 'place-123',
        source: 'google_maps',
      },
    });
  });

  it('should fail when place_id is already taken by another business', async () => {
    mockGetServerSession.mockResolvedValueOnce({
      user: { id: 'user-123', email: 'test@example.com' },
      expires: '2024-12-31',
    });

    mockPrismaFindUnique.mockResolvedValueOnce({
      id: 'other-business-123',
      placeId: 'place-123',
    });

    const req = new NextRequest('http://localhost/api/leads/link-place', {
      method: 'POST',
      body: JSON.stringify({ businessId: 'business-123', placeId: 'place-123' }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toContain('already linked');
    expect(mockPrismaUpdate).not.toHaveBeenCalled();
  });

  it('should allow re-linking the same business to the same place_id', async () => {
    mockGetServerSession.mockResolvedValueOnce({
      user: { id: 'user-123', email: 'test@example.com' },
      expires: '2024-12-31',
    });

    mockPrismaFindUnique.mockResolvedValueOnce({
      id: 'business-123',
      placeId: 'place-123',
    });

    const mockUpdatedBusiness = {
      id: 'business-123',
      placeId: 'place-123',
      source: 'google_maps',
    };

    mockPrismaUpdate.mockResolvedValueOnce(mockUpdatedBusiness);

    const req = new NextRequest('http://localhost/api/leads/link-place', {
      method: 'POST',
      body: JSON.stringify({ businessId: 'business-123', placeId: 'place-123' }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should require businessId and placeId', async () => {
    mockGetServerSession.mockResolvedValueOnce({
      user: { id: 'user-123', email: 'test@example.com' },
      expires: '2024-12-31',
    });

    const req = new NextRequest('http://localhost/api/leads/link-place', {
      method: 'POST',
      body: JSON.stringify({ businessId: 'business-123' }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('required');
  });
});
