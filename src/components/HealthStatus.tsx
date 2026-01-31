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
      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">System Health</h3>
        <div className="text-sm text-gray-500">Checking status...</div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
      <h3 className="text-lg font-semibold mb-4">System Health</h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Database</span>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                health?.database.status === "healthy"
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {health?.database.status === "healthy" ? "✓ " : "✗ "}
              {health?.database.message || "Unknown"}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Authentication</span>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                isAuthenticated
                  ? "bg-green-100 text-green-800"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {isAuthenticated ? "✓ Signed In" : "Not Signed In"}
            </span>
          </div>
        </div>
        {health?.timestamp && (
          <div className="text-xs text-gray-500 pt-2 border-t">
            Last checked: {new Date(health.timestamp).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}
