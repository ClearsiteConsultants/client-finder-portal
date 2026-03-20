'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import TopNav from '@/components/TopNav';
import {
  formatGooglePlaceTypeLabel,
} from '@/lib/places/business-types';
import { notifyBusinessTypeOptionsUpdated } from '@/lib/places/business-type-sync';

type ExcludedBusiness = {
  id: string;
  businessName: string;
  exclusionMode: 'business_name' | 'business_type';
  businessType: string | null;
  reason: string | null;
  addedBy: string;
  createdAt: string;
};

type ExclusionMode = 'business_name' | 'business_type';

export default function ExclusionsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [excluded, setExcluded] = useState<ExcludedBusiness[]>([]);
  const [businessTypeOptions, setBusinessTypeOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newBusinessName, setNewBusinessName] = useState('');
  const [newBusinessType, setNewBusinessType] = useState('');
  const [newReason, setNewReason] = useState('');
  const [newExclusionMode, setNewExclusionMode] = useState<ExclusionMode>('business_name');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  const fetchExcluded = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/exclusions');
      if (!response.ok) {
        throw new Error('Failed to fetch excluded businesses');
      }
      const data = await response.json();
      setExcluded(data.excluded);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchBusinessTypeOptions = async () => {
    try {
      const response = await fetch('/api/places/business-types?forSearch=true', {
        cache: 'no-store',
      });
      if (!response.ok) {
        return;
      }

      const data: { businessTypes?: string[] } = await response.json();
      if (Array.isArray(data.businessTypes)) {
        setBusinessTypeOptions(data.businessTypes);
        setNewBusinessType((currentValue) => (
          currentValue && !data.businessTypes?.includes(currentValue) ? '' : currentValue
        ));
      }
    } catch {
      // Keep the last loaded options when dynamic loading fails.
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      fetchExcluded();
    }
  }, [status]);

  useEffect(() => {
    if (status !== 'authenticated') {
      return;
    }

    void fetchBusinessTypeOptions();
  }, [status]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasName = newBusinessName.trim().length > 0;
    const hasType = newBusinessType.trim().length > 0;

    if (newExclusionMode === 'business_name' && !hasName) return;
    if (newExclusionMode === 'business_type' && !hasType) return;

    try {
      setAdding(true);
      setError(null);
      const response = await fetch('/api/exclusions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: newExclusionMode === 'business_name' ? newBusinessName.trim() : undefined,
          businessType: newExclusionMode === 'business_type' ? newBusinessType.trim() : undefined,
          reason: newReason.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add business');
      }

      if (newExclusionMode === 'business_type') {
        notifyBusinessTypeOptionsUpdated();
      }

      setNewBusinessName('');
      setNewBusinessType('');
      setNewReason('');
      await Promise.all([fetchExcluded(), fetchBusinessTypeOptions()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add business');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm('Remove this business from the exclude list?')) return;

    try {
      setError(null);
      const response = await fetch('/api/exclusions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ excludedBusinessId: id }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove business');
      }

      await fetchExcluded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove business');
    }
  };

  if (status === 'loading' || loading) {
    return (
      <>
        <TopNav />
        <div className="container mx-auto px-4 py-8">
          <p className="theme-text-muted">Loading...</p>
        </div>
      </>
    );
  }

  if (status !== 'authenticated') {
    return null;
  }

  return (
    <>
      <TopNav />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Business Exclude List</h1>
        
        <div className="theme-surface rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Add Business to Exclude List</h2>
          <p className="theme-text-muted mb-4">
            Excluded businesses will be automatically rejected during discovery and will not appear in the review queue.
          </p>
          
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label htmlFor="exclusionMode" className="theme-text-muted block text-sm font-medium mb-1">
                Exclusion Type
              </label>
              <select
                id="exclusionMode"
                value={newExclusionMode}
                onChange={(e) => setNewExclusionMode(e.target.value as ExclusionMode)}
                className="theme-input w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="business_name">Business Name</option>
                <option value="business_type">Business Type</option>
              </select>
            </div>

            <div>
              <label htmlFor="businessName" className="theme-text-muted block text-sm font-medium mb-1">
                {newExclusionMode === 'business_name' ? 'Business Name *' : 'Business Type *'}
              </label>
              {newExclusionMode === 'business_name' ? (
                <input
                  id="businessName"
                  type="text"
                  value={newBusinessName}
                  onChange={(e) => setNewBusinessName(e.target.value)}
                  className="theme-input w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Starbucks"
                  required
                />
              ) : (
                <select
                  id="businessType"
                  value={newBusinessType}
                  onChange={(e) => setNewBusinessType(e.target.value)}
                  className="theme-input w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select a business type</option>
                  {businessTypeOptions.map((businessType) => (
                    <option key={businessType} value={businessType}>
                      {formatGooglePlaceTypeLabel(businessType)}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label htmlFor="reason" className="theme-text-muted block text-sm font-medium mb-1">
                Reason (optional)
              </label>
              <input
                id="reason"
                type="text"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                className="theme-input w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Too large, Already a customer"
              />
            </div>

            <button
              type="submit"
              disabled={
                adding ||
                (newExclusionMode === 'business_name' ? !newBusinessName.trim() : !newBusinessType.trim())
              }
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {adding ? 'Adding...' : 'Add to Exclude List'}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="theme-surface rounded-lg shadow">
          <div className="p-6 border-b theme-border">
            <h2 className="text-xl font-semibold">Excluded Businesses ({excluded.length})</h2>
          </div>
          
          {excluded.length === 0 ? (
            <div className="p-6 theme-text-muted text-center">
              No businesses excluded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="theme-surface-muted theme-text-muted">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Exclusion
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Reason
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Added By
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Added At
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="theme-surface divide-y theme-border">
                  {excluded.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 whitespace-nowrap font-medium">
                        {item.exclusionMode === 'business_type' && item.businessType
                          ? formatGooglePlaceTypeLabel(item.businessType)
                          : item.businessName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap theme-text-muted">
                        {item.exclusionMode === 'business_type' ? 'Business Type' : 'Business Name'}
                      </td>
                      <td className="px-6 py-4 theme-text-muted">
                        {item.reason || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap theme-text-muted">
                        {item.addedBy}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap theme-text-muted">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleRemove(item.id)}
                          className="text-red-600 hover:text-red-800 font-medium"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
