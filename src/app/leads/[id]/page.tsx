'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import TopNav from '@/components/TopNav';
import LeadCommentsThread from '@/components/LeadCommentsThread';
import {
  GOOGLE_PLACES_BUSINESS_TYPES,
  formatGooglePlaceTypeLabel,
  mergeBusinessTypes,
} from '@/lib/places/business-types';
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
  isClient?: boolean;
  convertedAt?: string | null;
  clientStatus?: string | null;
  convertedByUser?: { id: string; name: string | null; email: string | null } | null;
  contactInfo?: Array<{
    id: string;
    email: string | null;
    phone: string | null;
    facebookUrl: string | null;
    instagramUrl: string | null;
    linkedinUrl: string | null;
  }>;
};

function getWebsiteDomain(website: string | null | undefined): string | null {
  if (!website) {
    return null;
  }

  try {
    const hostname = new URL(website).hostname.toLowerCase();
    return hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function getPreferredContactEmail(business: Business): string | undefined {
  const emails = (business.contactInfo || [])
    .map((contact) => contact.email?.trim().toLowerCase())
    .filter((email): email is string => !!email);

  if (emails.length === 0) {
    return undefined;
  }

  const websiteDomain = getWebsiteDomain(business.website);
  if (!websiteDomain) {
    return emails[0];
  }

  const sameDomainEmail = emails.find((email) => {
    const emailDomain = email.split('@')[1]?.toLowerCase();
    return emailDomain === websiteDomain;
  });

  return sameDomainEmail || emails[0];
}

export default function LeadDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams<{ id?: string | string[] }>();
  const leadId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [convertingToClient, setConvertingToClient] = useState(false);
  const [nextFollowupAt, setNextFollowupAt] = useState('');
  const [showLinkPlaceId, setShowLinkPlaceId] = useState(false);
  const [placeIdInput, setPlaceIdInput] = useState('');
  const [linkingPlaceId, setLinkingPlaceId] = useState(false);

  // Business info editing state
  const [editingBusinessInfo, setEditingBusinessInfo] = useState(false);
  const [editedAddress, setEditedAddress] = useState('');
  const [editedPhone, setEditedPhone] = useState('');
  const [editedEmail, setEditedEmail] = useState('');
  const [editedWebsite, setEditedWebsite] = useState('');
  const [editedWebsiteStatus, setEditedWebsiteStatus] = useState('no_website');
  const [websiteStatusManuallyEdited, setWebsiteStatusManuallyEdited] = useState(false);
  const [showNoWebsiteBlockedPopup, setShowNoWebsiteBlockedPopup] = useState(false);
  const [editedLeadStatus, setEditedLeadStatus] = useState('');
  const [editedBusinessTypes, setEditedBusinessTypes] = useState<string[]>([]);
  const [editedRating, setEditedRating] = useState<number | null>(null);
  const [editedPlaceId, setEditedPlaceId] = useState('');
  const [editedSource, setEditedSource] = useState('google_maps');
  const [editedFacebookUrl, setEditedFacebookUrl] = useState('');
  const [editedInstagramUrl, setEditedInstagramUrl] = useState('');
  const [editedLinkedinUrl, setEditedLinkedinUrl] = useState('');
  const [availableBusinessTypes, setAvailableBusinessTypes] = useState<string[]>(GOOGLE_PLACES_BUSINESS_TYPES);
  const [showBusinessTypeOptions, setShowBusinessTypeOptions] = useState(false);
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

  useEffect(() => {
    if (status !== 'authenticated') {
      return;
    }

    let isMounted = true;

    const loadBusinessTypes = async () => {
      try {
        const response = await fetch('/api/places/business-types');
        if (!response.ok) {
          return;
        }

        const data: { businessTypes?: string[] } = await response.json();
        if (isMounted && Array.isArray(data.businessTypes)) {
          setAvailableBusinessTypes(mergeBusinessTypes(data.businessTypes));
        }
      } catch {
        // Keep static defaults when dynamic loading fails.
      }
    };

    loadBusinessTypes();

    return () => {
      isMounted = false;
    };
  }, [status]);

  const fetchBusiness = async (id: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/leads/${id}`);
      if (response.ok) {
        const data: Business = await response.json();
        setBusiness(data);
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
    const contactEmail = getPreferredContactEmail(business) || '';
    setEditedAddress(business.address);
    setEditedPhone(business.phone || '');
    setEditedEmail(contactEmail);
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
    setShowBusinessTypeOptions(false);
    setBusinessInfoErrors({});
    setEditingBusinessInfo(true);
  };

  const cancelBusinessInfoEdit = () => {
    setEditingBusinessInfo(false);
    setShowBusinessTypeOptions(false);
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

    if (editedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editedEmail)) {
      errors.email = 'Invalid email format';
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
        email: editedEmail || null,
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
        setShowBusinessTypeOptions(false);
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

  const handleConvertToClient = async () => {
    if (!leadId || !business) return;

    if (business.leadStatus !== 'approved') {
      alert('Only approved leads can be converted to an active client.');
      return;
    }

    if (business.isClient) {
      router.push(`/clients/${business.id}`);
      return;
    }

    setConvertingToClient(true);
    try {
      const response = await fetch('/api/leads/convert-to-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: leadId,
          clientStatus: 'active',
        }),
      });

      let data: { error?: string; business?: Business } = {};
      try {
        data = await response.json();
      } catch {
        // Non-JSON responses should still surface a helpful client error.
      }

      if (!response.ok) {
        console.error('Convert to client API failed', {
          status: response.status,
          body: data,
          businessId: leadId,
        });

        if (response.status === 404 && data.error === 'User not found') {
          alert('Your session is linked to a user that no longer exists. Please sign out and sign back in. If this continues, ask an admin to recreate your account.');
          return;
        }

        if (response.status === 401) {
          alert('Your session has expired. Please sign in again and retry conversion.');
          return;
        }

        alert(data.error || 'Failed to convert lead to active client');
        return;
      }

      if (!data.business) {
        alert('Lead was converted, but no client details were returned. Please refresh and check Active Clients.');
        return;
      }

      setBusiness(data.business);
      router.push(`/clients/${data.business.id}`);
    } catch (error) {
      console.error('Error converting lead to client:', error);
      alert('Failed to convert lead to active client');
    } finally {
      setConvertingToClient(false);
    }
  };

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

  const getLeadStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'theme-badge-warning',
      approved: 'theme-badge-success',
      rejected: 'theme-badge-critical',
      contacted: 'theme-badge-info',
      responded: 'theme-badge-info',
      inactive: 'theme-badge-accent',
    };
    return (
      <span className={`inline-flex items-center rounded-md border border-white/10 px-2 py-1 text-xs font-medium ${colors[status] || 'theme-badge-info'}`}>
        {status}
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

  if (!leadId) {
    return (
      <div className="flex h-screen items-center justify-center">
        Missing lead id.
      </div>
    );
  }

  if (!business) {
    return null;
  }

  const isClient = Boolean(business.isClient);
  const canConvertToClient = !isClient && business.leadStatus === 'approved';
  const businessTypeOptions = mergeBusinessTypes([...availableBusinessTypes, ...editedBusinessTypes]);
  const selectedBusinessTypeLabel = editedBusinessTypes.length > 0
    ? editedBusinessTypes.map(formatGooglePlaceTypeLabel).join(', ')
    : 'Select business types';
  const primaryContactEmail = getPreferredContactEmail(business);

  return (
    <div className="min-h-screen">
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
          <p className="theme-text-muted mt-1 text-sm">
            Lead Details
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Business Info Card */}
            <div className="theme-surface theme-border rounded-2xl border p-6 shadow-sm">
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
                    <label className="block theme-text-muted text-sm font-medium mb-1">
                      Address *
                    </label>
                    <input
                      type="text"
                      value={editedAddress}
                      onChange={(e) => setEditedAddress(e.target.value)}
                      className="theme-input w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                    {businessInfoErrors.address && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">{businessInfoErrors.address}</p>
                    )}
                  </div>

                  <div>
                    <label className="block theme-text-muted text-sm font-medium mb-1">
                      Phone
                    </label>
                    <input
                      type="text"
                      value={editedPhone}
                      onChange={(e) => setEditedPhone(e.target.value)}
                      className="theme-input w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>

                  <div>
                    <label className="block theme-text-muted text-sm font-medium mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={editedEmail}
                      onChange={(e) => setEditedEmail(e.target.value)}
                      className="theme-input w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                    {businessInfoErrors.email && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">{businessInfoErrors.email}</p>
                    )}
                  </div>

                  <div>
                    <label className="block theme-text-muted text-sm font-medium mb-1">
                      Website
                    </label>
                    <input
                      type="text"
                      value={editedWebsite}
                      onChange={(e) => setEditedWebsite(e.target.value)}
                      className="theme-input w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                    {businessInfoErrors.website && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">{businessInfoErrors.website}</p>
                    )}
                  </div>

                  <div>
                    <label className="block theme-text-muted text-sm font-medium mb-1">
                      Website Status
                    </label>
                    <select
                      value={editedWebsiteStatus}
                      onChange={(e) => {
                        if (e.target.value === 'no_website' && editedWebsite.trim()) {
                          setShowNoWebsiteBlockedPopup(true);
                          return;
                        }
                        setEditedWebsiteStatus(e.target.value);
                        setWebsiteStatusManuallyEdited(true);
                      }}
                      className="theme-input w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
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
                    <label className="block theme-text-muted text-sm font-medium mb-1">
                      Google Place ID
                    </label>
                    <input
                      type="text"
                      value={editedPlaceId}
                      onChange={(e) => setEditedPlaceId(e.target.value)}
                      placeholder="Enter place_id"
                      className="theme-input w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>

                  <div>
                    <label className="block theme-text-muted text-sm font-medium mb-1">
                      Source
                    </label>
                    <select
                      value={editedSource}
                      onChange={(e) => setEditedSource(e.target.value)}
                      className="theme-input w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    >
                      <option value="google_maps">Google Maps</option>
                      <option value="manual">Manual Entry</option>
                    </select>
                  </div>

                  <div>
                    <label className="block theme-text-muted text-sm font-medium mb-1">
                      Lead Status
                    </label>
                    <select
                      value={editedLeadStatus}
                      onChange={(e) => setEditedLeadStatus(e.target.value)}
                      className="theme-input w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
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
                    <label className="block theme-text-muted text-sm font-medium mb-1">
                      Business Types
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowBusinessTypeOptions((prev) => !prev)}
                      className="theme-input flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      aria-expanded={showBusinessTypeOptions}
                      aria-label="Business Types dropdown"
                    >
                      <span className="truncate text-left">{selectedBusinessTypeLabel}</span>
                      <span className="theme-text-muted ml-2">{showBusinessTypeOptions ? '▲' : '▼'}</span>
                    </button>
                    {showBusinessTypeOptions && (
                      <div className="theme-input mt-2 max-h-48 overflow-y-auto rounded-lg border p-2">
                        {businessTypeOptions.map((businessType) => {
                          const isChecked = editedBusinessTypes.includes(businessType);
                          return (
                            <label key={businessType} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-100 dark:hover:bg-slate-900">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  setEditedBusinessTypes((prev) => {
                                    if (e.target.checked) {
                                      return [...prev, businessType];
                                    }
                                    return prev.filter((type) => type !== businessType);
                                  });
                                }}
                                className="h-4 w-4"
                              />
                              <span>{formatGooglePlaceTypeLabel(businessType)}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block theme-text-muted text-sm font-medium mb-1">
                      Rating
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      value={editedRating !== null ? editedRating : ''}
                      onChange={(e) => setEditedRating(e.target.value ? Number(e.target.value) : null)}
                      className="theme-input w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>

                  <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
                    <h3 className="theme-text-muted text-sm font-semibold mb-3">Social Media</h3>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="block theme-text-muted text-sm font-medium mb-1">
                          Facebook URL
                        </label>
                        <input
                          type="text"
                          value={editedFacebookUrl}
                          onChange={(e) => setEditedFacebookUrl(e.target.value)}
                          placeholder="https://facebook.com/..."
                          className="theme-input w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        />
                      </div>

                      <div>
                        <label className="block theme-text-muted text-sm font-medium mb-1">
                          Instagram URL
                        </label>
                        <input
                          type="text"
                          value={editedInstagramUrl}
                          onChange={(e) => setEditedInstagramUrl(e.target.value)}
                          placeholder="https://instagram.com/..."
                          className="theme-input w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        />
                      </div>

                      <div>
                        <label className="block theme-text-muted text-sm font-medium mb-1">
                          LinkedIn URL
                        </label>
                        <input
                          type="text"
                          value={editedLinkedinUrl}
                          onChange={(e) => setEditedLinkedinUrl(e.target.value)}
                          placeholder="https://linkedin.com/..."
                          className="theme-input w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
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
                    <dt className="theme-text-muted text-sm font-medium">Address</dt>
                    <dd className="mt-1 text-sm">{business.address}</dd>
                  </div>
                  {business.phone && (
                    <div>
                      <dt className="theme-text-muted text-sm font-medium">Phone</dt>
                      <dd className="mt-1 text-sm">
                        <a href={`tel:${business.phone}`} className="text-blue-600 hover:underline dark:text-blue-400">
                          {business.phone}
                        </a>
                      </dd>
                    </div>
                  )}
                  {primaryContactEmail && (
                    <div>
                      <dt className="theme-text-muted text-sm font-medium">Email</dt>
                      <dd className="mt-1 text-sm">
                        <a
                          href={`mailto:${primaryContactEmail}`}
                          className="text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {primaryContactEmail}
                        </a>
                      </dd>
                    </div>
                  )}
                  {business.website && (
                    <div>
                      <dt className="theme-text-muted text-sm font-medium">Website</dt>
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
                      <dt className="theme-text-muted text-sm font-medium">Social Media</dt>
                      <dd className="mt-1 flex flex-wrap gap-2">
                        {business.contactInfo[0].facebookUrl && (
                          <a
                            href={business.contactInfo[0].facebookUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="theme-badge-info inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-sm font-medium transition-colors hover:brightness-110"
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
                            className="theme-badge-accent inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-sm font-medium transition-colors hover:brightness-110"
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
                            className="theme-badge-info inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-sm font-medium transition-colors hover:brightness-110"
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
                    <dt className="theme-text-muted text-sm font-medium">Website Status</dt>
                    <dd className="mt-1">{getWebsiteStatusBadge(business.websiteStatus)}</dd>
                  </div>
                  <div>
                    <dt className="theme-text-muted text-sm font-medium">Lead Status</dt>
                    <dd className="mt-1">{getLeadStatusBadge(business.leadStatus)}</dd>
                  </div>
                  {business.businessTypes.length > 0 && (
                    <div>
                      <dt className="theme-text-muted text-sm font-medium">Business Types</dt>
                      <dd className="mt-1 text-sm">{business.businessTypes.map(formatGooglePlaceTypeLabel).join(', ')}</dd>
                    </div>
                  )}
                  {business.rating && (
                    <div>
                      <dt className="theme-text-muted text-sm font-medium">Rating</dt>
                      <dd className="mt-1 text-sm">
                        ⭐ {business.rating.toFixed(1)} ({business.reviewCount} reviews)
                      </dd>
                    </div>
                  )}
                  {business.smallBusinessScore && (
                    <div>
                      <dt className="theme-text-muted text-sm font-medium">Small Business Score</dt>
                      <dd className="mt-1 text-sm">{business.smallBusinessScore}</dd>
                    </div>
                  )}
                  {business.placeId && (
                    <div>
                      <dt className="theme-text-muted text-sm font-medium">Google Maps</dt>
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
                      <dt className="theme-text-muted text-sm font-medium">Google Place ID</dt>
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
                              className="theme-input rounded-lg border px-3 py-1 text-sm focus:border-blue-500 focus:outline-none"
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
                    <dt className="theme-text-muted text-sm font-medium">Source</dt>
                    <dd className="mt-1 text-sm">
                      <span className={`inline-flex items-center rounded-md border border-white/10 px-2 py-1 text-xs font-medium ${business.source === 'manual' ? 'theme-badge-accent' : 'theme-badge-info'}`}>
                        {business.source === 'manual' ? 'Manual Entry' : 'Google Maps'}
                      </span>
                    </dd>
                  </div>
                </dl>
              )}
            </div>

            {/* Notes Card */}
            <div className="theme-surface theme-border rounded-2xl border p-6 shadow-sm">
              <LeadCommentsThread
                leadId={leadId}
                currentUserId={session?.user?.id ?? null}
              />
            </div>

            {/* Outreach Timeline Placeholder */}
            <div className="theme-surface theme-border rounded-2xl border p-6 shadow-sm">
              <h2 className="text-lg font-semibold mb-4">Outreach Timeline</h2>
              <p className="theme-text-muted text-sm">
                Timeline will be available once Phase 6 is implemented.
              </p>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Follow-up Card */}
            <div className="theme-surface theme-border rounded-2xl border p-6 shadow-sm">
              <h2 className="text-lg font-semibold mb-4">Follow-up</h2>
              <div className="space-y-4">
                <div>
                  <label className="block theme-text-muted text-sm font-medium mb-1">
                    Next Follow-up Date
                  </label>
                  <input
                    type="date"
                    value={nextFollowupAt}
                    onChange={(e) => setNextFollowupAt(e.target.value)}
                    className="theme-input w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
                {business.lastContactAt && (
                  <div>
                    <dt className="theme-text-muted text-sm font-medium">Last Contact</dt>
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
            <div className="theme-surface theme-border rounded-2xl border p-6 shadow-sm">
              <h2 className="text-lg font-semibold mb-4">Source & Discovery</h2>
              <dl className="space-y-3">
                <div>
                  <dt className="theme-text-muted text-sm font-medium">Source</dt>
                  <dd className="mt-1 text-sm">{business.source.replace('_', ' ')}</dd>
                </div>
                <div>
                  <dt className="theme-text-muted text-sm font-medium">Discovered</dt>
                  <dd className="mt-1 text-sm">
                    {new Date(business.discoveredAt).toLocaleDateString()}
                  </dd>
                </div>
                {business.approvedAt && business.approvedByUser && (
                  <div>
                    <dt className="theme-text-muted text-sm font-medium">Approved</dt>
                    <dd className="mt-1 text-sm">
                      {new Date(business.approvedAt).toLocaleDateString()} by{' '}
                      {business.approvedByUser.name || business.approvedByUser.email}
                    </dd>
                  </div>
                )}
                {business.rejectedAt && business.rejectedByUser && (
                  <div>
                    <dt className="theme-text-muted text-sm font-medium">Rejected</dt>
                    <dd className="mt-1 text-sm">
                      {new Date(business.rejectedAt).toLocaleDateString()} by{' '}
                      {business.rejectedByUser.name || business.rejectedByUser.email}
                    </dd>
                    {business.rejectedReason && (
                      <dd className="theme-text-muted mt-1 text-xs">
                        Reason: {business.rejectedReason}
                      </dd>
                    )}
                  </div>
                )}
                {isClient && business.convertedAt && (
                  <div>
                    <dt className="theme-text-muted text-sm font-medium">Converted To Client</dt>
                    <dd className="mt-1 text-sm">
                      {new Date(business.convertedAt).toLocaleDateString()}
                      {business.convertedByUser && (
                        <>
                          {' '}by {business.convertedByUser.name || business.convertedByUser.email}
                        </>
                      )}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="theme-surface theme-border rounded-2xl border p-6 shadow-sm">
              <h2 className="text-lg font-semibold mb-4">Actions</h2>
              {isClient ? (
                <button
                  onClick={() => router.push(`/clients/${business.id}`)}
                  className="mb-3 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                >
                  View Active Client
                </button>
              ) : (
                <>
                  <button
                    onClick={handleConvertToClient}
                    disabled={!canConvertToClient || convertingToClient}
                    className="mb-2 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-600 disabled:cursor-not-allowed dark:disabled:bg-slate-700 dark:disabled:text-slate-300"
                  >
                    {convertingToClient ? 'Converting...' : 'Convert To Active Client'}
                  </button>
                  {!canConvertToClient && (
                    <p className="theme-text-muted mb-3 text-xs">
                      Lead must have status <span className="font-semibold">approved</span> before conversion.
                    </p>
                  )}
                </>
              )}
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleting || convertingToClient}
                className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:bg-slate-300 disabled:text-slate-600 disabled:cursor-not-allowed dark:disabled:bg-slate-700 dark:disabled:text-slate-300"
              >
                {deleting ? 'Deleting...' : 'Delete Lead'}
              </button>
            </div>
          </div>
        </div>
      </main>

      {showNoWebsiteBlockedPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="theme-surface theme-border w-full max-w-md rounded-2xl border p-6 shadow-xl">
            <h3 className="text-lg font-semibold">Cannot Set &ldquo;No Website&rdquo;</h3>
            <p className="theme-text-muted mt-2 text-sm">
              This lead has a website URL on record. Remove the website URL first before setting the status to &ldquo;No Website&rdquo;.
            </p>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowNoWebsiteBlockedPopup(false)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="theme-surface theme-border w-full max-w-md rounded-2xl border p-6 shadow-xl">
            <h3 className="text-lg font-semibold">Delete Lead</h3>
            <p className="theme-text-muted mt-2 text-sm">
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

