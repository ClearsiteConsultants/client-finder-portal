import { getDatabaseHealthMessage } from "./error-message";

describe("getDatabaseHealthMessage", () => {
  const expectedAuthMessage =
    "Database login failed. Check the username/password in your local DATABASE_URL environment variable (.env.local).";

  it("returns helpful message for Postgres 28P01 auth failures", () => {
    const error = new Error(
      'Raw query failed. Code: `28P01`. Message: `password authentication failed for user "postgres"`',
    );

    expect(getDatabaseHealthMessage(error)).toBe(expectedAuthMessage);
  });

  it("returns helpful message for password authentication failed text", () => {
    const error = new Error("password authentication failed for user \"postgres\"");

    expect(getDatabaseHealthMessage(error)).toBe(expectedAuthMessage);
  });

  it("returns helpful message for Prisma P1000 auth failures", () => {
    const error = new Error("Prisma error P1000: Authentication failed");

    expect(getDatabaseHealthMessage(error)).toBe(expectedAuthMessage);
  });

  it("returns helpful message for lower-case auth code variants", () => {
    const error = new Error("raw query failed with code 28p01");

    expect(getDatabaseHealthMessage(error)).toBe(expectedAuthMessage);
  });

  it("returns helpful message when auth failure appears in structured error fields", () => {
    const error = {
      code: "28P01",
      detail: "password authentication failed for user \"postgres\"",
    };

    expect(getDatabaseHealthMessage(error)).toBe(expectedAuthMessage);
  });

  it("returns original message for non-auth errors", () => {
    const error = new Error("connect ECONNREFUSED 127.0.0.1:5432");

    expect(getDatabaseHealthMessage(error)).toBe(
      "connect ECONNREFUSED 127.0.0.1:5432",
    );
  });

  it("falls back to connection failed for unknown error values", () => {
    expect(getDatabaseHealthMessage(null)).toBe("Connection failed");
  });
});