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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const { id, commentId } = await params;

  const userId = await resolveActingUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const existing = await prisma.leadComment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        businessId: true,
        authorUserId: true,
      },
    });

    if (!existing || existing.businessId !== id) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    if (existing.authorUserId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const content = typeof body?.content === 'string' ? body.content.trim() : '';

    if (!content) {
      return NextResponse.json({ error: 'Comment content is required' }, { status: 400 });
    }

    if (content.length > 5000) {
      return NextResponse.json({ error: 'Comment content is too long' }, { status: 400 });
    }

    const updated = await prisma.leadComment.update({
      where: { id: commentId },
      data: {
        content,
        editedAt: new Date(),
      },
      include: commentInclude,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error editing lead comment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
