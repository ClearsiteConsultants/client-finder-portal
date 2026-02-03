import {
  normalizeSocialUrl,
  extractSocialMediaFromHtml,
  scrapeSocialMediaFromWebsite,
  isSocialOnly,
} from './social-media-scraper';

describe('normalizeSocialUrl', () => {
  describe('Facebook URLs', () => {
    it('should normalize standard facebook.com URLs', () => {
      const url = 'https://www.facebook.com/MyBusiness';
      const result = normalizeSocialUrl(url, 'facebook');
      expect(result).toBe('https://www.facebook.com/MyBusiness');
    });

    it('should normalize fb.com to facebook.com', () => {
      const url = 'https://fb.com/MyBusiness';
      const result = normalizeSocialUrl(url, 'facebook');
      expect(result).toBe('https://www.facebook.com/MyBusiness');
    });

    it('should add protocol if missing', () => {
      const url = 'facebook.com/MyBusiness';
      const result = normalizeSocialUrl(url, 'facebook');
      expect(result).toBe('https://www.facebook.com/MyBusiness');
    });

    it('should remove tracking parameters', () => {
      const url = 'https://www.facebook.com/MyBusiness?ref=page_internal&source=tracking';
      const result = normalizeSocialUrl(url, 'facebook');
      expect(result).toBe('https://www.facebook.com/MyBusiness');
    });

    it('should remove trailing slashes', () => {
      const url = 'https://www.facebook.com/MyBusiness/';
      const result = normalizeSocialUrl(url, 'facebook');
      expect(result).toBe('https://www.facebook.com/MyBusiness');
    });

    it('should clean up /pages/ paths', () => {
      const url = 'https://www.facebook.com/pages/category/MyBusiness';
      const result = normalizeSocialUrl(url, 'facebook');
      expect(result).toBe('https://www.facebook.com/MyBusiness');
    });

    it('should reject generic pages like /home', () => {
      const url = 'https://www.facebook.com/home';
      const result = normalizeSocialUrl(url, 'facebook');
      expect(result).toBeNull();
    });

    it('should reject /marketplace paths', () => {
      const url = 'https://www.facebook.com/marketplace';
      const result = normalizeSocialUrl(url, 'facebook');
      expect(result).toBeNull();
    });
  });

  describe('Instagram URLs', () => {
    it('should normalize standard instagram URLs', () => {
      const url = 'https://www.instagram.com/mybusiness';
      const result = normalizeSocialUrl(url, 'instagram');
      expect(result).toBe('https://www.instagram.com/mybusiness');
    });

    it('should add www prefix', () => {
      const url = 'https://instagram.com/mybusiness';
      const result = normalizeSocialUrl(url, 'instagram');
      expect(result).toBe('https://www.instagram.com/mybusiness');
    });

    it('should remove tracking parameters', () => {
      const url = 'https://www.instagram.com/mybusiness?utm_source=ig_profile';
      const result = normalizeSocialUrl(url, 'instagram');
      expect(result).toBe('https://www.instagram.com/mybusiness');
    });

    it('should remove trailing slashes', () => {
      const url = 'https://www.instagram.com/mybusiness/';
      const result = normalizeSocialUrl(url, 'instagram');
      expect(result).toBe('https://www.instagram.com/mybusiness');
    });

    it('should reject /explore paths', () => {
      const url = 'https://www.instagram.com/explore';
      const result = normalizeSocialUrl(url, 'instagram');
      expect(result).toBeNull();
    });

    it('should reject /accounts paths', () => {
      const url = 'https://www.instagram.com/accounts/login';
      const result = normalizeSocialUrl(url, 'instagram');
      expect(result).toBeNull();
    });
  });

  describe('LinkedIn URLs', () => {
    it('should normalize company URLs', () => {
      const url = 'https://www.linkedin.com/company/mybusiness';
      const result = normalizeSocialUrl(url, 'linkedin');
      expect(result).toBe('https://www.linkedin.com/company/mybusiness');
    });

    it('should normalize personal profile URLs', () => {
      const url = 'https://www.linkedin.com/in/john-doe';
      const result = normalizeSocialUrl(url, 'linkedin');
      expect(result).toBe('https://www.linkedin.com/in/john-doe');
    });

    it('should add www prefix', () => {
      const url = 'https://linkedin.com/company/mybusiness';
      const result = normalizeSocialUrl(url, 'linkedin');
      expect(result).toBe('https://www.linkedin.com/company/mybusiness');
    });

    it('should remove tracking parameters', () => {
      const url = 'https://www.linkedin.com/company/mybusiness?trk=profile';
      const result = normalizeSocialUrl(url, 'linkedin');
      expect(result).toBe('https://www.linkedin.com/company/mybusiness');
    });

    it('should remove trailing slashes', () => {
      const url = 'https://www.linkedin.com/company/mybusiness/';
      const result = normalizeSocialUrl(url, 'linkedin');
      expect(result).toBe('https://www.linkedin.com/company/mybusiness');
    });

    it('should reject non-company/in paths', () => {
      const url = 'https://www.linkedin.com/feed';
      const result = normalizeSocialUrl(url, 'linkedin');
      expect(result).toBeNull();
    });
  });

  it('should handle invalid URLs gracefully', () => {
    const url = 'not-a-valid-url';
    const result = normalizeSocialUrl(url, 'facebook');
    expect(result).toBeNull();
  });
});

describe('extractSocialMediaFromHtml', () => {
  it('should extract Facebook URLs from HTML', () => {
    const html = `
      <html>
        <body>
          <a href="https://www.facebook.com/MyBusiness">Facebook</a>
        </body>
      </html>
    `;
    const result = extractSocialMediaFromHtml(html);
    expect(result.facebookUrl).toBe('https://www.facebook.com/MyBusiness');
  });

  it('should extract Instagram URLs from HTML', () => {
    const html = `
      <html>
        <body>
          <a href="https://www.instagram.com/mybusiness">Instagram</a>
        </body>
      </html>
    `;
    const result = extractSocialMediaFromHtml(html);
    expect(result.instagramUrl).toBe('https://www.instagram.com/mybusiness');
  });

  it('should extract LinkedIn URLs from HTML', () => {
    const html = `
      <html>
        <body>
          <a href="https://www.linkedin.com/company/mybusiness">LinkedIn</a>
        </body>
      </html>
    `;
    const result = extractSocialMediaFromHtml(html);
    expect(result.linkedinUrl).toBe('https://www.linkedin.com/company/mybusiness');
  });

  it('should extract all social media URLs from HTML', () => {
    const html = `
      <html>
        <head>
          <meta property="og:url" content="https://www.facebook.com/MyBusiness" />
        </head>
        <body>
          <div>
            <a href="https://www.facebook.com/MyBusiness">Like us on Facebook</a>
            <a href="https://instagram.com/mybusiness">Follow us on Instagram</a>
            <a href="https://linkedin.com/company/mybusiness">Connect on LinkedIn</a>
          </div>
        </body>
      </html>
    `;
    const result = extractSocialMediaFromHtml(html);
    expect(result.facebookUrl).toBe('https://www.facebook.com/MyBusiness');
    expect(result.instagramUrl).toBe('https://www.instagram.com/mybusiness');
    expect(result.linkedinUrl).toBe('https://www.linkedin.com/company/mybusiness');
  });

  it('should handle URLs without protocol', () => {
    const html = `
      <html>
        <body>
          <a href="facebook.com/MyBusiness">Facebook</a>
        </body>
      </html>
    `;
    const result = extractSocialMediaFromHtml(html);
    expect(result.facebookUrl).toBe('https://www.facebook.com/MyBusiness');
  });

  it('should deduplicate multiple occurrences of the same URL', () => {
    const html = `
      <html>
        <body>
          <a href="https://www.facebook.com/MyBusiness">Facebook</a>
          <a href="https://www.facebook.com/MyBusiness">Facebook Again</a>
          <a href="https://www.facebook.com/MyBusiness?ref=footer">Facebook Footer</a>
        </body>
      </html>
    `;
    const result = extractSocialMediaFromHtml(html);
    expect(result.facebookUrl).toBe('https://www.facebook.com/MyBusiness');
  });

  it('should filter out generic Facebook pages', () => {
    const html = `
      <html>
        <body>
          <a href="https://www.facebook.com/home">Home</a>
          <a href="https://www.facebook.com/marketplace">Marketplace</a>
        </body>
      </html>
    `;
    const result = extractSocialMediaFromHtml(html);
    expect(result.facebookUrl).toBeUndefined();
  });

  it('should filter out generic Instagram pages', () => {
    const html = `
      <html>
        <body>
          <a href="https://www.instagram.com/explore">Explore</a>
        </body>
      </html>
    `;
    const result = extractSocialMediaFromHtml(html);
    expect(result.instagramUrl).toBeUndefined();
  });

  it('should return empty object when no social URLs found', () => {
    const html = `
      <html>
        <body>
          <p>No social media links here</p>
        </body>
      </html>
    `;
    const result = extractSocialMediaFromHtml(html);
    expect(result).toEqual({});
  });

  it('should handle fb.com short URLs', () => {
    const html = `
      <html>
        <body>
          <a href="https://fb.com/MyBusiness">Facebook</a>
        </body>
      </html>
    `;
    const result = extractSocialMediaFromHtml(html);
    expect(result.facebookUrl).toBe('https://www.facebook.com/MyBusiness');
  });
});

describe('scrapeSocialMediaFromWebsite', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should scrape social media URLs from a website', async () => {
    const mockHtml = `
      <html>
        <body>
          <a href="https://www.facebook.com/TestBusiness">Facebook</a>
          <a href="https://www.instagram.com/testbusiness">Instagram</a>
        </body>
      </html>
    `;

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'text/html']]),
      text: async () => mockHtml,
    } as unknown as Response);

    const result = await scrapeSocialMediaFromWebsite('https://example.com');
    
    expect(result.facebookUrl).toBe('https://www.facebook.com/TestBusiness');
    expect(result.instagramUrl).toBe('https://www.instagram.com/testbusiness');
    expect(result.foundUrls).toBe(2);
    expect(result.error).toBeUndefined();
  });

  it('should handle fetch errors gracefully', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const result = await scrapeSocialMediaFromWebsite('https://example.com');
    
    expect(result.foundUrls).toBe(0);
    expect(result.error).toBe('Network error');
  });

  it('should handle HTTP errors', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);

    const result = await scrapeSocialMediaFromWebsite('https://example.com');
    
    expect(result.foundUrls).toBe(0);
    expect(result.error).toBe('HTTP 404');
  });

  it('should handle non-HTML content', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
    } as unknown as Response);

    const result = await scrapeSocialMediaFromWebsite('https://example.com');
    
    expect(result.foundUrls).toBe(0);
    expect(result.error).toBe('Not an HTML page');
  });

  it('should return zero foundUrls when no social links present', async () => {
    const mockHtml = '<html><body><p>No social links</p></body></html>';

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'text/html']]),
      text: async () => mockHtml,
    } as unknown as Response);

    const result = await scrapeSocialMediaFromWebsite('https://example.com');
    
    expect(result.foundUrls).toBe(0);
    expect(result.error).toBeUndefined();
  });
});

describe('isSocialOnly', () => {
  it('should return false when website is working', () => {
    const result = isSocialOnly(true, {
      facebookUrl: 'https://www.facebook.com/MyBusiness',
    });
    expect(result).toBe(false);
  });

  it('should return true when no website but has Facebook', () => {
    const result = isSocialOnly(false, {
      facebookUrl: 'https://www.facebook.com/MyBusiness',
    });
    expect(result).toBe(true);
  });

  it('should return true when no website but has Instagram', () => {
    const result = isSocialOnly(false, {
      instagramUrl: 'https://www.instagram.com/mybusiness',
    });
    expect(result).toBe(true);
  });

  it('should return true when no website but has LinkedIn', () => {
    const result = isSocialOnly(false, {
      linkedinUrl: 'https://www.linkedin.com/company/mybusiness',
    });
    expect(result).toBe(true);
  });

  it('should return true when no website but has multiple social profiles', () => {
    const result = isSocialOnly(false, {
      facebookUrl: 'https://www.facebook.com/MyBusiness',
      instagramUrl: 'https://www.instagram.com/mybusiness',
      linkedinUrl: 'https://www.linkedin.com/company/mybusiness',
    });
    expect(result).toBe(true);
  });

  it('should return false when no website and no social profiles', () => {
    const result = isSocialOnly(false, {});
    expect(result).toBe(false);
  });
});
