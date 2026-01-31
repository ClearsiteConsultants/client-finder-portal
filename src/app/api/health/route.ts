import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const checks = {
    timestamp: new Date().toISOString(),
    database: {
      status: "unknown" as "healthy" | "unhealthy" | "unknown",
      message: "",
    },
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database.status = "healthy";
    checks.database.message = "Connected";
  } catch (error) {
    checks.database.status = "unhealthy";
    checks.database.message =
      error instanceof Error ? error.message : "Connection failed";
  }

  const isHealthy = checks.database.status === "healthy";

  return NextResponse.json(checks, {
    status: isHealthy ? 200 : 503,
  });
}
