import { LeadStatus } from '@prisma/client';
import {
  isValidTransition,
  getValidNextStates,
  validateTransition,
  assertValidTransition,
  InvalidStateTransitionError,
} from './lead-lifecycle';

describe('Lead Lifecycle State Transitions', () => {
  describe('isValidTransition', () => {
    it('allows pending → approved', () => {
      expect(isValidTransition('pending', 'approved')).toBe(true);
    });

    it('allows pending → rejected', () => {
      expect(isValidTransition('pending', 'rejected')).toBe(true);
    });

    it('allows approved → contacted', () => {
      expect(isValidTransition('approved', 'contacted')).toBe(true);
    });

    it('allows approved → rejected', () => {
      expect(isValidTransition('approved', 'rejected')).toBe(true);
    });

    it('allows contacted → responded', () => {
      expect(isValidTransition('contacted', 'responded')).toBe(true);
    });

    it('allows contacted → inactive', () => {
      expect(isValidTransition('contacted', 'inactive')).toBe(true);
    });

    it('allows responded → inactive', () => {
      expect(isValidTransition('responded', 'inactive')).toBe(true);
    });

    it('allows same state transitions', () => {
      expect(isValidTransition('pending', 'pending')).toBe(true);
      expect(isValidTransition('approved', 'approved')).toBe(true);
      expect(isValidTransition('contacted', 'contacted')).toBe(true);
    });

    it('disallows pending → contacted', () => {
      expect(isValidTransition('pending', 'contacted')).toBe(false);
    });

    it('disallows pending → responded', () => {
      expect(isValidTransition('pending', 'responded')).toBe(false);
    });

    it('disallows rejected → any state', () => {
      expect(isValidTransition('rejected', 'pending')).toBe(false);
      expect(isValidTransition('rejected', 'approved')).toBe(false);
      expect(isValidTransition('rejected', 'contacted')).toBe(false);
      expect(isValidTransition('rejected', 'responded')).toBe(false);
      expect(isValidTransition('rejected', 'inactive')).toBe(false);
    });

    it('disallows inactive → any state', () => {
      expect(isValidTransition('inactive', 'pending')).toBe(false);
      expect(isValidTransition('inactive', 'approved')).toBe(false);
      expect(isValidTransition('inactive', 'contacted')).toBe(false);
      expect(isValidTransition('inactive', 'responded')).toBe(false);
    });

    it('disallows approved → responded', () => {
      expect(isValidTransition('approved', 'responded')).toBe(false);
    });

    it('disallows contacted → approved', () => {
      expect(isValidTransition('contacted', 'approved')).toBe(false);
    });
  });

  describe('getValidNextStates', () => {
    it('returns correct states for pending', () => {
      expect(getValidNextStates('pending')).toEqual(['approved', 'rejected']);
    });

    it('returns correct states for approved', () => {
      expect(getValidNextStates('approved')).toEqual(['contacted', 'rejected']);
    });

    it('returns correct states for contacted', () => {
      expect(getValidNextStates('contacted')).toEqual(['responded', 'inactive']);
    });

    it('returns correct states for responded', () => {
      expect(getValidNextStates('responded')).toEqual(['inactive']);
    });

    it('returns empty array for rejected', () => {
      expect(getValidNextStates('rejected')).toEqual([]);
    });

    it('returns empty array for inactive', () => {
      expect(getValidNextStates('inactive')).toEqual([]);
    });
  });

  describe('validateTransition', () => {
    it('returns allowed=true for valid transitions', () => {
      const result = validateTransition('pending', 'approved');
      expect(result.allowed).toBe(true);
      expect(result.from).toBe('pending');
      expect(result.to).toBe('approved');
      expect(result.reason).toBeUndefined();
    });

    it('returns allowed=false with reason for invalid transitions', () => {
      const result = validateTransition('pending', 'contacted');
      expect(result.allowed).toBe(false);
      expect(result.from).toBe('pending');
      expect(result.to).toBe('contacted');
      expect(result.reason).toBeDefined();
      expect(result.reason).toContain('Invalid transition');
    });
  });

  describe('assertValidTransition', () => {
    it('does not throw for valid transitions', () => {
      expect(() => assertValidTransition('pending', 'approved')).not.toThrow();
      expect(() => assertValidTransition('approved', 'contacted')).not.toThrow();
      expect(() => assertValidTransition('contacted', 'responded')).not.toThrow();
    });

    it('throws InvalidStateTransitionError for invalid transitions', () => {
      expect(() => assertValidTransition('pending', 'contacted')).toThrow(
        InvalidStateTransitionError
      );
      expect(() => assertValidTransition('rejected', 'approved')).toThrow(
        InvalidStateTransitionError
      );
      expect(() => assertValidTransition('inactive', 'approved')).toThrow(
        InvalidStateTransitionError
      );
    });

    it('throws error with descriptive message', () => {
      expect(() => assertValidTransition('pending', 'contacted')).toThrow(
        /Invalid transition from pending to contacted/
      );
    });
  });
});
