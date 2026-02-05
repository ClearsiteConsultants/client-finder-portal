/**
 * Lead lifecycle state management
 * Defines valid state transitions and validation logic
 */

import { LeadStatus } from '@prisma/client';

export type LeadStatusTransition = {
  from: LeadStatus;
  to: LeadStatus;
  allowed: boolean;
  reason?: string;
};

/**
 * Valid state transitions for leads
 * pending → approved/rejected
 * approved → contacted
 * contacted → responded/inactive
 * responded → inactive
 */
const VALID_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  pending: ['approved', 'rejected'],
  approved: ['contacted', 'rejected'],
  rejected: [],
  contacted: ['responded', 'inactive'],
  responded: ['inactive'],
  inactive: [],
};

/**
 * Validates if a state transition is allowed
 */
export function isValidTransition(
  from: LeadStatus,
  to: LeadStatus
): boolean {
  if (from === to) return true;
  return VALID_TRANSITIONS[from]?.includes(to) || false;
}

/**
 * Gets all valid target states from a given state
 */
export function getValidNextStates(from: LeadStatus): LeadStatus[] {
  return VALID_TRANSITIONS[from] || [];
}

/**
 * Validates a state transition and returns details
 */
export function validateTransition(
  from: LeadStatus,
  to: LeadStatus
): LeadStatusTransition {
  const allowed = isValidTransition(from, to);
  
  return {
    from,
    to,
    allowed,
    reason: allowed 
      ? undefined 
      : `Invalid transition from ${from} to ${to}. Valid transitions from ${from}: ${getValidNextStates(from).join(', ') || 'none'}`,
  };
}

/**
 * Error thrown when an invalid state transition is attempted
 */
export class InvalidStateTransitionError extends Error {
  constructor(
    public from: LeadStatus,
    public to: LeadStatus,
    message?: string
  ) {
    super(message || `Invalid state transition from ${from} to ${to}`);
    this.name = 'InvalidStateTransitionError';
  }
}

/**
 * Asserts a state transition is valid, throws if not
 */
export function assertValidTransition(
  from: LeadStatus,
  to: LeadStatus
): void {
  const result = validateTransition(from, to);
  if (!result.allowed) {
    throw new InvalidStateTransitionError(from, to, result.reason);
  }
}
