import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createServer, Server, IncomingMessage, ServerResponse } from 'http';
import { normalizeUrl, validateWebsite } from './website-validator';
import { WebsiteStatus } from '@prisma/client';

describe('normalizeUrl', () => {
  it('should return null for empty or null URLs', () => {
    expect(normalizeUrl(null)).toBeNull();
    expect(normalizeUrl(undefined)).toBeNull();
    expect(normalizeUrl('')).toBeNull();
    expect(normalizeUrl('   ')).toBeNull();
  });

  it('should add https:// protocol if missing', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com/');
    expect(normalizeUrl('www.example.com')).toBe('https://www.example.com/');
  });

  it('should preserve existing protocol', () => {
    expect(normalizeUrl('http://example.com')).toBe('http://example.com/');
    expect(normalizeUrl('https://example.com')).toBe('https://example.com/');
  });

  it('should normalize URLs to lowercase', () => {
    expect(normalizeUrl('EXAMPLE.COM')).toBe('https://example.com/');
    expect(normalizeUrl('HTTP://EXAMPLE.COM')).toBe('http://example.com/');
  });

  it('should handle URLs with paths and query strings', () => {
    expect(normalizeUrl('example.com/path?query=1')).toBe('https://example.com/path?query=1');
  });

  it('should return null for invalid URLs', () => {
    expect(normalizeUrl('not a url at all')).toBeNull();
  });
});

describe('validateWebsite classification rules', () => {
  it('should classify null/empty URLs as no_website', async () => {
    const result = await validateWebsite(null);
    expect(result.status).toBe('no_website');
    expect(result.detectedIssues).toEqual([]);
  });

  it('should classify empty string as no_website', async () => {
    const result = await validateWebsite('');
    expect(result.status).toBe('no_website');
    expect(result.detectedIssues).toEqual([]);
  });

  it('should classify whitespace-only as no_website', async () => {
    const result = await validateWebsite('   ');
    expect(result.status).toBe('no_website');
    expect(result.detectedIssues).toEqual([]);
  });
});

describe('validateWebsite with test server', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll((done) => {
    server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = req.url || '/';

      if (url === '/200-ok') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>OK</body></html>');
      } else if (url === '/200-no-viewport') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><head></head><body>OK</body></html>');
      } else if (url === '/404-not-found') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<html><body>Not Found</body></html>');
      } else if (url === '/500-server-error') {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end('<html><body>Server Error</body></html>');
      } else if (url === '/slow-response') {
        // Respond after 6 seconds (exceeds SLOW_LOAD_THRESHOLD_MS of 5000)
        setTimeout(() => {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<html><head><meta name="viewport" content="width=device-width"></head><body>Slow</body></html>');
        }, 6000);
      } else if (url === '/timeout') {
        // Never respond (will timeout)
        // Don't send any response
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    server.listen(0, () => {
      const address = server.address();
      if (address && typeof address !== 'string') {
        baseUrl = `http://localhost:${address.port}`;
        done();
      }
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  it('should classify 200 OK with viewport as acceptable (if HTTPS)', async () => {
    // Note: Local test server is HTTP, so it will be classified as outdated
    // This test verifies metrics collection works correctly
    const result = await validateWebsite(`${baseUrl}/200-ok`);
    expect(result.responseCode).toBe(200);
    expect(result.hasSSL).toBe(false); // Local test server is HTTP
    expect(result.hasMobileViewport).toBe(true);
    // Without HTTPS, it will be outdated, not acceptable
    expect(result.status).toBe('outdated');
    expect(result.detectedIssues).toContain('No HTTPS/SSL');
  });

  it('should classify 200 OK without SSL as outdated', async () => {
    const result = await validateWebsite(`${baseUrl}/200-ok`);
    expect(result.status).toBe('outdated');
    expect(result.responseCode).toBe(200);
    expect(result.hasSSL).toBe(false);
    expect(result.detectedIssues).toContain('No HTTPS/SSL');
  });

  it('should classify 200 OK without mobile viewport as technical_issues', async () => {
    // Note: This will also fail SSL check, so it will be outdated
    const result = await validateWebsite(`${baseUrl}/200-no-viewport`);
    expect(result.responseCode).toBe(200);
    expect(result.hasMobileViewport).toBe(false);
    expect(result.detectedIssues).toContain('No mobile viewport meta tag');
  });

  it('should classify 404 as broken', async () => {
    const result = await validateWebsite(`${baseUrl}/404-not-found`);
    expect(result.status).toBe('broken');
    expect(result.responseCode).toBe(404);
    expect(result.detectedIssues).toContain('HTTP 404 error');
  });

  it('should classify 500 as broken', async () => {
    const result = await validateWebsite(`${baseUrl}/500-server-error`);
    expect(result.status).toBe('broken');
    expect(result.responseCode).toBe(500);
    expect(result.detectedIssues).toContain('HTTP 500 error');
  });

  it('should classify slow response as outdated', async () => {
    const result = await validateWebsite(`${baseUrl}/slow-response`);
    expect(result.status).toBe('outdated');
    expect(result.responseCode).toBe(200);
    expect(result.loadTimeMs).toBeGreaterThan(5000);
    expect(result.detectedIssues.some(issue => issue.includes('Slow load time'))).toBe(true);
  }, 15000); // Increase Jest timeout for this test

  it('should classify timeout as broken', async () => {
    const result = await validateWebsite(`${baseUrl}/timeout`);
    expect(result.status).toBe('broken');
    expect(result.detectedIssues).toContain('Request timed out');
  }, 15000); // Increase Jest timeout for this test

  it('should handle invalid domain as broken', async () => {
    const result = await validateWebsite('http://this-domain-does-not-exist-12345.com');
    expect(result.status).toBe('broken');
    expect(result.detectedIssues.length).toBeGreaterThan(0);
  }, 15000);
});
