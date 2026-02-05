/**
 * Tests for lead to client conversion endpoint
 * @jest-environment node
 */

import { NextRequest } from 'next/server';

const mockAuth = jest.fn();
const mockPrismaFindUnique = jest.fn();
const mockPrismaUpdate = jest.fn();

jest.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
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

describe('POST /api/leads/convert-to-client', () => {
  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockBusinessId = '223e4567-e89b-12d3-a456-426614174001';

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockClear();
    mockPrismaFindUnique.mockClear();
    mockPrismaUpdate.mockClear();
  });

  it('should reject unauthorized requests', async () => {
    mockAuth.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/leads/convert-to-client', {
      method: 'POST',
      body: JSON.stringify({ businessId: mockBusinessId }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should reject conversion of non-existent business', async () => {
    mockAuth.mockResolvedValue({
      user: { id: mockUserId, email: 'test@example.com' },
      expires: '2024-12-31',
    });

    mockPrismaFindUnique.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/leads/convert-to-client', {
      method: 'POST',
      body: JSON.stringify({ businessId: mockBusinessId }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Business not found');
  });

  it('should reject conversion of already converted business', async () => {
    mockAuth.mockResolvedValue({
      user: { id: mockUserId, email: 'test@example.com' },
      expires: '2024-12-31',
    });

    mockPrismaFindUnique.mockResolvedValue({
      id: mockBusinessId,
      leadStatus: 'approved',
      isClient: true,
      name: 'Test Business',
    } as any);

    const request = new NextRequest('http://localhost:3000/api/leads/convert-to-client', {
      method: 'POST',
      body: JSON.stringify({ businessId: mockBusinessId }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('already a client');
  });

  it('should reject conversion of non-approved lead', async () => {
    mockAuth.mockResolvedValue({
      user: { id: mockUserId, email: 'test@example.com' },
      expires: '2024-12-31',
    });

    mockPrismaFindUnique.mockResolvedValue({
      id: mockBusinessId,
      leadStatus: 'pending',
      isClient: false,
      name: 'Test Business',
    } as any);

    const request = new NextRequest('http://localhost:3000/api/leads/convert-to-client', {
      method: 'POST',
      body: JSON.stringify({ businessId: mockBusinessId }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('approved');
  });

  it('should reject conversion of rejected lead', async () => {
    mockAuth.mockResolvedValue({
      user: { id: mockUserId, email: 'test@example.com' },
      expires: '2024-12-31',
    });

    mockPrismaFindUnique.mockResolvedValue({
      id: mockBusinessId,
      leadStatus: 'rejected',
      isClient: false,
      name: 'Test Business',
    } as any);

    const request = new NextRequest('http://localhost:3000/api/leads/convert-to-client', {
      method: 'POST',
      body: JSON.stringify({ businessId: mockBusinessId }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('approved');
  });

  it('should successfully convert approved lead to client', async () => {
    const mockDate = new Date('2024-01-01T00:00:00Z');
    
    mockAuth.mockResolvedValue({
      user: { id: mockUserId, email: 'test@example.com' },
      expires: '2024-12-31',
    });

    mockPrismaFindUnique.mockResolvedValue({
      id: mockBusinessId,
      leadStatus: 'approved',
      isClient: false,
      name: 'Test Business',
    } as any);

    mockPrismaUpdate.mockResolvedValue({
      id: mockBusinessId,
      leadStatus: 'approved',
      isClient: true,
      name: 'Test Business',
      convertedAt: mockDate,
      convertedByUserId: mockUserId,
      convertedByUser: {
        id: mockUserId,
        name: 'Test User',
        email: 'test@example.com',
      },
    } as any);

    const request = new NextRequest('http://localhost:3000/api/leads/convert-to-client', {
      method: 'POST',
      body: JSON.stringify({ businessId: mockBusinessId }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.business.isClient).toBe(true);
    expect(data.business.convertedByUserId).toBe(mockUserId);
    expect(mockPrismaUpdate).toHaveBeenCalledWith({
      where: { id: mockBusinessId },
      data: expect.objectContaining({
        isClient: true,
        convertedByUserId: mockUserId,
        convertedAt: expect.any(Date),
      }),
      include: expect.any(Object),
    });
  });

  it('should successfully convert with optional client fields', async () => {
    mockAuth.mockResolvedValue({
      user: { id: mockUserId, email: 'test@example.com' },
      expires: '2024-12-31',
    });

    mockPrismaFindUnique.mockResolvedValue({
      id: mockBusinessId,
      leadStatus: 'approved',
      isClient: false,
      name: 'Test Business',
    } as any);

    mockPrismaUpdate.mockResolvedValue({
      id: mockBusinessId,
      isClient: true,
      clientStatus: 'active',
      subscriptionStatus: 'trial',
    } as any);

    const request = new NextRequest('http://localhost:3000/api/leads/convert-to-client', {
      method: 'POST',
      body: JSON.stringify({
        businessId: mockBusinessId,
        clientStatus: 'active',
        subscriptionStatus: 'trial',
        initialPaymentStatus: 'pending',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockPrismaUpdate).toHaveBeenCalledWith({
      where: { id: mockBusinessId },
      data: expect.objectContaining({
        isClient: true,
        clientStatus: 'active',
        subscriptionStatus: 'trial',
        initialPaymentStatus: 'pending',
      }),
      include: expect.any(Object),
    });
  });
});
