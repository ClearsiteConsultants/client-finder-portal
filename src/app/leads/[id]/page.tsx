'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import TopNav from '@/components/TopNav';
import { googleMapsPlaceUrl } from '@/lib/places/maps';

type Business = {
  id: string;
  placeId: string | null;
  name: string;
  address: string;
  lat: string | null;
  lng: string | null;
  phone: string | null;
  website: string | null;
  businessTypes: string[];
  rating: number | null;
  reviewCount: number | null;
  smallBusinessScore: number | null;
  websiteStatus: string;
  leadStatus: string;
  source: string;
  discoveredAt: string;
  approvedAt: string | null;
  approvedByUser: { id: string; name: string | null; email: string | null } | null;
  rejectedAt: string | null;
  rejectedByUser: { id: string; name: string | null; email: string | null } | null;
  rejectedReason: string | null;
  lastContactAt: string | null;
  nextFollowupAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function LeadDetailPage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams<{ id?: string | string[] }>();
  const leadId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [nextFollowupAt, setNextFollowupAt] = useState('');
  const [showLinkPlaceId, setShowLinkPlaceId] = useState(false);
  const [placeIdInput, setPlaceIdInput] = useState('');
  const [linkingPlaceId, setLinkingPlaceId] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      if (!leadId) {
        setLoading(false);
        return;
      }

      fetchBusiness(leadId);
    }
  }, [status, leadId]);

  const fetchBusiness = async (id: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/leads/${id}`);
      if (response.ok) {
        const data: Business = await response.json();
        setBusiness(data);
        setNotes(data.notes || '');
        setNextFollowupAt(
          data.nextFollowupAt
            ? new Date(data.nextFollowupAt).toISOString().split('T')[0]
            : ''
        );
      } else if (response.status === 404) {
        router.push('/review');
      }
    } catch (error) {
      console.error('Error fetching business:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!leadId) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: notes || null,
          nextFollowupAt: nextFollowupAt || null,
        }),
      });

      if (response.ok) {
        const data: Business = await response.json();
        setBusiness(data);
      }
    } catch (error) {
      console.error('Error updating business:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleLinkPlaceId = async () => {
    if (!leadId) return;
    if (!placeIdInput.trim()) return;
    
    setLinkingPlaceId(true);
    try {
      const response = await fetch('/api/leads/link-place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: leadId,
          placeId: placeIdInput.trim(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setBusiness(data.business);
        setShowLinkPlaceId(false);
        setPlaceIdInput('');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to link place_id');
      }
    } catch (error) {
      console.error('Error linking place_id:', error);
      alert('Failed to link place_id');
    } finally {
      setLinkingPlaceId(false);
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

  const getLeadStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-2 py-1 text-xs rounded ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status}
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

  if (!leadId) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-50">
        Missing lead id.
      </div>
    );
  }

  if (!business) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-50">
      <TopNav />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <button
            onClick={() => router.push('/review')}
            className="mb-4 text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            ← Back to Review Queue
          </button>
          <h1 className="text-2xl font-semibold">{business.name}</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Lead Details
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Business Info Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <h2 className="text-lg font-semibold mb-4">Business Information</h2>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Address</dt>
                  <dd className="mt-1 text-sm">{business.address}</dd>
                </div>
                {business.phone && (
                  <div>
                    <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Phone</dt>
                    <dd className="mt-1 text-sm">
                      <a href={`tel:${business.phone}`} className="text-blue-600 hover:underline dark:text-blue-400">
                        {business.phone}
                      </a>
                    </dd>
                  </div>
                )}
                {business.website && (
                  <div>
                    <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Website</dt>
                    <dd className="mt-1 text-sm">
                      <a
                        href={business.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {business.website}
                      </a>
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Website Status</dt>
                  <dd className="mt-1">{getWebsiteStatusBadge(business.websiteStatus)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Lead Status</dt>
                  <dd className="mt-1">{getLeadStatusBadge(business.leadStatus)}</dd>
                </div>
                {business.businessTypes.length > 0 && (
                  <div>
                    <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Business Types</dt>
                    <dd className="mt-1 text-sm">{business.businessTypes.join(', ')}</dd>
                  </div>
                )}
                {business.rating && (
                  <div>
                    <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Rating</dt>
                    <dd className="mt-1 text-sm">
                      ⭐ {business.rating.toFixed(1)} ({business.reviewCount} reviews)
                    </dd>
                  </div>
                )}
                {business.smallBusinessScore && (
                  <div>
                    <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Small Business Score</dt>
                    <dd className="mt-1 text-sm">{business.smallBusinessScore}</dd>
                  </div>
                )}
                {business.placeId && (
                  <div>
                    <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Google Maps</dt>
                    <dd className="mt-1 text-sm">
                      <a
                        href={googleMapsPlaceUrl(business.placeId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline dark:text-blue-400"
                      >
                        View on Google Maps
                      </a>
                    </dd>
                  </div>
                )}
                {!business.placeId && business.source === 'manual' && (
                  <div>
                    <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Google Place ID</dt>
                    <dd className="mt-1 text-sm">
                      {!showLinkPlaceId ? (
                        <button
                          onClick={() => setShowLinkPlaceId(true)}
                          className="text-blue-600 hover:underline dark:text-blue-400"
                        >
                          Link to Google Place ID
                        </button>
                      ) : (
                        <div className="flex gap-2 items-center">
                          <input
                            type="text"
                            value={placeIdInput}
                            onChange={(e) => setPlaceIdInput(e.target.value)}
                            placeholder="Enter place_id"
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                          />
                          <button
                            onClick={handleLinkPlaceId}
                            disabled={linkingPlaceId}
                            className="rounded-lg bg-blue-600 px-3 py-1 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            {linkingPlaceId ? 'Linking...' : 'Link'}
                          </button>
                          <button
                            onClick={() => {
                              setShowLinkPlaceId(false);
                              setPlaceIdInput('');
                            }}
                            className="rounded-lg border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-900"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Source</dt>
                  <dd className="mt-1 text-sm">
                    <span className={`px-2 py-1 text-xs rounded ${business.source === 'manual' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                      {business.source === 'manual' ? 'Manual Entry' : 'Google Maps'}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>

            {/* Notes Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <h2 className="text-lg font-semibold mb-4">Notes</h2>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                rows={6}
                placeholder="Add notes about this lead..."
              />
            </div>

            {/* Outreach Timeline Placeholder */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <h2 className="text-lg font-semibold mb-4">Outreach Timeline</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Timeline will be available once Phase 6 is implemented.
              </p>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Follow-up Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <h2 className="text-lg font-semibold mb-4">Follow-up</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                    Next Follow-up Date
                  </label>
                  <input
                    type="date"
                    value={nextFollowupAt}
                    onChange={(e) => setNextFollowupAt(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                  />
                </div>
                {business.lastContactAt && (
                  <div>
                    <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Last Contact</dt>
                    <dd className="mt-1 text-sm">
                      {new Date(business.lastContactAt).toLocaleDateString()}
                    </dd>
                  </div>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-600 disabled:cursor-not-allowed dark:disabled:bg-slate-700 dark:disabled:text-slate-300"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>

            {/* Source Info Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <h2 className="text-lg font-semibold mb-4">Source & Discovery</h2>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Source</dt>
                  <dd className="mt-1 text-sm">{business.source.replace('_', ' ')}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Discovered</dt>
                  <dd className="mt-1 text-sm">
                    {new Date(business.discoveredAt).toLocaleDateString()}
                  </dd>
                </div>
                {business.approvedAt && business.approvedByUser && (
                  <div>
                    <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Approved</dt>
                    <dd className="mt-1 text-sm">
                      {new Date(business.approvedAt).toLocaleDateString()} by{' '}
                      {business.approvedByUser.name || business.approvedByUser.email}
                    </dd>
                  </div>
                )}
                {business.rejectedAt && business.rejectedByUser && (
                  <div>
                    <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Rejected</dt>
                    <dd className="mt-1 text-sm">
                      {new Date(business.rejectedAt).toLocaleDateString()} by{' '}
                      {business.rejectedByUser.name || business.rejectedByUser.email}
                    </dd>
                    {business.rejectedReason && (
                      <dd className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                        Reason: {business.rejectedReason}
                      </dd>
                    )}
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
