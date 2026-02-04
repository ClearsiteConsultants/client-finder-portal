/**
 * @jest-environment node
 */

describe('/api/leads/[id]', () => {
  it('should have GET and PATCH endpoints', async () => {
    const { GET, PATCH } = await import('./route');
    expect(GET).toBeDefined();
    expect(PATCH).toBeDefined();
  });
});
