'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import TopNav from '@/components/TopNav';

type ExcludedBusiness = {
  id: string;
  businessName: string;
  reason: string | null;
  addedBy: string;
  createdAt: string;
};

export default function ExclusionsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [excluded, setExcluded] = useState<ExcludedBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newBusinessName, setNewBusinessName] = useState('');
  const [newReason, setNewReason] = useState('');
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

  useEffect(() => {
    if (status === 'authenticated') {
      fetchExcluded();
    }
  }, [status]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBusinessName.trim()) return;

    try {
      setAdding(true);
      setError(null);
      const response = await fetch('/api/exclusions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: newBusinessName.trim(),
          reason: newReason.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add business');
      }

      setNewBusinessName('');
      setNewReason('');
      await fetchExcluded();
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
          <p className="text-gray-600">Loading...</p>
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
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Add Business to Exclude List</h2>
          <p className="text-gray-600 mb-4">
            Excluded businesses will be automatically rejected during discovery and will not appear in the review queue.
          </p>
          
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label htmlFor="businessName" className="block text-sm font-medium text-gray-700 mb-1">
                Business Name *
              </label>
              <input
                id="businessName"
                type="text"
                value={newBusinessName}
                onChange={(e) => setNewBusinessName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Starbucks"
                required
              />
            </div>

            <div>
              <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
                Reason (optional)
              </label>
              <input
                id="reason"
                type="text"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Too large, Already a customer"
              />
            </div>

            <button
              type="submit"
              disabled={adding || !newBusinessName.trim()}
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

        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold">Excluded Businesses ({excluded.length})</h2>
          </div>
          
          {excluded.length === 0 ? (
            <div className="p-6 text-gray-500 text-center">
              No businesses excluded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Business Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reason
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Added By
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Added At
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {excluded.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                        {item.businessName}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {item.reason || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                        {item.addedBy}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">
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
