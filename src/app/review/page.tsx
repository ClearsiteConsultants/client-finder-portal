'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

type Lead = {
  id: string;
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
  const { data: session, status } = useSession();
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
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Review Queue</h1>

      {/* Filters and Controls */}
      <div className="mb-6 flex flex-wrap gap-4 items-center">
        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Website Status</label>
          <select
            value={websiteStatusFilter}
            onChange={(e) => setWebsiteStatusFilter(e.target.value)}
            className="border rounded px-3 py-2"
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
          <label className="block text-sm font-medium mb-1">Sort By</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="priority">Priority (VIP first)</option>
            <option value="name">Name</option>
            <option value="score">Score</option>
            <option value="discoveredAt">Discovered Date</option>
          </select>
        </div>

        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setShowConfirm('approve')}
            disabled={selectedIds.size === 0}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Approve ({selectedIds.size})
          </button>
          <button
            onClick={() => setShowConfirm('reject')}
            disabled={selectedIds.size === 0}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Reject ({selectedIds.size})
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">
              Confirm {showConfirm === 'approve' ? 'Approval' : 'Rejection'}
            </h2>
            <p className="mb-4">
              Are you sure you want to {showConfirm} {selectedIds.size} lead(s)?
            </p>
            {showConfirm === 'reject' && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Reason (optional)</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full border rounded px-3 py-2"
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
                className="px-4 py-2 border rounded hover:bg-gray-100"
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
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full">
          <thead className="bg-gray-50">
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
              <th className="px-4 py-3 text-left font-medium">Website Status</th>
              <th className="px-4 py-3 text-left font-medium">Score</th>
              <th className="px-4 py-3 text-left font-medium">Contact</th>
              <th className="px-4 py-3 text-left font-medium">Rating</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(lead.id)}
                    onChange={(e) => handleSelectOne(lead.id, e.target.checked)}
                  />
                </td>
                <td className="px-4 py-3">{lead.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{lead.address}</td>
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
        <div className="text-sm text-gray-600">
          Showing page {page} of {totalPages}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 border rounded hover:bg-gray-100 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 border rounded hover:bg-gray-100 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
