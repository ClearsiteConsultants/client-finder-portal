/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';

const mockAuth = jest.fn();
const mockUserFindUnique = jest.fn();
const mockLeadCommentFindUnique = jest.fn();
const mockLeadCommentUpdate = jest.fn();

jest.mock('@/lib/auth', () => ({
  auth: (...args: any[]) => mockAuth(...args),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: (...args: any[]) => mockUserFindUnique(...args),
    },
    leadComment: {
      findUnique: (...args: any[]) => mockLeadCommentFindUnique(...args),
      update: (...args: any[]) => mockLeadCommentUpdate(...args),
    },
  },
}));

describe('/api/leads/[id]/comments/[commentId]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: 'user-123' } });
    mockUserFindUnique.mockResolvedValue({ id: 'user-123' });
  });

  it('PATCH rejects editing another user comment', async () => {
    const { PATCH } = await import('./route');

    mockLeadCommentFindUnique.mockResolvedValue({
      id: 'comment-1',
      businessId: 'lead-1',
      authorUserId: 'user-999',
    });

    const request = new NextRequest('http://localhost/api/leads/lead-1/comments/comment-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Updated content' }),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ id: 'lead-1', commentId: 'comment-1' }),
    });

    expect(response.status).toBe(403);
    expect(mockLeadCommentUpdate).not.toHaveBeenCalled();
  });

  it('PATCH edits own comment and marks editedAt', async () => {
    const { PATCH } = await import('./route');

    mockLeadCommentFindUnique.mockResolvedValue({
      id: 'comment-1',
      businessId: 'lead-1',
      authorUserId: 'user-123',
    });

    mockLeadCommentUpdate.mockResolvedValue({
      id: 'comment-1',
      businessId: 'lead-1',
      parentCommentId: null,
      content: 'Updated content',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      editedAt: new Date().toISOString(),
      authorUser: { id: 'user-123', name: 'User', email: 'u@example.com' },
    });

    const request = new NextRequest('http://localhost/api/leads/lead-1/comments/comment-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Updated content' }),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ id: 'lead-1', commentId: 'comment-1' }),
    });

    expect(response.status).toBe(200);
    expect(mockLeadCommentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'comment-1' },
        data: expect.objectContaining({
          content: 'Updated content',
          editedAt: expect.any(Date),
        }),
      })
    );
  });
});
