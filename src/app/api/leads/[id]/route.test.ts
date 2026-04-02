/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { MAX_STORED_WEBSITE_LENGTH } from '@/lib/validation/website-storage';

const mockAuth = jest.fn();
const mockBusinessUpdate = jest.fn();
const mockBusinessFindUnique = jest.fn();
const mockContactFindFirst = jest.fn();
const mockContactUpdate = jest.fn();
const mockContactCreate = jest.fn();
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
      update: (...args: any[]) => mockContactUpdate(...args),
      create: (...args: any[]) => mockContactCreate(...args),
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
    mockContactUpdate.mockResolvedValue(null);
    mockContactCreate.mockResolvedValue(null);
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

  it('PATCH truncates oversized website values before persisting', async () => {
    const { PATCH } = await import('./route');
    const oversizedWebsite = `https://example.com/${'a'.repeat(MAX_STORED_WEBSITE_LENGTH + 50)}`;
    const truncatedWebsite = oversizedWebsite.slice(0, MAX_STORED_WEBSITE_LENGTH);

    mockBusinessUpdate.mockResolvedValue({
      id: 'lead-123',
      website: truncatedWebsite,
      websiteStatus: 'technical_issues',
      approvedByUser: null,
      rejectedByUser: null,
      contactInfo: [],
    });

    const request = new NextRequest('http://localhost/api/leads/lead-123', {
      method: 'PATCH',
      body: JSON.stringify({
        website: oversizedWebsite,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'lead-123' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.website).toBe(truncatedWebsite);
    expect(mockDeriveWebsiteStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        website: truncatedWebsite,
      })
    );
    expect(mockBusinessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'lead-123' },
        data: expect.objectContaining({
          website: truncatedWebsite,
        }),
      })
    );
  });

  it('PATCH strips Google Maps tracking query parameters before persisting', async () => {
    const { PATCH } = await import('./route');
    const trackedWebsite = 'https://www.bigotires.com/location/ut/south-jordan/10227-s-redwood-rd-84095/044245?utm_source=google&utm_medium=maps&utm_campaign=google+maps&y_source=1_ODY2OTU3My03MTUtbG9jYXRpb24ud2Vic2l0ZQ%3D%3D';
    const cleanedWebsite = 'https://www.bigotires.com/location/ut/south-jordan/10227-s-redwood-rd-84095/044245';

    mockBusinessUpdate.mockResolvedValue({
      id: 'lead-123',
      website: cleanedWebsite,
      websiteStatus: 'technical_issues',
      approvedByUser: null,
      rejectedByUser: null,
      contactInfo: [],
    });

    const request = new NextRequest('http://localhost/api/leads/lead-123', {
      method: 'PATCH',
      body: JSON.stringify({
        website: trackedWebsite,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'lead-123' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.website).toBe(cleanedWebsite);
    expect(mockDeriveWebsiteStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        website: cleanedWebsite,
      })
    );
    expect(mockBusinessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          website: cleanedWebsite,
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

  it('PATCH rejects explicit no_website when existing lead has a website URL', async () => {
    const { PATCH } = await import('./route');

    mockBusinessFindUnique.mockResolvedValueOnce({
      website: 'https://existing-site.test',
    });

    const request = new NextRequest('http://localhost/api/leads/lead-123', {
      method: 'PATCH',
      body: JSON.stringify({
        websiteStatus: 'no_website',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'lead-123' }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Cannot set websiteStatus to "no_website"');
    expect(mockBusinessUpdate).not.toHaveBeenCalled();
  });

  it('PATCH allows explicit no_website when website is cleared in same request', async () => {
    const { PATCH } = await import('./route');

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
        websiteStatus: 'no_website',
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

  it('PATCH updates contactInfo email when provided', async () => {
    const { PATCH } = await import('./route');

    mockBusinessUpdate.mockResolvedValue({
      id: 'lead-123',
      approvedByUser: null,
      rejectedByUser: null,
      contactInfo: [],
    });

    mockContactFindFirst.mockResolvedValue({
      id: 'contact-123',
      businessId: 'lead-123',
    });

    mockBusinessFindUnique.mockResolvedValue({
      id: 'lead-123',
      approvedByUser: null,
      rejectedByUser: null,
      contactInfo: [
        {
          id: 'contact-123',
          email: 'owner@example.com',
          phone: null,
          facebookUrl: null,
          instagramUrl: null,
          linkedinUrl: null,
        },
      ],
    });

    const request = new NextRequest('http://localhost/api/leads/lead-123', {
      method: 'PATCH',
      body: JSON.stringify({
        email: ' owner@example.com ',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: 'lead-123' }) });

    expect(response.status).toBe(200);
    expect(mockContactUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'contact-123' },
        data: expect.objectContaining({
          email: 'owner@example.com',
        }),
      })
    );
  });
});
