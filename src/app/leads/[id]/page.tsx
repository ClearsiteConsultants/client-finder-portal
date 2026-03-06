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
  contactInfo?: Array<{
    id: string;
    email: string | null;
    phone: string | null;
    facebookUrl: string | null;
    instagramUrl: string | null;
    linkedinUrl: string | null;
  }>;
};

export default function LeadDetailPage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams<{ id?: string | string[] }>();
  const leadId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [notes, setNotes] = useState('');
  const [nextFollowupAt, setNextFollowupAt] = useState('');
  const [showLinkPlaceId, setShowLinkPlaceId] = useState(false);
  const [placeIdInput, setPlaceIdInput] = useState('');
  const [linkingPlaceId, setLinkingPlaceId] = useState(false);

  // Business info editing state
  const [editingBusinessInfo, setEditingBusinessInfo] = useState(false);
  const [editedAddress, setEditedAddress] = useState('');
  const [editedPhone, setEditedPhone] = useState('');
  const [editedWebsite, setEditedWebsite] = useState('');
  const [editedWebsiteStatus, setEditedWebsiteStatus] = useState('no_website');
  const [websiteStatusManuallyEdited, setWebsiteStatusManuallyEdited] = useState(false);
  const [editedLeadStatus, setEditedLeadStatus] = useState('');
  const [editedBusinessTypes, setEditedBusinessTypes] = useState<string[]>([]);
  const [editedRating, setEditedRating] = useState<number | null>(null);
  const [editedPlaceId, setEditedPlaceId] = useState('');
  const [editedSource, setEditedSource] = useState('google_maps');
  const [editedFacebookUrl, setEditedFacebookUrl] = useState('');
  const [editedInstagramUrl, setEditedInstagramUrl] = useState('');
  const [editedLinkedinUrl, setEditedLinkedinUrl] = useState('');
  const [businessInfoErrors, setBusinessInfoErrors] = useState<Record<string, string>>({});

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

  const enterBusinessInfoEditMode = () => {
    if (!business) return;
    setEditedAddress(business.address);
    setEditedPhone(business.phone || '');
    setEditedWebsite(business.website || '');
    setEditedWebsiteStatus(business.websiteStatus);
    setWebsiteStatusManuallyEdited(false);
    setEditedLeadStatus(business.leadStatus);
    setEditedBusinessTypes(business.businessTypes);
    setEditedRating(business.rating);
    setEditedPlaceId(business.placeId || '');
    setEditedSource(business.source);
    setEditedFacebookUrl(business.contactInfo?.[0]?.facebookUrl || '');
    setEditedInstagramUrl(business.contactInfo?.[0]?.instagramUrl || '');
    setEditedLinkedinUrl(business.contactInfo?.[0]?.linkedinUrl || '');
    setBusinessInfoErrors({});
    setEditingBusinessInfo(true);
  };

  const cancelBusinessInfoEdit = () => {
    setEditingBusinessInfo(false);
    setBusinessInfoErrors({});
  };

  const validateBusinessInfo = () => {
    const errors: Record<string, string> = {};

    if (!editedAddress.trim()) {
      errors.address = 'Address is required';
    }

    if (editedWebsite && !editedWebsite.match(/^https?:\/\/.+/)) {
      errors.website = 'Website must start with http:// or https://';
    }

    setBusinessInfoErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveBusinessInfo = async () => {
    if (!leadId || !validateBusinessInfo()) return;

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        address: editedAddress,
        phone: editedPhone || null,
        website: editedWebsite || null,
        placeId: editedPlaceId || null,
        source: editedSource,
        leadStatus: editedLeadStatus,
        businessTypes: editedBusinessTypes,
        rating: editedRating !== null ? editedRating : null,
        facebookUrl: editedFacebookUrl || null,
        instagramUrl: editedInstagramUrl || null,
        linkedinUrl: editedLinkedinUrl || null,
      };

      if (websiteStatusManuallyEdited) {
        payload.websiteStatus = editedWebsiteStatus;
      }

      const response = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data: Business = await response.json();
        setBusiness(data);
        setEditingBusinessInfo(false);
        setBusinessInfoErrors({});
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update business information');
      }
    } catch (error) {
      console.error('Error updating business:', error);
      alert('Failed to update business information');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLead = async () => {
    if (!leadId) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        router.push('/review');
        return;
      }

      const error = await response.json();
      alert(error.error || 'Failed to delete lead');
    } catch (error) {
      console.error('Error deleting lead:', error);
      alert('Failed to delete lead');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
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
    };
    return (
      <span className={`px-2 py-1 text-xs rounded ${colors[status] || colors.no_website}`}>
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
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Business Information</h2>
                <button
                  onClick={enterBusinessInfoEditMode}
                  disabled={saving}
                  className="flex items-center justify-center w-8 h-8 rounded-md border-2 border-blue-600 bg-blue-600 hover:bg-blue-700 hover:border-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Edit Business Information"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="white" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                  </svg>
                </button>
              </div>

              {editingBusinessInfo ? (
                <form className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                      Address *
                    </label>
                    <input
                      type="text"
                      value={editedAddress}
                      onChange={(e) => setEditedAddress(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                    />
                    {businessInfoErrors.address && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">{businessInfoErrors.address}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                      Phone
                    </label>
                    <input
                      type="text"
                      value={editedPhone}
                      onChange={(e) => setEditedPhone(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                      Website
                    </label>
                    <input
                      type="text"
                      value={editedWebsite}
                      onChange={(e) => setEditedWebsite(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                    />
                    {businessInfoErrors.website && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">{businessInfoErrors.website}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                      Website Status
                    </label>
                    <select
                      value={editedWebsiteStatus}
                      onChange={(e) => {
                        setEditedWebsiteStatus(e.target.value);
                        setWebsiteStatusManuallyEdited(true);
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                    >
                      <option value="no_website">No Website</option>
                      <option value="social_only">Social Only</option>
                      <option value="broken">Broken</option>
                      <option value="technical_issues">Technical Issues</option>
                      <option value="outdated">Outdated</option>
                      <option value="acceptable">Acceptable</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                      Google Place ID
                    </label>
                    <input
                      type="text"
                      value={editedPlaceId}
                      onChange={(e) => setEditedPlaceId(e.target.value)}
                      placeholder="Enter place_id"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                      Source
                    </label>
                    <select
                      value={editedSource}
                      onChange={(e) => setEditedSource(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                    >
                      <option value="google_maps">Google Maps</option>
                      <option value="manual">Manual Entry</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                      Lead Status
                    </label>
                    <select
                      value={editedLeadStatus}
                      onChange={(e) => setEditedLeadStatus(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                    >
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="contacted">Contacted</option>
                      <option value="responded">Responded</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                      Business Types
                    </label>
                    <input
                      type="text"
                      value={editedBusinessTypes.join(', ')}
                      onChange={(e) => setEditedBusinessTypes(e.target.value.split(',').map(t => t.trim()).filter(t => t))}
                      placeholder="e.g. retail, e-commerce, services"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                      Rating
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      value={editedRating !== null ? editedRating : ''}
                      onChange={(e) => setEditedRating(e.target.value ? Number(e.target.value) : null)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                    />
                  </div>

                  <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Social Media</h3>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                          Facebook URL
                        </label>
                        <input
                          type="text"
                          value={editedFacebookUrl}
                          onChange={(e) => setEditedFacebookUrl(e.target.value)}
                          placeholder="https://facebook.com/..."
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                          Instagram URL
                        </label>
                        <input
                          type="text"
                          value={editedInstagramUrl}
                          onChange={(e) => setEditedInstagramUrl(e.target.value)}
                          placeholder="https://instagram.com/..."
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                          LinkedIn URL
                        </label>
                        <input
                          type="text"
                          value={editedLinkedinUrl}
                          onChange={(e) => setEditedLinkedinUrl(e.target.value)}
                          placeholder="https://linkedin.com/..."
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleSaveBusinessInfo}
                      disabled={saving}
                      className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-600 disabled:cursor-not-allowed dark:disabled:bg-slate-700 dark:disabled:text-slate-300"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelBusinessInfoEdit}
                      disabled={saving}
                      className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-900"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
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
                  {(business.contactInfo?.[0]?.facebookUrl || business.contactInfo?.[0]?.instagramUrl || business.contactInfo?.[0]?.linkedinUrl) && (
                    <div>
                      <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Social Media</dt>
                      <dd className="mt-1 flex flex-wrap gap-2">
                        {business.contactInfo[0].facebookUrl && (
                          <a
                            href={business.contactInfo[0].facebookUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400 text-sm"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                            </svg>
                            Facebook
                          </a>
                        )}
                        {business.contactInfo[0].instagramUrl && (
                          <a
                            href={business.contactInfo[0].instagramUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400 text-sm"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                            </svg>
                            Instagram
                          </a>
                        )}
                        {business.contactInfo[0].linkedinUrl && (
                          <a
                            href={business.contactInfo[0].linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400 text-sm"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                            </svg>
                            LinkedIn
                          </a>
                        )}
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
              )}
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

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <h2 className="text-lg font-semibold mb-4">Actions</h2>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleting}
                className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:bg-slate-300 disabled:text-slate-600 disabled:cursor-not-allowed dark:disabled:bg-slate-700 dark:disabled:text-slate-300"
              >
                {deleting ? 'Deleting...' : 'Delete Lead'}
              </button>
            </div>
          </div>
        </div>
      </main>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-950">
            <h3 className="text-lg font-semibold">Delete Lead</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Are you sure you want to delete <strong>{business.name}</strong>? This action cannot be undone.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleDeleteLead}
                disabled={deleting}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-900 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
