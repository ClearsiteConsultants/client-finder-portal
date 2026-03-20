import { GET } from './route';
import { prisma, disconnectPrisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

const mockAuth = auth as jest.MockedFunction<typeof auth>;

describe('GET /api/leads/queue', () => {
  const prefix = `queue-test-${Date.now()}`;
  const matchingBusinessType = `${prefix}-matching-type`;
  const otherBusinessType = `${prefix}-other-type`;
  const businessNames = {
    matching: `${prefix}-matching`,
    other: `${prefix}-other`,
  };

  beforeEach(async () => {
    await prisma.business.deleteMany({
      where: {
        name: {
          startsWith: prefix,
        },
      },
    });

    (mockAuth as unknown as jest.Mock).mockResolvedValue({
      user: {
        email: 'queue-test@example.com',
      },
      expires: new Date(Date.now() + 60_000).toISOString(),
    } as any);

    await prisma.business.createMany({
      data: [
        {
          name: businessNames.matching,
          address: '123 Main St',
          businessTypes: [matchingBusinessType],
          leadStatus: 'pending',
          websiteStatus: 'no_website',
        },
        {
          name: businessNames.other,
          address: '456 State St',
          businessTypes: [otherBusinessType],
          leadStatus: 'pending',
          websiteStatus: 'no_website',
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.business.deleteMany({
      where: {
        name: {
          startsWith: prefix,
        },
      },
    });

    await disconnectPrisma();
  });

  it('filters queue by businessType query param', async () => {
    const request = new Request(`http://localhost/api/leads/queue?businessType=${matchingBusinessType}&page=1&pageSize=50`);

    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.total).toBe(1);
    expect(data.leads).toHaveLength(1);
    expect(data.leads[0].name).toBe(businessNames.matching);
  });

  it('returns all matching queue records when businessType is not provided (All)', async () => {
    const request = new Request('http://localhost/api/leads/queue?page=1&pageSize=200');

    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    const names = data.leads.map((lead: { name: string }) => lead.name);
    expect(names).toEqual(expect.arrayContaining([businessNames.matching, businessNames.other]));
  });

  it('returns 401 when unauthenticated', async () => {
    (mockAuth as unknown as jest.Mock).mockResolvedValueOnce(null);
    const request = new Request('http://localhost/api/leads/queue?page=1&pageSize=50');

    const response = await GET(request as any);

    expect(response.status).toBe(401);
  });
});
