'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import TopNav from '@/components/TopNav';
import { googleMapsPlaceUrl } from '@/lib/places/maps';

type Lead = {
  id: string;
  placeId: string | null;
  name: string;
  address: string;
  phone: string | null;
  website: string | null;
  websiteStatus: string;
  leadStatus: string;
  smallBusinessScore: number | null;
  discoveredAt: string;
  hasEmail: boolean;
  hasPhone: boolean;
  hasSocial: boolean;
  rating: number | null;
  reviewCount: number | null;
};

type QueueResponse = {
  leads: Lead[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export default function ReviewQueuePage() {
  const { status } = useSession();
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState('priority');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [websiteStatusFilter, setWebsiteStatusFilter] = useState('');
  const [showConfirm, setShowConfirm] = useState<'approve' | 'reject' | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchLeads();
    }
  }, [status, page, sortBy, sortOrder, statusFilter, websiteStatusFilter]);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '50',
        sortBy,
        sortOrder,
      });
      
      if (statusFilter) params.append('status', statusFilter);
      if (websiteStatusFilter) params.append('websiteStatus', websiteStatusFilter);

      const response = await fetch(`/api/leads/queue?${params}`);
      if (response.ok) {
        const data: QueueResponse = await response.json();
        setLeads(data.leads);
        setTotalPages(data.totalPages);
      }
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(leads.map(l => l.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleApprove = async () => {
    if (selectedIds.size === 0) return;
    
    try {
      const response = await fetch('/api/leads/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessIds: Array.from(selectedIds) }),
      });

      if (response.ok) {
        setSelectedIds(new Set());
        setShowConfirm(null);
        fetchLeads();
      }
    } catch (error) {
      console.error('Error approving leads:', error);
    }
  };

  const handleReject = async () => {
    if (selectedIds.size === 0) return;
    
    try {
      const response = await fetch('/api/leads/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          businessIds: Array.from(selectedIds),
          reason: rejectReason || null,
        }),
      });

      if (response.ok) {
        setSelectedIds(new Set());
        setShowConfirm(null);
        setRejectReason('');
        fetchLeads();
      }
    } catch (error) {
      console.error('Error rejecting leads:', error);
    }
  };

  const getWebsiteStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      no_website: 'bg-red-100 text-red-800',
      social_only: 'bg-orange-100 text-orange-800',
      broken: 'bg-red-100 text-red-800',
      technical_issues: 'bg-yellow-100 text-yellow-800',
      outdated: 'bg-yellow-100 text-yellow-800',
      acceptable: 'bg-green-100 text-green-800',
      unknown: 'bg-gray-100 text-gray-800',
    };
    return (
      <span className={`px-2 py-1 text-xs rounded ${colors[status] || colors.unknown}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-50">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-50">
      <TopNav />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Review Queue</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Approve or reject leads and manage the pipeline
          </p>
        </div>

      {/* Filters and Controls */}
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Website Status</label>
          <select
            value={websiteStatusFilter}
            onChange={(e) => setWebsiteStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
          >
            <option value="">All</option>
            <option value="no_website">No Website</option>
            <option value="social_only">Social Only</option>
            <option value="broken">Broken</option>
            <option value="outdated">Outdated</option>
            <option value="acceptable">Acceptable</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Sort By</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
          >
            <option value="priority">Priority (VIP first)</option>
            <option value="name">Name</option>
            <option value="score">Score</option>
            <option value="discoveredAt">Discovered Date</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Sort Order</label>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>

        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setShowConfirm('approve')}
            disabled={selectedIds.size === 0}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700 disabled:bg-slate-300 disabled:text-slate-600 disabled:cursor-not-allowed dark:disabled:bg-slate-700 dark:disabled:text-slate-300"
          >
            Approve ({selectedIds.size})
          </button>
          <button
            onClick={() => setShowConfirm('reject')}
            disabled={selectedIds.size === 0}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:bg-slate-300 disabled:text-slate-600 disabled:cursor-not-allowed dark:disabled:bg-slate-700 dark:disabled:text-slate-300"
          >
            Reject ({selectedIds.size})
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 text-slate-900 shadow-xl dark:bg-slate-950 dark:text-slate-50">
            <h2 className="text-xl font-bold mb-4">
              Confirm {showConfirm === 'approve' ? 'Approval' : 'Rejection'}
            </h2>
            <p className="mb-4">
              Are you sure you want to {showConfirm} {selectedIds.size} lead(s)?
            </p>
            {showConfirm === 'reject' && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-200">Reason (optional)</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                  rows={3}
                  placeholder="Enter reason for rejection..."
                />
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowConfirm(null);
                  setRejectReason('');
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-900"
              >
                Cancel
              </button>
              <button
                onClick={showConfirm === 'approve' ? handleApprove : handleReject}
                className={`px-4 py-2 rounded text-white ${
                  showConfirm === 'approve' 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedIds.size === leads.length && leads.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                />
              </th>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Address</th>
              <th className="px-4 py-3 text-left font-medium">Maps</th>
              <th className="px-4 py-3 text-left font-medium">Website Status</th>
              <th className="px-4 py-3 text-left font-medium">Score</th>
              <th className="px-4 py-3 text-left font-medium">Contact</th>
              <th className="px-4 py-3 text-left font-medium">Rating</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-900 dark:divide-slate-800 dark:text-slate-50">
            {leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(lead.id)}
                    onChange={(e) => handleSelectOne(lead.id, e.target.checked)}
                  />
                </td>
                <td className="px-4 py-3">{lead.name}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{lead.address}</td>
                <td className="px-4 py-3">
                  {lead.placeId ? (
                    <a
                      href={googleMapsPlaceUrl(lead.placeId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      View
                    </a>
                  ) : (
                    <span className="text-slate-500 dark:text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3">{getWebsiteStatusBadge(lead.websiteStatus)}</td>
                <td className="px-4 py-3">{lead.smallBusinessScore || 'N/A'}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {lead.hasEmail && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">✉️</span>}
                    {lead.hasPhone && <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">📞</span>}
                    {lead.hasSocial && <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">📱</span>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {lead.rating ? `⭐ ${lead.rating.toFixed(1)} (${lead.reviewCount})` : 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-6 flex justify-between items-center">
        <div className="text-sm text-slate-600 dark:text-slate-300">
          Showing page {page} of {totalPages}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed dark:border-slate-700 dark:hover:bg-slate-900 dark:disabled:bg-slate-900 dark:disabled:text-slate-500"
          >
            Previous
          </button>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed dark:border-slate-700 dark:hover:bg-slate-900 dark:disabled:bg-slate-900 dark:disabled:text-slate-500"
          >
            Next
          </button>
        </div>
      </div>
      </main>
    </div>
  );
}
