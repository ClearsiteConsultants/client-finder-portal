import { formatQuizTitle, calculateScore } from './utils';

describe('Utils', () => {
  describe('formatQuizTitle', () => {
    it('should capitalize first letter', () => {
      expect(formatQuizTitle('hello world')).toBe('Hello world');
    });

    it('should trim whitespace', () => {
      expect(formatQuizTitle('  test  ')).toBe('Test');
    });

    it('should handle single character', () => {
      expect(formatQuizTitle('a')).toBe('A');
    });
  });

  describe('calculateScore', () => {
    it('should calculate percentage correctly', () => {
      expect(calculateScore(8, 10)).toBe(80);
      expect(calculateScore(5, 10)).toBe(50);
    });

    it('should handle zero total', () => {
      expect(calculateScore(0, 0)).toBe(0);
    });

    it('should round to nearest integer', () => {
      expect(calculateScore(2, 3)).toBe(67);
    });
  });
});
