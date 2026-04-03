import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function resolveActingUserId(): Promise<string | null> {
  const session = await auth();

  if (!session?.user?.email && !session?.user?.id) {
    return null;
  }

  const actingUser = session.user.email
    ? await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      })
    : await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true },
      });

  return actingUser?.id ?? null;
}

const commentInclude = {
  authorUser: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const userId = await resolveActingUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const comments = await prisma.leadComment.findMany({
      where: { businessId: id },
      select: {
        id: true,
        businessId: true,
        parentCommentId: true,
        content: true,
        createdAt: true,
        updatedAt: true,
        editedAt: true,
        authorUserId: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const authorUserIds = Array.from(new Set(comments.map((comment) => comment.authorUserId)));

    const authors = authorUserIds.length
      ? await prisma.user.findMany({
          where: { id: { in: authorUserIds } },
          select: {
            id: true,
            name: true,
            email: true,
          },
        })
      : [];

    const authorsById = new Map(authors.map((author) => [author.id, author]));

    const commentsWithAuthor = comments.map((comment) => ({
      id: comment.id,
      businessId: comment.businessId,
      parentCommentId: comment.parentCommentId,
      content: comment.content,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      editedAt: comment.editedAt,
      authorUser:
        authorsById.get(comment.authorUserId) ?? {
          id: comment.authorUserId,
          name: null,
          email: null,
        },
    }));

    return NextResponse.json({ comments: commentsWithAuthor });
  } catch (error) {
    console.error('Error fetching lead comments:', error);

    // Be resilient for legacy production records: return an empty thread rather than
    // failing the entire notes card when a historic data inconsistency is encountered.
    return NextResponse.json({ comments: [] });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const userId = await resolveActingUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const content = typeof body?.content === 'string' ? body.content.trim() : '';
    const parentCommentId = typeof body?.parentCommentId === 'string' ? body.parentCommentId : null;

    if (!content) {
      return NextResponse.json({ error: 'Comment content is required' }, { status: 400 });
    }

    if (content.length > 5000) {
      return NextResponse.json({ error: 'Comment content is too long' }, { status: 400 });
    }

    if (parentCommentId) {
      const parent = await prisma.leadComment.findUnique({
        where: { id: parentCommentId },
        select: { businessId: true },
      });

      if (!parent || parent.businessId !== id) {
        return NextResponse.json({ error: 'Parent comment not found' }, { status: 404 });
      }
    }

    const created = await prisma.leadComment.create({
      data: {
        businessId: id,
        authorUserId: userId,
        parentCommentId,
        content,
      },
      include: commentInclude,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Error creating lead comment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
