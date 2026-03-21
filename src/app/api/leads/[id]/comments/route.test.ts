/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';

const mockAuth = jest.fn();
const mockUserFindUnique = jest.fn();
const mockLeadCommentFindMany = jest.fn();
const mockLeadCommentFindUnique = jest.fn();
const mockLeadCommentCreate = jest.fn();

jest.mock('@/lib/auth', () => ({
  auth: (...args: any[]) => mockAuth(...args),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: (...args: any[]) => mockUserFindUnique(...args),
    },
    leadComment: {
      findMany: (...args: any[]) => mockLeadCommentFindMany(...args),
      findUnique: (...args: any[]) => mockLeadCommentFindUnique(...args),
      create: (...args: any[]) => mockLeadCommentCreate(...args),
    },
  },
}));

describe('/api/leads/[id]/comments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: 'user-123' } });
    mockUserFindUnique.mockResolvedValue({ id: 'user-123' });
  });

  it('GET returns comments for lead', async () => {
    const { GET } = await import('./route');

    mockLeadCommentFindMany.mockResolvedValue([
      {
        id: 'comment-1',
        content: 'First comment',
        parentCommentId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        editedAt: null,
        authorUser: { id: 'user-123', name: 'User', email: 'u@example.com' },
      },
    ]);

    const response = await GET(new NextRequest('http://localhost/api/leads/lead-1/comments'), {
      params: Promise.resolve({ id: 'lead-1' }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.comments).toHaveLength(1);
    expect(mockLeadCommentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { businessId: 'lead-1' },
      })
    );
  });

  it('POST creates top-level comment', async () => {
    const { POST } = await import('./route');

    mockLeadCommentCreate.mockResolvedValue({
      id: 'comment-2',
      businessId: 'lead-1',
      parentCommentId: null,
      content: 'A new comment',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      editedAt: null,
      authorUser: { id: 'user-123', name: 'User', email: 'u@example.com' },
    });

    const request = new NextRequest('http://localhost/api/leads/lead-1/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'A new comment' }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'lead-1' }) });

    expect(response.status).toBe(201);
    expect(mockLeadCommentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessId: 'lead-1',
          authorUserId: 'user-123',
          content: 'A new comment',
          parentCommentId: null,
        }),
      })
    );
  });

  it('POST rejects reply with parent from another lead', async () => {
    const { POST } = await import('./route');

    mockLeadCommentFindUnique.mockResolvedValue({ businessId: 'different-lead' });

    const request = new NextRequest('http://localhost/api/leads/lead-1/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'Reply',
        parentCommentId: 'parent-1',
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'lead-1' }) });

    expect(response.status).toBe(404);
    expect(mockLeadCommentCreate).not.toHaveBeenCalled();
  });
});
