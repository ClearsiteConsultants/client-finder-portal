/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';

const mockAuth = jest.fn();
const mockBusinessUpdate = jest.fn();
const mockBusinessFindUnique = jest.fn();
const mockContactFindFirst = jest.fn();
const mockDeriveWebsiteStatus = jest.fn();

jest.mock('@/lib/auth', () => ({
  auth: (...args: any[]) => mockAuth(...args),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    business: {
      update: (...args: any[]) => mockBusinessUpdate(...args),
      findUnique: (...args: any[]) => mockBusinessFindUnique(...args),
      delete: jest.fn(),
    },
    contactInfo: {
      findFirst: (...args: any[]) => mockContactFindFirst(...args),
      update: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock('@/lib/validation/website-status', () => ({
  deriveWebsiteStatus: (...args: any[]) => mockDeriveWebsiteStatus(...args),
}));

describe('/api/leads/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: 'user-123' } });
    mockContactFindFirst.mockResolvedValue(null);
    mockBusinessFindUnique.mockResolvedValue({
      website: null,
      contactInfo: [],
    });
    mockDeriveWebsiteStatus.mockResolvedValue('technical_issues');
  });

  it('should have GET, PATCH, and DELETE endpoints', async () => {
    const { GET, PATCH, DELETE } = await import('./route');
    expect(GET).toBeDefined();
    expect(PATCH).toBeDefined();
    expect(DELETE).toBeDefined();
  });

  it('PATCH updates placeId and source', async () => {
    const { PATCH } = await import('./route');

    mockBusinessUpdate.mockResolvedValue({
      id: 'lead-123',
      placeId: 'new-place-id',
      source: 'manual',
      approvedByUser: null,
      rejectedByUser: null,
      contactInfo: [],
    });

    const request = new NextRequest('http://localhost/api/leads/lead-123', {
      method: 'PATCH',
      body: JSON.stringify({
        placeId: ' new-place-id ',
        source: 'manual',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'lead-123' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.placeId).toBe('new-place-id');
    expect(data.source).toBe('manual');
    expect(mockBusinessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'lead-123' },
        data: expect.objectContaining({
          placeId: 'new-place-id',
          source: 'manual',
        }),
      })
    );
  });

  it('PATCH returns 409 on duplicate placeId', async () => {
    const { PATCH } = await import('./route');

    const duplicateError = new Error('Unique constraint failed') as Error & {
      code?: string;
    };
    duplicateError.code = 'P2002';
    Object.setPrototypeOf(duplicateError, Prisma.PrismaClientKnownRequestError.prototype);

    mockBusinessUpdate.mockRejectedValue(duplicateError);

    const request = new NextRequest('http://localhost/api/leads/lead-123', {
      method: 'PATCH',
      body: JSON.stringify({
        placeId: 'already-used-place-id',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'lead-123' }) });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toContain('Google Place ID');
  });

  it('PATCH sets websiteStatus using derived status when website is added', async () => {
    const { PATCH } = await import('./route');

    mockBusinessUpdate.mockResolvedValue({
      id: 'lead-123',
      website: 'https://example.com',
      websiteStatus: 'technical_issues',
      approvedByUser: null,
      rejectedByUser: null,
      contactInfo: [],
    });

    const request = new NextRequest('http://localhost/api/leads/lead-123', {
      method: 'PATCH',
      body: JSON.stringify({
        website: ' https://example.com ',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'lead-123' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.website).toBe('https://example.com');
    expect(data.websiteStatus).toBe('technical_issues');
    expect(mockDeriveWebsiteStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        website: 'https://example.com',
      })
    );
    expect(mockBusinessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'lead-123' },
        data: expect.objectContaining({
          website: 'https://example.com',
          websiteStatus: 'technical_issues',
        }),
      })
    );
  });

  it('PATCH sets websiteStatus to no_website when website is cleared', async () => {
    const { PATCH } = await import('./route');

    mockDeriveWebsiteStatus.mockResolvedValue('no_website');

    mockBusinessUpdate.mockResolvedValue({
      id: 'lead-123',
      website: null,
      websiteStatus: 'no_website',
      approvedByUser: null,
      rejectedByUser: null,
      contactInfo: [],
    });

    const request = new NextRequest('http://localhost/api/leads/lead-123', {
      method: 'PATCH',
      body: JSON.stringify({
        website: '   ',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'lead-123' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.website).toBeNull();
    expect(data.websiteStatus).toBe('no_website');
    expect(mockBusinessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'lead-123' },
        data: expect.objectContaining({
          website: null,
          websiteStatus: 'no_website',
        }),
      })
    );
  });

  it('PATCH keeps explicit websiteStatus override', async () => {
    const { PATCH } = await import('./route');

    mockBusinessUpdate.mockResolvedValue({
      id: 'lead-123',
      websiteStatus: 'acceptable',
      approvedByUser: null,
      rejectedByUser: null,
      contactInfo: [],
    });

    const request = new NextRequest('http://localhost/api/leads/lead-123', {
      method: 'PATCH',
      body: JSON.stringify({
        websiteStatus: 'acceptable',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'lead-123' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.websiteStatus).toBe('acceptable');
    expect(mockDeriveWebsiteStatus).not.toHaveBeenCalled();
    expect(mockBusinessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'lead-123' },
        data: expect.objectContaining({
          websiteStatus: 'acceptable',
        }),
      })
    );
  });

  it('PATCH rejects unknown websiteStatus override', async () => {
    const { PATCH } = await import('./route');

    const request = new NextRequest('http://localhost/api/leads/lead-123', {
      method: 'PATCH',
      body: JSON.stringify({
        websiteStatus: 'unknown',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'lead-123' }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('no longer supported');
    expect(mockBusinessUpdate).not.toHaveBeenCalled();
  });
});
