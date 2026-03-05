import '@testing-library/jest-dom';
import dotenv from 'dotenv';
import fetch, { Headers, Request, Response } from 'node-fetch';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Add TextEncoder/TextDecoder polyfills for Node.js environment
import { TextEncoder, TextDecoder } from 'util';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as typeof global.TextDecoder;

// Add fetch polyfill for Node.js test environment
if (typeof global.fetch === 'undefined') {
  (global as any).fetch = fetch;
  (global as any).Headers = Headers;
  (global as any).Request = Request;
  (global as any).Response = Response;
}

if (typeof (global as any).Response !== 'undefined' && typeof (global as any).Response.json !== 'function') {
  (global as any).Response.json = (data: unknown, init?: ResponseInit) => {
    const existingHeaders = (init?.headers || {}) as Record<string, string>;
    return new (global as any).Response(JSON.stringify(data), {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...existingHeaders,
      },
    });
  };
}

// Set up test database URL
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST || 'postgresql://postgres:postgres@localhost:5432/quizmaster_test';
}
