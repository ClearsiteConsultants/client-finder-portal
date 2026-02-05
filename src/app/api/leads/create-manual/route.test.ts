/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';

const mockGetServerSession = jest.fn();
const mockPrismaCreate = jest.fn();
const mockContactCreate = jest.fn();

jest.mock('next-auth', () => ({
  getServerSession: (...args: any[]) => mockGetServerSession(...args),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    business: {
      create: (...args: any[]) => mockPrismaCreate(...args),
    },
    contact: {
      create: (...args: any[]) => mockContactCreate(...args),
    },
  },
}));

import { POST } from './route';

describe('POST /api/leads/create-manual', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockClear();
    mockPrismaCreate.mockClear();
    mockContactCreate.mockClear();
  });

  it('should reject unauthenticated requests', async () => {
    mockGetServerSession.mockResolvedValueOnce(null);

    const req = new NextRequest('http://localhost/api/leads/create-manual', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', address: '123 Main St' }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should create a business with manual source and NULL place_id', async () => {
    mockGetServerSession.mockResolvedValueOnce({
      user: { id: 'user-123', email: 'test@example.com' },
      expires: '2024-12-31',
    });

    const mockBusiness = {
      id: 'business-123',
      name: 'Test Business',
      address: '123 Main St',
      phone: '+1234567890',
      website: 'https://test.com',
      placeId: null,
      source: 'manual',
      leadStatus: 'pending',
      websiteStatus: 'unknown',
      businessTypes: [],
    };

    mockPrismaCreate.mockResolvedValueOnce(mockBusiness);
    mockContactCreate.mockResolvedValue({ id: 'contact-123' });

    const req = new NextRequest('http://localhost/api/leads/create-manual', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Business',
        address: '123 Main St',
        phone: '+1234567890',
        website: 'https://test.com',
        email: 'contact@test.com',
      }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.business.placeId).toBeNull();
    expect(data.business.source).toBe('manual');
    expect(mockPrismaCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Test Business',
        address: '123 Main St',
        source: 'manual',
        leadStatus: 'pending',
      }),
    });
  });

  it('should require name and address', async () => {
    mockGetServerSession.mockResolvedValueOnce({
      user: { id: 'user-123', email: 'test@example.com' },
      expires: '2024-12-31',
    });

    const req = new NextRequest('http://localhost/api/leads/create-manual', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test' }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('required');
  });

  it('should create contacts for optional fields', async () => {
    mockGetServerSession.mockResolvedValueOnce({
      user: { id: 'user-123', email: 'test@example.com' },
      expires: '2024-12-31',
    });

    const mockBusiness = {
      id: 'business-123',
      name: 'Test Business',
      address: '123 Main St',
      placeId: null,
      source: 'manual',
      businessTypes: [],
    };

    mockPrismaCreate.mockResolvedValueOnce(mockBusiness);
    mockContactCreate.mockResolvedValue({ id: 'contact-123' });

    const req = new NextRequest('http://localhost/api/leads/create-manual', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Business',
        address: '123 Main St',
        email: 'contact@test.com',
        instagram: 'https://instagram.com/test',
        facebook: 'https://facebook.com/test',
      }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(mockContactCreate).toHaveBeenCalledTimes(3);
    expect(mockContactCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: 'business-123',
        contactType: 'email',
        contactValue: 'contact@test.com',
        isPrimary: true,
      }),
    });
  });
});
