'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import TopNav from '@/components/TopNav';
import { googleMapsPlaceUrl } from '@/lib/places/maps';
import ManualLeadForm from '@/components/ManualLeadForm';
import { formatGooglePlaceTypeLabel } from '@/lib/places/business-types';

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
  const [businessTypeFilter, setBusinessTypeFilter] = useState('');
  const [businessTypeOptions, setBusinessTypeOptions] = useState<string[]>([]);
  const [showConfirm, setShowConfirm] = useState<'approve' | 'reject' | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showManualForm, setShowManualForm] = useState(false);
  const [pageInput, setPageInput] = useState('1');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchLeads();
    }
  }, [status, page, sortBy, sortOrder, statusFilter, websiteStatusFilter, businessTypeFilter]);

  useEffect(() => {
    if (status !== 'authenticated') {
      return;
    }

    let isMounted = true;

    const fetchBusinessTypeOptions = async () => {
      try {
        const response = await fetch('/api/places/business-types', {
          cache: 'no-store',
        });
        if (!response.ok) {
          return;
        }

        const data: { businessTypes?: string[] } = await response.json();
        if (isMounted && Array.isArray(data.businessTypes)) {
          setBusinessTypeOptions(data.businessTypes);
          setBusinessTypeFilter((currentValue) => (
            currentValue && !data.businessTypes?.includes(currentValue) ? '' : currentValue
          ));
        }
      } catch {
        // Keep empty options when dynamic loading fails.
      }
    };

    void fetchBusinessTypeOptions();

    return () => {
      isMounted = false;
    };
  }, [status]);

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
      if (businessTypeFilter) params.append('businessType', businessTypeFilter);

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

  const goToPage = (targetPage: number) => {
    const boundedPage = Math.min(totalPages, Math.max(1, targetPage));
    setPage(boundedPage);
    setPageInput(boundedPage.toString());
  };

  const handlePageInputSubmit = () => {
    const parsedPage = Number.parseInt(pageInput, 10);
    if (Number.isNaN(parsedPage)) {
      setPageInput(page.toString());
      return;
    }

    goToPage(parsedPage);
  };

  const renderPaginationControls = () => (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="theme-text-muted text-sm">
        Showing page {page} of {totalPages}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => goToPage(1)}
          disabled={page === 1}
          aria-label="First page"
          title="First page"
          className="theme-border theme-text-muted inline-flex h-9 w-9 items-center justify-center rounded-lg border hover:bg-slate-100 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed dark:hover:bg-slate-900 dark:disabled:bg-slate-900 dark:disabled:text-slate-500"
        >
          <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 6l-6 6 6 6" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 6l-6 6 6 6" />
          </svg>
        </button>
        <button
          onClick={() => goToPage(page - 1)}
          disabled={page === 1}
          aria-label="Previous page"
          title="Previous page"
          className="theme-border theme-text-muted inline-flex h-9 w-9 items-center justify-center rounded-lg border hover:bg-slate-100 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed dark:hover:bg-slate-900 dark:disabled:bg-slate-900 dark:disabled:text-slate-500"
        >
          <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="theme-text-muted flex items-center gap-2 text-sm">
          <span>Page</span>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handlePageInputSubmit();
              }
            }}
            className="theme-input w-20 rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            aria-label="Go to page"
          />
          <span>of {totalPages}</span>
        </div>
        <button
          onClick={() => goToPage(page + 1)}
          disabled={page === totalPages}
          aria-label="Next page"
          title="Next page"
          className="theme-border theme-text-muted inline-flex h-9 w-9 items-center justify-center rounded-lg border hover:bg-slate-100 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed dark:hover:bg-slate-900 dark:disabled:bg-slate-900 dark:disabled:text-slate-500"
        >
          <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
          </svg>
        </button>
        <button
          onClick={() => goToPage(totalPages)}
          disabled={page === totalPages}
          aria-label="Last page"
          title="Last page"
          className="theme-border theme-text-muted inline-flex h-9 w-9 items-center justify-center rounded-lg border hover:bg-slate-100 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed dark:hover:bg-slate-900 dark:disabled:bg-slate-900 dark:disabled:text-slate-500"
        >
          <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 6l6 6-6 6" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </div>
  );

  useEffect(() => {
    setPageInput(page.toString());
  }, [page]);

  const hasResults = totalPages > 0;

  const getWebsiteStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      no_website: 'theme-badge-critical',
      social_only: 'theme-badge-warning',
      broken: 'theme-badge-critical',
      technical_issues: 'theme-badge-warning',
      outdated: 'theme-badge-warning',
      acceptable: 'theme-badge-success',
    };
    return (
      <span className={`inline-flex items-center rounded-md border border-white/10 px-2 py-1 text-xs font-medium ${colors[status] || colors.no_website}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <TopNav />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Review Queue</h1>
              <p className="theme-text-muted mt-1 text-sm">
                Approve or reject leads and manage the pipeline
              </p>
            </div>
            <button
              onClick={() => setShowManualForm(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              + Create Manual Lead
            </button>
          </div>
        </div>

      {/* Filters and Controls */}
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="theme-text-muted block text-sm font-medium mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="theme-input rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="contacted">Contacted</option>
            <option value="responded">Responded</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div>
          <label className="theme-text-muted block text-sm font-medium mb-1">Website Status</label>
          <select
            value={websiteStatusFilter}
            onChange={(e) => {
              setWebsiteStatusFilter(e.target.value);
              setPage(1);
            }}
            className="theme-input rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="">All</option>
            <option value="no_website">No Website</option>
            <option value="social_only">Social Only</option>
            <option value="broken">Broken</option>
            <option value="technical_issues">Technical Issues</option>
            <option value="outdated">Outdated</option>
            <option value="acceptable">Acceptable</option>
          </select>
        </div>

        <div>
          <label className="theme-text-muted block text-sm font-medium mb-1">Business Type</label>
          <select
            value={businessTypeFilter}
            onChange={(e) => {
              setBusinessTypeFilter(e.target.value);
              setPage(1);
            }}
            className="theme-input rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="">All</option>
            {businessTypeOptions.map((businessType) => (
              <option key={businessType} value={businessType}>
                {formatGooglePlaceTypeLabel(businessType)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="theme-text-muted block text-sm font-medium mb-1">Sort By</label>
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setPage(1);
            }}
            className="theme-input rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="priority">Priority (VIP first)</option>
            <option value="name">Name</option>
            <option value="score">Score</option>
            <option value="discoveredAt">Discovered Date</option>
          </select>
        </div>

        <div>
          <label className="theme-text-muted block text-sm font-medium mb-1">Sort Order</label>
          <select
            value={sortOrder}
            onChange={(e) => {
              setSortOrder(e.target.value as 'asc' | 'desc');
              setPage(1);
            }}
            className="theme-input rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>

        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setSelectedIds(new Set())}
            disabled={selectedIds.size === 0}
            className="theme-border theme-text-muted rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-slate-100 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed dark:hover:bg-slate-900 dark:disabled:bg-slate-900 dark:disabled:text-slate-500"
          >
            Deselect All
          </button>
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
          <div className="theme-surface theme-border w-full max-w-md rounded-lg border p-6 shadow-xl">
            <h2 className="text-xl font-bold mb-4">
              Confirm {showConfirm === 'approve' ? 'Approval' : 'Rejection'}
            </h2>
            <p className="mb-4">
              Are you sure you want to {showConfirm} {selectedIds.size} lead(s)?
            </p>
            {showConfirm === 'reject' && (
              <div className="mb-4">
                <label className="theme-text-muted block text-sm font-medium mb-1">Reason (optional)</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="theme-input w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
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
                className="theme-border theme-text-muted rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-900"
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

      {/* Manual Lead Form Modal */}
      {showManualForm && (
        <ManualLeadForm
          onClose={() => setShowManualForm(false)}
          onSuccess={() => {
            setShowManualForm(false);
            fetchLeads();
          }}
        />
      )}

      {hasResults ? (
        <>
          {/* Table */}
          <div className="mb-4">
            {renderPaginationControls()}
          </div>

          <div className="theme-surface theme-border overflow-x-auto rounded-2xl border shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="theme-surface-muted theme-text-muted">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={leads.length > 0 && leads.every((lead) => selectedIds.has(lead.id))}
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
              <tbody className="theme-border divide-y">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(lead.id)}
                        onChange={(e) => handleSelectOne(lead.id, e.target.checked)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`/leads/${lead.id}`}
                        className="text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {lead.name}
                      </a>
                    </td>
                    <td className="theme-text-muted px-4 py-3">{lead.address}</td>
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
                        <span className="theme-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{getWebsiteStatusBadge(lead.websiteStatus)}</td>
                    <td className="px-4 py-3">{lead.smallBusinessScore || 'N/A'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {lead.hasEmail && <span className="theme-badge-info inline-flex items-center rounded-md border border-white/10 px-2 py-1 text-xs font-medium">✉️</span>}
                        {lead.hasPhone && <span className="theme-badge-success inline-flex items-center rounded-md border border-white/10 px-2 py-1 text-xs font-medium">📞</span>}
                        {lead.hasSocial && <span className="theme-badge-accent inline-flex items-center rounded-md border border-white/10 px-2 py-1 text-xs font-medium">📱</span>}
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
          <div className="mt-6">
            {renderPaginationControls()}
          </div>
        </>
      ) : (
        <div className="theme-surface theme-border rounded-2xl border p-10 text-center shadow-sm">
          <h2 className="text-lg font-semibold">No results</h2>
          <p className="theme-text-muted mt-2 text-sm">
            No leads match the selected filters.
          </p>
        </div>
      )}
      </main>
    </div>
  );
}
