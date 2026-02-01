"use client";

import { useEffect, useState } from "react";

type HealthStatus = {
  database: {
    status: "healthy" | "unhealthy" | "unknown";
    message: string;
  };
  timestamp: string;
};

export default function HealthStatus({
  isAuthenticated,
}: {
  isAuthenticated: boolean;
}) {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const response = await fetch("/api/health");
        const data = await response.json();
        setHealth(data);
      } catch {
        setHealth({
          database: {
            status: "unhealthy",
            message: "Unable to reach health endpoint",
          },
          timestamp: new Date().toISOString(),
        });
      } finally {
        setLoading(false);
      }
    };

    fetchHealth();
    // Refresh every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">
            System health
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Auto-refreshes
          </span>
        </div>
        <div className="mt-4 flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
          <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400" aria-hidden="true" />
          Checking status...
        </div>
      </div>
    );
  }

  const databaseIsHealthy = health?.database.status === "healthy";

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">
          System health
        </h3>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Refreshes every 30s
        </span>
      </div>

      <div className="mt-5 divide-y divide-slate-200/70 text-sm dark:divide-slate-800">
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                databaseIsHealthy ? "bg-emerald-500" : "bg-rose-500"
              }`}
              aria-hidden="true"
            />
            <span className="font-medium text-slate-700 dark:text-slate-200">
              Database
            </span>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              databaseIsHealthy
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "bg-rose-500/10 text-rose-700 dark:text-rose-300"
            }`}
          >
            {health?.database.message || "Unknown"}
          </span>
        </div>

        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isAuthenticated ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
              }`}
              aria-hidden="true"
            />
            <span className="font-medium text-slate-700 dark:text-slate-200">
              Authentication
            </span>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              isAuthenticated
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "bg-slate-500/10 text-slate-700 dark:text-slate-300"
            }`}
          >
            {isAuthenticated ? "Signed in" : "Not signed in"}
          </span>
        </div>
      </div>

      {health?.timestamp && (
        <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          Last checked: {new Date(health.timestamp).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
