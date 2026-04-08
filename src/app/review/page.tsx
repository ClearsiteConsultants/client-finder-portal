'use client';

import { useState, useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import TopNav from '@/components/TopNav';
import { googleMapsPlaceUrl } from '@/lib/places/maps';
import ManualLeadForm from '@/components/ManualLeadForm';
import { formatGooglePlaceTypeLabel } from '@/lib/places/business-types';

const WEBSITE_STATUS_OPTIONS = [
  'no_website',
  'social_only',
  'broken',
  'technical_issues',
  'outdated',
  'acceptable',
] as const;

const WEBSITE_STATUS_LABELS: Record<(typeof WEBSITE_STATUS_OPTIONS)[number], string> = {
  no_website: 'No Website',
  social_only: 'Social Only',
  broken: 'Broken',
  technical_issues: 'Technical Issues',
  outdated: 'Outdated',
  acceptable: 'Acceptable',
};

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
  const [websiteStatusFilters, setWebsiteStatusFilters] = useState<string[]>([]);
  const [allWebsiteStatusesChecked, setAllWebsiteStatusesChecked] = useState(true);
  const [isWebsiteStatusDropdownOpen, setIsWebsiteStatusDropdownOpen] = useState(false);
  const [businessTypeFilters, setBusinessTypeFilters] = useState<string[]>([]);
  const [businessTypeOptions, setBusinessTypeOptions] = useState<string[]>([]);
  const [allBusinessTypesChecked, setAllBusinessTypesChecked] = useState(true);
  const [isBusinessTypeDropdownOpen, setIsBusinessTypeDropdownOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState<'approve' | 'reject' | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showManualForm, setShowManualForm] = useState(false);
  const [pageInput, setPageInput] = useState('1');
  const websiteStatusDropdownRef = useRef<HTMLDivElement | null>(null);
  const websiteStatusToggleButtonRef = useRef<HTMLButtonElement | null>(null);
  const businessTypeDropdownRef = useRef<HTMLDivElement | null>(null);
  const businessTypeToggleButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchLeads();
    }
  }, [status, page, sortBy, sortOrder, statusFilter, websiteStatusFilters, businessTypeFilters]);

  useEffect(() => {
    if (allWebsiteStatusesChecked) {
      setWebsiteStatusFilters([...WEBSITE_STATUS_OPTIONS]);
      return;
    }

    setWebsiteStatusFilters((currentValues) =>
      currentValues.filter((status) => WEBSITE_STATUS_OPTIONS.includes(status as (typeof WEBSITE_STATUS_OPTIONS)[number]))
    );
  }, [allWebsiteStatusesChecked]);

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
          setBusinessTypeFilters((currentValues) =>
            currentValues.filter((value) => data.businessTypes?.includes(value))
          );
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

  useEffect(() => {
    if (allBusinessTypesChecked) {
      setBusinessTypeFilters([...businessTypeOptions]);
      return;
    }

    setBusinessTypeFilters((currentValues) =>
      currentValues.filter((type) => businessTypeOptions.includes(type))
    );
  }, [allBusinessTypesChecked, businessTypeOptions]);

  useEffect(() => {
    if (!isBusinessTypeDropdownOpen && !isWebsiteStatusDropdownOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (
        isBusinessTypeDropdownOpen &&
        businessTypeDropdownRef.current &&
        !businessTypeDropdownRef.current.contains(event.target as Node)
      ) {
        setIsBusinessTypeDropdownOpen(false);
      }

      if (
        isWebsiteStatusDropdownOpen &&
        websiteStatusDropdownRef.current &&
        !websiteStatusDropdownRef.current.contains(event.target as Node)
      ) {
        setIsWebsiteStatusDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (isBusinessTypeDropdownOpen) {
          setIsBusinessTypeDropdownOpen(false);
          businessTypeToggleButtonRef.current?.focus();
          return;
        }

        if (isWebsiteStatusDropdownOpen) {
          setIsWebsiteStatusDropdownOpen(false);
          websiteStatusToggleButtonRef.current?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isBusinessTypeDropdownOpen, isWebsiteStatusDropdownOpen]);

  const selectedWebsiteStatusLabels = WEBSITE_STATUS_OPTIONS
    .filter((status) => websiteStatusFilters.includes(status))
    .map((status) => WEBSITE_STATUS_LABELS[status]);
  const websiteStatusSummary = allWebsiteStatusesChecked
    ? 'All'
    : selectedWebsiteStatusLabels.length > 0
      ? selectedWebsiteStatusLabels.join(', ')
      : 'None selected';
  const websiteStatusSummaryDisplay =
    websiteStatusSummary.length > 72
      ? `${websiteStatusSummary.slice(0, 69)}...`
      : websiteStatusSummary;

  const selectedBusinessTypeLabels = businessTypeOptions
    .filter((type) => businessTypeFilters.includes(type))
    .map((type) => formatGooglePlaceTypeLabel(type));
  const businessTypeSummary = allBusinessTypesChecked
    ? 'All'
    : selectedBusinessTypeLabels.length > 0
      ? selectedBusinessTypeLabels.join(', ')
      : 'None selected';
  const businessTypeSummaryDisplay =
    businessTypeSummary.length > 72
      ? `${businessTypeSummary.slice(0, 69)}...`
      : businessTypeSummary;

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
      if (!allWebsiteStatusesChecked) {
        websiteStatusFilters.forEach((websiteStatus) => {
          params.append('websiteStatus', websiteStatus);
        });
      }
      if (!allBusinessTypesChecked) {
        businessTypeFilters.forEach((businessType) => {
          params.append('businessType', businessType);
        });
      }

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

  const handleBusinessTypeCheckboxEnterKeyDown = (
    event: ReactKeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();

      const inputs = Array.from(
        businessTypeDropdownRef.current?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]') || []
      );
      const currentIndex = inputs.indexOf(event.currentTarget);
      if (currentIndex === -1 || inputs.length === 0) {
        return;
      }

      const nextIndex = event.key === 'ArrowDown'
        ? (currentIndex + 1) % inputs.length
        : (currentIndex - 1 + inputs.length) % inputs.length;
      inputs[nextIndex]?.focus();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setIsBusinessTypeDropdownOpen(false);
      businessTypeToggleButtonRef.current?.focus();
      return;
    }

    if (event.key !== 'Enter') {
      return;
    }

    // Keep Enter scoped to toggling the focused option instead of submitting form.
    event.preventDefault();
    event.currentTarget.click();
  };

  const handleWebsiteStatusCheckboxEnterKeyDown = (
    event: ReactKeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();

      const inputs = Array.from(
        websiteStatusDropdownRef.current?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]') || []
      );
      const currentIndex = inputs.indexOf(event.currentTarget);
      if (currentIndex === -1 || inputs.length === 0) {
        return;
      }

      const nextIndex = event.key === 'ArrowDown'
        ? (currentIndex + 1) % inputs.length
        : (currentIndex - 1 + inputs.length) % inputs.length;
      inputs[nextIndex]?.focus();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setIsWebsiteStatusDropdownOpen(false);
      websiteStatusToggleButtonRef.current?.focus();
      return;
    }

    if (event.key !== 'Enter') {
      return;
    }

    // Keep Enter scoped to toggling the focused option instead of submitting form.
    event.preventDefault();
    event.currentTarget.click();
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
          <div className="relative w-72 max-w-full" ref={websiteStatusDropdownRef}>
            <button
              type="button"
              aria-label="Website Status"
              aria-expanded={isWebsiteStatusDropdownOpen}
              ref={websiteStatusToggleButtonRef}
              onClick={() => setIsWebsiteStatusDropdownOpen((open) => !open)}
              className="theme-input flex w-full max-w-full items-center justify-between overflow-hidden rounded-lg border px-3 py-2 text-left text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              <span className="min-w-0 flex-1 truncate" title={websiteStatusSummary}>
                {websiteStatusSummaryDisplay}
              </span>
              <span className="theme-text-muted ml-2 shrink-0 text-xs">
                {isWebsiteStatusDropdownOpen ? '▲' : '▼'}
              </span>
            </button>

            {isWebsiteStatusDropdownOpen && (
              <div className="theme-input absolute left-0 right-0 z-20 mt-1 max-w-full space-y-1 overflow-x-hidden rounded-lg border px-3 py-2 shadow-lg">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={allWebsiteStatusesChecked}
                    onKeyDown={handleWebsiteStatusCheckboxEnterKeyDown}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setAllWebsiteStatusesChecked(true);
                        setPage(1);
                        return;
                      }
                      setAllWebsiteStatusesChecked(false);
                      setWebsiteStatusFilters([]);
                      setPage(1);
                    }}
                  />
                  <span>All</span>
                </label>
                <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                  {WEBSITE_STATUS_OPTIONS.map((status) => {
                    const checked = websiteStatusFilters.includes(status);
                    return (
                      <label key={status} className="flex min-w-0 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onKeyDown={handleWebsiteStatusCheckboxEnterKeyDown}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setWebsiteStatusFilters((currentStatuses) => {
                                const nextStatuses = Array.from(new Set([...currentStatuses, status]));
                                setAllWebsiteStatusesChecked(nextStatuses.length === WEBSITE_STATUS_OPTIONS.length);
                                return nextStatuses;
                              });
                              setPage(1);
                              return;
                            }

                            setAllWebsiteStatusesChecked(false);
                            setWebsiteStatusFilters((currentStatuses) =>
                              currentStatuses.filter((currentStatus) => currentStatus !== status)
                            );
                            setPage(1);
                          }}
                        />
                        <span className="min-w-0 break-words">{WEBSITE_STATUS_LABELS[status]}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="theme-text-muted block text-sm font-medium mb-1">Business Type</label>
          <div className="relative w-72 max-w-full" ref={businessTypeDropdownRef}>
            <button
              type="button"
              aria-label="Business Type"
              aria-expanded={isBusinessTypeDropdownOpen}
              ref={businessTypeToggleButtonRef}
              onClick={() => setIsBusinessTypeDropdownOpen((open) => !open)}
              className="theme-input flex w-full max-w-full items-center justify-between overflow-hidden rounded-lg border px-3 py-2 text-left text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              <span className="min-w-0 flex-1 truncate" title={businessTypeSummary}>
                {businessTypeSummaryDisplay}
              </span>
              <span className="theme-text-muted ml-2 shrink-0 text-xs">
                {isBusinessTypeDropdownOpen ? '▲' : '▼'}
              </span>
            </button>

            {isBusinessTypeDropdownOpen && (
              <div className="theme-input absolute left-0 right-0 z-20 mt-1 max-w-full space-y-1 overflow-x-hidden rounded-lg border px-3 py-2 shadow-lg">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={allBusinessTypesChecked}
                    onKeyDown={handleBusinessTypeCheckboxEnterKeyDown}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setAllBusinessTypesChecked(true);
                        setPage(1);
                        return;
                      }
                      setAllBusinessTypesChecked(false);
                      setBusinessTypeFilters([]);
                      setPage(1);
                    }}
                  />
                  <span>All</span>
                </label>
                <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                  {businessTypeOptions.map((type) => {
                    const checked = businessTypeFilters.includes(type);
                    return (
                      <label key={type} className="flex min-w-0 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onKeyDown={handleBusinessTypeCheckboxEnterKeyDown}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setBusinessTypeFilters((currentTypes) => {
                                const nextTypes = Array.from(new Set([...currentTypes, type]));
                                setAllBusinessTypesChecked(nextTypes.length === businessTypeOptions.length);
                                return nextTypes;
                              });
                              setPage(1);
                              return;
                            }

                            setAllBusinessTypesChecked(false);
                            setBusinessTypeFilters((currentTypes) =>
                              currentTypes.filter((currentType) => currentType !== type)
                            );
                            setPage(1);
                          }}
                        />
                        <span className="min-w-0 break-words">{formatGooglePlaceTypeLabel(type)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
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
                        {lead.hasEmail && (
                          <span
                            title="Has email"
                            aria-label="Has email"
                            className="theme-badge-info inline-flex items-center rounded-md border border-white/10 px-2 py-1 text-xs font-medium"
                          >
                            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5A1.5 1.5 0 0 1 4.5 6h15A1.5 1.5 0 0 1 21 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5v-9Z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="m3.5 7 8.1 6.05a.75.75 0 0 0 .9 0L20.5 7" />
                            </svg>
                          </span>
                        )}
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
