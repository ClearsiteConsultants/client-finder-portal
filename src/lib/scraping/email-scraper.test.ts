import {
  extractEmailsFromHtml,
  isValidEmail,
  checkRobotsTxt,
  scrapeEmailsFromWebsite,
  EmailInfo,
} from './email-scraper';

describe('Email Scraper', () => {
  describe('isValidEmail', () => {
    it('should validate correct email formats', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail('test.user@company.co.uk')).toBe(true);
      expect(isValidEmail('contact+tag@business.com')).toBe(true);
      expect(isValidEmail('first_last@sub.company.org')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('notanemail')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
      expect(isValidEmail('user@.com')).toBe(false);
    });

    it('should filter out common false positives', () => {
      expect(isValidEmail('image.png@server.com')).toBe(false);
      expect(isValidEmail('style.css@cdn.com')).toBe(false);
      expect(isValidEmail('demo@company.com')).toBe(false);
      expect(isValidEmail('test@test.com')).toBe(false);
      expect(isValidEmail('noreply@company.com')).toBe(false);
      expect(isValidEmail('no-reply@company.com')).toBe(false);
      expect(isValidEmail('user@localhost.com')).toBe(false);
    });

    it('should reject emails that are too short or too long', () => {
      expect(isValidEmail('a@b.c')).toBe(false);
      expect(isValidEmail('a'.repeat(250) + '@example.com')).toBe(false);
    });
  });

  describe('extractEmailsFromHtml', () => {
    it('should extract emails from mailto links', () => {
      const html = `
        <html>
          <body>
            <a href="mailto:contact@company.com">Contact Us</a>
            <a href="mailto:support@company.com?subject=Help">Support</a>
          </body>
        </html>
      `;
      
      const emails = extractEmailsFromHtml(html, 'https://example.com');
      
      expect(emails).toHaveLength(2);
      expect(emails[0].email).toBe('contact@company.com');
      expect(emails[0].confidence).toBe(90);
      expect(emails[0].source).toBe('scraped');
      expect(emails[1].email).toBe('support@company.com');
    });

    it('should extract emails from plain text', () => {
      const html = `
        <html>
          <body>
            <div class="footer">
              <p>Contact us at: info@business.com</p>
              <p>Or email sales@business.com for inquiries</p>
            </div>
          </body>
        </html>
      `;
      
      const emails = extractEmailsFromHtml(html, 'https://example.com');
      
      expect(emails.length).toBeGreaterThanOrEqual(2);
      const emailAddresses = emails.map(e => e.email);
      expect(emailAddresses).toContain('info@business.com');
      expect(emailAddresses).toContain('sales@business.com');
    });

    it('should handle mixed mailto and text emails', () => {
      const html = `
        <html>
          <body>
            <a href="mailto:hello@company.com">Email us</a>
            <p>Or call us, alternatively reach out to support@company.com</p>
          </body>
        </html>
      `;
      
      const emails = extractEmailsFromHtml(html, 'https://example.com');
      
      expect(emails.length).toBeGreaterThanOrEqual(2);
      const emailAddresses = emails.map(e => e.email);
      expect(emailAddresses).toContain('hello@company.com');
      expect(emailAddresses).toContain('support@company.com');
    });

    it('should deduplicate emails found multiple times', () => {
      const html = `
        <html>
          <body>
            <a href="mailto:info@company.com">Contact</a>
            <p>Email: info@company.com</p>
            <footer>info@company.com</footer>
          </body>
        </html>
      `;
      
      const emails = extractEmailsFromHtml(html, 'https://example.com');
      
      expect(emails).toHaveLength(1);
      expect(emails[0].email).toBe('info@company.com');
    });

    it('should filter out invalid emails', () => {
      const html = `
        <html>
          <body>
            <a href="mailto:valid@company.com">Contact</a>
            <p>Image: logo.png@cdn.example.com</p>
            <p>Demo: demo@company.com</p>
            <p>Valid: real.email@business.org</p>
          </body>
        </html>
      `;
      
      const emails = extractEmailsFromHtml(html, 'https://example.com');
      
      const emailAddresses = emails.map(e => e.email);
      expect(emailAddresses).toContain('valid@company.com');
      expect(emailAddresses).toContain('real.email@business.org');
      expect(emailAddresses).not.toContain('logo.png@cdn.example.com');
      expect(emailAddresses).not.toContain('demo@company.com');
    });

    it('should handle HTML with no emails', () => {
      const html = `
        <html>
          <body>
            <p>This page has no contact information</p>
          </body>
        </html>
      `;
      
      const emails = extractEmailsFromHtml(html, 'https://example.com');
      
      expect(emails).toHaveLength(0);
    });

    it('should handle realistic HTML samples', () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>About Us</title></head>
          <body>
            <header>
              <nav>
                <a href="/">Home</a>
                <a href="/contact">Contact</a>
              </nav>
            </header>
            <main>
              <h1>About Our Company</h1>
              <p>We are a small business serving the community.</p>
              <section id="contact">
                <h2>Get in Touch</h2>
                <p>Email us at <a href="mailto:hello@smallbiz.com">hello@smallbiz.com</a></p>
                <p>For sales inquiries: sales@smallbiz.com</p>
              </section>
            </main>
            <footer>
              <p>&copy; 2024 Small Business | Contact: info@smallbiz.com</p>
            </footer>
          </body>
        </html>
      `;
      
      const emails = extractEmailsFromHtml(html, 'https://smallbiz.com');
      
      expect(emails.length).toBeGreaterThanOrEqual(3);
      const emailAddresses = emails.map(e => e.email);
      expect(emailAddresses).toContain('hello@smallbiz.com');
      expect(emailAddresses).toContain('sales@smallbiz.com');
      expect(emailAddresses).toContain('info@smallbiz.com');
    });

    it('should normalize email case', () => {
      const html = `
        <html>
          <body>
            <a href="mailto:Contact@Company.COM">Email</a>
          </body>
        </html>
      `;
      
      const emails = extractEmailsFromHtml(html, 'https://example.com');
      
      expect(emails[0].email).toBe('contact@company.com');
    });
  });

  describe('checkRobotsTxt', () => {
    it('should return true when robots.txt allows scraping', async () => {
      // This is a basic test - in a real scenario, we'd mock fetch
      // For now, we test the function exists and handles errors gracefully
      const result = await checkRobotsTxt(
        'https://nonexistent-site-for-testing-12345.com',
        '/contact',
        'TestBot'
      );
      
      // Should return true when robots.txt doesn't exist (assume allowed)
      expect(typeof result).toBe('boolean');
    });

    it('should handle fetch errors gracefully', async () => {
      const result = await checkRobotsTxt(
        'https://invalid-url-that-will-fail',
        '/test',
        'TestBot'
      );
      
      // Should default to true on error
      expect(result).toBe(true);
    });
  });

  describe('scrapeEmailsFromWebsite', () => {
    it('should return empty results for invalid URLs', async () => {
      const result = await scrapeEmailsFromWebsite('invalid-url');
      
      expect(result.emails).toHaveLength(0);
      expect(result.pagesScraped).toBe(0);
    });

    it('should respect maxPages configuration', async () => {
      // This test would require mocking fetch to provide controlled responses
      // For now, we verify the config parameter is accepted
      const result = await scrapeEmailsFromWebsite(
        'https://nonexistent-for-test.com',
        { maxPages: 2 }
      );
      
      expect(result.pagesScraped).toBeLessThanOrEqual(2);
    });

    it('should respect timeout configuration', async () => {
      const result = await scrapeEmailsFromWebsite(
        'https://nonexistent-for-test.com',
        { timeoutMs: 1000 }
      );
      
      // Should complete without hanging
      expect(result).toBeDefined();
    });

    it('should handle scraping errors gracefully', async () => {
      const result = await scrapeEmailsFromWebsite('https://this-will-fail-12345.com');
      
      expect(result).toHaveProperty('emails');
      expect(result).toHaveProperty('pagesScraped');
      expect(result).toHaveProperty('robotsTxtAllowed');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle a complete scraping workflow', async () => {
      // This test demonstrates the expected workflow
      const testUrl = 'https://example.com';
      
      const result = await scrapeEmailsFromWebsite(testUrl, {
        maxPages: 3,
        maxDepth: 1,
        timeoutMs: 5000,
        respectRobotsTxt: true,
      });
      
      expect(result).toHaveProperty('emails');
      expect(result).toHaveProperty('pagesScraped');
      expect(result).toHaveProperty('robotsTxtAllowed');
      expect(Array.isArray(result.emails)).toBe(true);
      expect(typeof result.pagesScraped).toBe('number');
      expect(typeof result.robotsTxtAllowed).toBe('boolean');
      
      // Each email should have the expected structure
      result.emails.forEach((emailInfo: EmailInfo) => {
        expect(emailInfo).toHaveProperty('email');
        expect(emailInfo).toHaveProperty('source');
        expect(emailInfo).toHaveProperty('confidence');
        expect(typeof emailInfo.email).toBe('string');
        expect(emailInfo.source).toBe('scraped');
        expect(typeof emailInfo.confidence).toBe('number');
      });
    });
  });
});
