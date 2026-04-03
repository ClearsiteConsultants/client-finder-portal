/**
 * POST /api/clients/[id]/checklist
 * Toggle onboarding checklist tasks (audit trail in outreach_tracking)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const OnboardingTaskSchema = z.enum([
  'discovery_call_completed',
  'scope_timeline_approved',
  'contract_signed',
  'invoice_deposit_received',
  'stakeholders_communication_confirmed',
  'access_collected',
  'brand_content_assets_received',
  'technical_requirements_finalized',
  'ux_wireframes_approved',
  'development_kickoff_completed',
]);

const ToggleOnboardingTaskSchema = z.object({
  taskKey: OnboardingTaskSchema,
  checked: z.boolean(),
});

const ONBOARDING_TASKS: Record<z.infer<typeof OnboardingTaskSchema>, string> = {
  discovery_call_completed: 'Discovery Call Completed',
  scope_timeline_approved: 'Scope, Deliverables, and Timeline Approved',
  contract_signed: 'Contract Signed',
  invoice_deposit_received: 'Invoice Sent and Deposit Received',
  stakeholders_communication_confirmed: 'Stakeholders, Roles, and Communication Cadence Confirmed',
  access_collected: 'Access Collected (Domain/DNS, Hosting, CMS/Repo, Analytics, Integrations)',
  brand_content_assets_received: 'Brand and Content Assets Received (Logo, Fonts, Copy, Media)',
  technical_requirements_finalized: 'Technical Requirements Finalized (Features, Integrations, Compliance, Performance)',
  ux_wireframes_approved: 'UX/Wireframes Approved',
  development_kickoff_completed: 'Development Kickoff Completed',
};

const parseOnboardingOutcome = (outcome: string | null) => {
  if (!outcome?.startsWith('onboarding_')) {
    return null;
  }

  const [action, taskKey] = outcome.split(':');
  if (!taskKey || !(taskKey in ONBOARDING_TASKS)) {
    return null;
  }

  return {
    action,
    taskKey: taskKey as z.infer<typeof OnboardingTaskSchema>,
    checked: action === 'onboarding_checked',
  };
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = ToggleOnboardingTaskSchema.parse(body);

    // Check if client exists
    const client = await prisma.business.findUnique({
      where: { 
        id,
        isClient: true,
      },
    });

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    const taskLabel = ONBOARDING_TASKS[validatedData.taskKey];
    const activityAction = validatedData.checked ? 'Checked' : 'Unchecked';

    // Record onboarding task toggle in outreach_tracking for audit trail
    const checklistEntry = await prisma.outreachTracking.create({
      data: {
        businessId: id,
        createdByUserId: session.user.id,
        channel: 'email',
        occurredAt: new Date(),
        outcome: `${validatedData.checked ? 'onboarding_checked' : 'onboarding_unchecked'}:${validatedData.taskKey}`,
        notes: `${activityAction} onboarding task: ${taskLabel}`,
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      checklistEntry,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error recording checklist action:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Check if client exists
    const client = await prisma.business.findUnique({
      where: { 
        id,
        isClient: true,
      },
    });

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    const onboardingEntries = await prisma.outreachTracking.findMany({
      where: {
        businessId: id,
        outcome: { startsWith: 'onboarding_' },
      },
      orderBy: { occurredAt: 'desc' },
      include: {
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    const latestByTask = new Map<z.infer<typeof OnboardingTaskSchema>, (typeof onboardingEntries)[number]>();

    for (const entry of onboardingEntries) {
      const parsed = parseOnboardingOutcome(entry.outcome);
      if (!parsed || latestByTask.has(parsed.taskKey)) {
        continue;
      }
      latestByTask.set(parsed.taskKey, entry);
    }

    const tasks = Object.entries(ONBOARDING_TASKS).map(([taskKey, label]) => {
      const taskEntry = latestByTask.get(taskKey as z.infer<typeof OnboardingTaskSchema>);
      const parsed = parseOnboardingOutcome(taskEntry?.outcome ?? null);

      return {
        taskKey,
        label,
        checked: parsed?.checked ?? false,
        occurredAt: taskEntry?.occurredAt ?? null,
        createdByUser: taskEntry?.createdByUser ?? null,
      };
    });

    return NextResponse.json({
      tasks,
      checklistEntries: onboardingEntries,
    });
  } catch (error: unknown) {
    console.error('Error fetching checklist:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
