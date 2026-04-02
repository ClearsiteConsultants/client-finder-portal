/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { MAX_STORED_WEBSITE_LENGTH } from '@/lib/validation/website-storage';

const mockAuth = jest.fn();
const mockPrismaCreate = jest.fn();
const mockDeriveWebsiteStatus = jest.fn();

jest.mock('@/lib/auth', () => ({
  auth: (...args: any[]) => mockAuth(...args),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    business: {
      create: (...args: any[]) => mockPrismaCreate(...args),
    },
  },
}));

jest.mock('@/lib/validation/website-status', () => ({
  deriveWebsiteStatus: (...args: any[]) => mockDeriveWebsiteStatus(...args),
}));

import { POST } from './route';

describe('POST /api/leads/create-manual', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockClear();
    mockPrismaCreate.mockClear();
    mockDeriveWebsiteStatus.mockResolvedValue('technical_issues');
  });

  it('should reject unauthenticated requests', async () => {
    mockAuth.mockResolvedValueOnce(null);

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
    mockAuth.mockResolvedValueOnce({
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
      websiteStatus: 'technical_issues',
      businessTypes: [],
    };

    mockPrismaCreate.mockResolvedValueOnce(mockBusiness);

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
        websiteStatus: 'technical_issues',
      }),
    });
  });

  it('should require name and address', async () => {
    mockAuth.mockResolvedValueOnce({
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
    mockAuth.mockResolvedValueOnce({
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
    await response.json();

    expect(response.status).toBe(201);
    expect(mockPrismaCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Test Business',
        address: '123 Main St',
        contactInfo: {
          create: {
            email: 'contact@test.com',
            facebookUrl: 'https://facebook.com/test',
            instagramUrl: 'https://instagram.com/test',
            linkedinUrl: null,
          },
        },
      }),
    });
  });

  it('derives social_only when no website but social profiles are provided', async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: 'user-123', email: 'test@example.com' },
      expires: '2024-12-31',
    });
    mockDeriveWebsiteStatus.mockResolvedValueOnce('social_only');

    mockPrismaCreate.mockResolvedValueOnce({
      id: 'business-123',
      name: 'Social Lead',
      address: '123 Main St',
      source: 'manual',
      websiteStatus: 'social_only',
      businessTypes: [],
    });

    const req = new NextRequest('http://localhost/api/leads/create-manual', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Social Lead',
        address: '123 Main St',
        facebook: 'https://facebook.com/sociallead',
      }),
    });

    const response = await POST(req);
    await response.json();

    expect(response.status).toBe(201);
    expect(mockDeriveWebsiteStatus).toHaveBeenCalledWith({
      website: null,
      socialProfiles: {
        facebookUrl: 'https://facebook.com/sociallead',
        instagramUrl: null,
        linkedinUrl: null,
      },
    });
  });

  it('truncates oversized website values before creating a manual lead', async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: 'user-123', email: 'test@example.com' },
      expires: '2024-12-31',
    });

    const oversizedWebsite = `https://manual.test/${'a'.repeat(MAX_STORED_WEBSITE_LENGTH + 40)}`;
    const truncatedWebsite = oversizedWebsite.slice(0, MAX_STORED_WEBSITE_LENGTH);

    mockPrismaCreate.mockResolvedValueOnce({
      id: 'business-123',
      name: 'Manual Lead',
      address: '123 Main St',
      website: truncatedWebsite,
      source: 'manual',
      businessTypes: [],
      websiteStatus: 'technical_issues',
    });

    const req = new NextRequest('http://localhost/api/leads/create-manual', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Manual Lead',
        address: '123 Main St',
        website: oversizedWebsite,
      }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.business.website).toBe(truncatedWebsite);
    expect(mockDeriveWebsiteStatus).toHaveBeenCalledWith({
      website: truncatedWebsite,
      socialProfiles: {
        facebookUrl: null,
        instagramUrl: null,
        linkedinUrl: null,
      },
    });
    expect(mockPrismaCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        website: truncatedWebsite,
      }),
    });
  });

  it('strips Google Maps tracking query parameters before creating a manual lead', async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: 'user-123', email: 'test@example.com' },
      expires: '2024-12-31',
    });

    const trackedWebsite = 'https://www.bigotires.com/location/ut/south-jordan/10227-s-redwood-rd-84095/044245?utm_source=google&utm_medium=maps&utm_campaign=google+maps&y_source=1_ODY2OTU3My03MTUtbG9jYXRpb24ud2Vic2l0ZQ%3D%3D';
    const cleanedWebsite = 'https://www.bigotires.com/location/ut/south-jordan/10227-s-redwood-rd-84095/044245';

    mockPrismaCreate.mockResolvedValueOnce({
      id: 'business-123',
      name: 'Manual Lead',
      address: '123 Main St',
      website: cleanedWebsite,
      source: 'manual',
      businessTypes: [],
      websiteStatus: 'technical_issues',
    });

    const req = new NextRequest('http://localhost/api/leads/create-manual', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Manual Lead',
        address: '123 Main St',
        website: trackedWebsite,
      }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.business.website).toBe(cleanedWebsite);
    expect(mockDeriveWebsiteStatus).toHaveBeenCalledWith({
      website: cleanedWebsite,
      socialProfiles: {
        facebookUrl: null,
        instagramUrl: null,
        linkedinUrl: null,
      },
    });
    expect(mockPrismaCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        website: cleanedWebsite,
      }),
    });
  });
});
