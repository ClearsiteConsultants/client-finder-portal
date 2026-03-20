const AUTH_FAILURE_MESSAGE =
  "Database login failed. Check the username/password in your local DATABASE_URL environment variable (.env.local).";

const AUTH_FAILURE_PATTERNS: RegExp[] = [
  /28p01/i,
  /p1000/i,
  /password authentication failed/i,
  /authentication failed/i,
  /invalid\s+`?prisma\.\$queryraw\(\)`?\s+invocation/i,
];

function getMessageFromUnknown(error: unknown): string {
  if (error instanceof Error && typeof error.message === "string" && error.message) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return "Connection failed";
}

function getErrorSearchText(error: unknown, message: string): string {
  if (typeof error !== "object" || error === null) {
    return message;
  }

  try {
    return `${message} ${JSON.stringify(error)}`;
  } catch {
    return message;
  }
}

export function getDatabaseHealthMessage(error: unknown): string {
  const message = getMessageFromUnknown(error);
  const searchableText = getErrorSearchText(error, message);
  const authFailed = AUTH_FAILURE_PATTERNS.some((pattern) => pattern.test(searchableText));

  if (authFailed) {
    return AUTH_FAILURE_MESSAGE;
  }

  return message;
}