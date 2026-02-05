'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import TopNav from '@/components/TopNav';

type Client = {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  website: string | null;
  websiteStatus: string;
  subscriptionStatus: string | null;
  clientStatus: string | null;
  initialPaymentStatus: string | null;
  nextPaymentDueDate: string | null;
  convertedAt: string;
  notesCount: number;
  needsAttention: boolean;
  contactInfo: Array<{
    email: string | null;
    phone: string | null;
  }>;
  lastContact: {
    occurredAt: string;
    channel: string;
  } | null;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export default function ActiveClientsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // Filters
  const [subscriptionStatusFilter, setSubscriptionStatusFilter] = useState('');
  const [clientStatusFilter, setClientStatusFilter] = useState('');
  const [needsAttentionFilter, setNeedsAttentionFilter] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'convertedAt' | 'nextPaymentDueDate' | 'updatedAt'>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchClients();
    }
  }, [status, pagination.page, subscriptionStatusFilter, clientStatusFilter, needsAttentionFilter, sortBy, sortOrder]);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sortBy,
        sortOrder,
      });

      if (subscriptionStatusFilter) {
        params.append('subscriptionStatus', subscriptionStatusFilter);
      }

      if (clientStatusFilter) {
        params.append('clientStatus', clientStatusFilter);
      }

      if (needsAttentionFilter) {
        params.append('needsAttention', 'true');
      }

      const response = await fetch(`/api/clients?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch clients');

      const data = await response.json();
      setClients(data.clients);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusBadge = (status: string | null, type: 'subscription' | 'client' | 'payment') => {
    if (!status) return <span className="text-gray-400">Unknown</span>;

    const colors = {
      subscription: {
        active: 'bg-green-100 text-green-800',
        trial: 'bg-blue-100 text-blue-800',
        past_due: 'bg-red-100 text-red-800',
        canceled: 'bg-gray-100 text-gray-800',
        payment_failed: 'bg-red-100 text-red-800',
        unpaid: 'bg-orange-100 text-orange-800',
      },
      client: {
        active: 'bg-green-100 text-green-800',
        onboarding: 'bg-blue-100 text-blue-800',
        needs_review: 'bg-yellow-100 text-yellow-800',
        inactive: 'bg-gray-100 text-gray-800',
      },
      payment: {
        confirmed: 'bg-green-100 text-green-800',
        pending: 'bg-yellow-100 text-yellow-800',
        failed: 'bg-red-100 text-red-800',
      },
    };

    const colorClass = colors[type][status as keyof typeof colors[typeof type]] || 'bg-gray-100 text-gray-800';

    return (
      <span className={`px-2 py-1 rounded text-xs ${colorClass}`}>
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopNav />
        <div className="flex justify-center items-center h-64">
          <p className="text-gray-500">Loading clients...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Active Clients</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage your active clients and track subscription status
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subscription Status
              </label>
              <select
                value={subscriptionStatusFilter}
                onChange={(e) => {
                  setSubscriptionStatusFilter(e.target.value);
                  setPagination({ ...pagination, page: 1 });
                }}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="past_due">Past Due</option>
                <option value="payment_failed">Payment Failed</option>
                <option value="unpaid">Unpaid</option>
                <option value="canceled">Canceled</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client Status
              </label>
              <select
                value={clientStatusFilter}
                onChange={(e) => {
                  setClientStatusFilter(e.target.value);
                  setPagination({ ...pagination, page: 1 });
                }}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="onboarding">Onboarding</option>
                <option value="needs_review">Needs Review</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="updatedAt">Recently Updated</option>
                <option value="convertedAt">Conversion Date</option>
                <option value="nextPaymentDueDate">Payment Due Date</option>
                <option value="name">Name</option>
              </select>
            </div>

            <div className="flex items-end">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={needsAttentionFilter}
                  onChange={(e) => {
                    setNeedsAttentionFilter(e.target.checked);
                    setPagination({ ...pagination, page: 1 });
                  }}
                  className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <span className="text-sm font-medium text-gray-700">Needs Attention</span>
              </label>
            </div>
          </div>
        </div>

        {/* Clients List */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {clients.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No clients found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Subscription
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Client Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment Due
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {clients.map((client) => (
                    <tr key={client.id} className={client.needsAttention ? 'bg-red-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="flex items-center">
                            <div className="text-sm font-medium text-gray-900">
                              {client.name}
                            </div>
                            {client.needsAttention && (
                              <span className="ml-2 px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
                                ⚠️
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">{client.address}</div>
                          {client.notesCount > 0 && (
                            <div className="text-xs text-gray-400">📝 Has notes</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>
                          {client.contactInfo[0]?.email && (
                            <div>✉️ {client.contactInfo[0].email}</div>
                          )}
                          {client.phone && <div>📞 {client.phone}</div>}
                          {client.website && (
                            <div className="text-xs">
                              <a 
                                href={client.website} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                Website
                              </a>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(client.subscriptionStatus, 'subscription')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(client.clientStatus, 'client')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(client.nextPaymentDueDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => router.push(`/clients/${client.id}`)}
                          className="text-blue-600 hover:text-blue-900 font-medium"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="mt-6 flex justify-between items-center">
            <div className="text-sm text-gray-700">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
              {pagination.total} clients
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                disabled={pagination.page === 1}
                className="px-4 py-2 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                disabled={pagination.page >= pagination.totalPages}
                className="px-4 py-2 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
