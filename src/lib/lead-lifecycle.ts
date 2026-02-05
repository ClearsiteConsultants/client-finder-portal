/**
 * Lead lifecycle state management
 * Defines valid state transitions and validation logic
 */

import { LeadStatus, Business } from '@prisma/client';

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

/**
 * Validates if a lead can be converted to a client
 * By default, only approved leads can be converted
 */
export function canConvertToClient(business: Pick<Business, 'leadStatus' | 'isClient'>): {
  canConvert: boolean;
  reason?: string;
} {
  if (business.isClient) {
    return {
      canConvert: false,
      reason: 'Business is already a client'
    };
  }
  
  if (business.leadStatus !== 'approved') {
    return {
      canConvert: false,
      reason: `Only approved leads can be converted to clients. Current status: ${business.leadStatus}`
    };
  }
  
  return { canConvert: true };
}

/**
 * Error thrown when an invalid conversion is attempted
 */
export class InvalidConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidConversionError';
  }
}

/**
 * Asserts a business can be converted to a client, throws if not
 */
export function assertCanConvertToClient(business: Pick<Business, 'leadStatus' | 'isClient'>): void {
  const result = canConvertToClient(business);
  if (!result.canConvert) {
    throw new InvalidConversionError(result.reason || 'Cannot convert to client');
  }
}
