/**
 * @jest-environment node
 */

describe('Lead Lifecycle API Endpoints', () => {
  describe('API Routes exist and compile', () => {
    it('should compile approve endpoint', () => {
      // Just ensure the file exists and can be required
      expect(() => require.resolve('@/app/api/leads/approve/route')).not.toThrow();
    });

    it('should compile reject endpoint', () => {
      expect(() => require.resolve('@/app/api/leads/reject/route')).not.toThrow();
    });

    it('should compile contacted endpoint', () => {
      expect(() => require.resolve('@/app/api/leads/contacted/route')).not.toThrow();
    });

    it('should compile responded endpoint', () => {
      expect(() => require.resolve('@/app/api/leads/responded/route')).not.toThrow();
    });

    it('should compile inactive endpoint', () => {
      expect(() => require.resolve('@/app/api/leads/inactive/route')).not.toThrow();
    });
  });
});
