'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import TopNav from '@/components/TopNav';
import LeadCommentsThread from '@/components/LeadCommentsThread';

type Client = {
  id: string;
  placeId: string | null;
  name: string;
  address: string;
  phone: string | null;
  website: string | null;
  websiteStatus: string;
  clientStatus: string | null;
  subscriptionStatus: string | null;
  initialPaymentStatus: string | null;
  nextPaymentDueDate: string | null;
  convertedAt: string;
  convertedByUser: { name: string | null; email: string | null } | null;
  notes: string | null;
  contactInfo: Array<{
    email: string | null;
    phone: string | null;
    facebookUrl: string | null;
    instagramUrl: string | null;
    linkedinUrl: string | null;
  }>;
  outreachTracking: Array<{
    id: string;
    channel: string;
    occurredAt: string;
    outcome: string | null;
    notes: string | null;
    createdByUser: { name: string | null; email: string | null } | null;
  }>;
};

type ChecklistItem = {
  taskKey: string;
  label: string;
  checked: boolean;
  occurredAt: string | null;
  createdByUser: { name: string | null; email: string | null } | null;
};

export default function ClientDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams<{ id?: string | string[] }>();
  const clientId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [client, setClient] = useState<Client | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [navHeight, setNavHeight] = useState(0);
  const [successBannerVisible, setSuccessBannerVisible] = useState(false);
  const [successBannerMessage, setSuccessBannerMessage] = useState('');
  const hideBannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const removeBannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [clientStatus, setClientStatus] = useState('');
  const [subscriptionStatus, setSubscriptionStatus] = useState('');
  const [initialPaymentStatus, setInitialPaymentStatus] = useState('');
  const [nextPaymentDueDate, setNextPaymentDueDate] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated' && clientId) {
      fetchClient();
      fetchChecklist();
    }
  }, [status, clientId]);

  useEffect(() => {
    return () => {
      if (hideBannerTimeoutRef.current) {
        clearTimeout(hideBannerTimeoutRef.current);
      }
      if (removeBannerTimeoutRef.current) {
        clearTimeout(removeBannerTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const navElement = document.querySelector('header');
    if (!navElement) return;

    const updateNavHeight = () => {
      setNavHeight(navElement.getBoundingClientRect().height);
    };

    updateNavHeight();
    window.addEventListener('resize', updateNavHeight);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateNavHeight);
      resizeObserver.observe(navElement);
    }

    return () => {
      window.removeEventListener('resize', updateNavHeight);
      resizeObserver?.disconnect();
    };
  }, []);

  const showSuccessBanner = (message: string) => {
    if (hideBannerTimeoutRef.current) {
      clearTimeout(hideBannerTimeoutRef.current);
    }
    if (removeBannerTimeoutRef.current) {
      clearTimeout(removeBannerTimeoutRef.current);
    }

    setSuccessBannerMessage(message);
    setSuccessBannerVisible(true);

    hideBannerTimeoutRef.current = setTimeout(() => {
      setSuccessBannerVisible(false);
    }, 2200);

    removeBannerTimeoutRef.current = setTimeout(() => {
      setSuccessBannerVisible(false);
    }, 2800);
  };

  const fetchClient = async () => {
    try {
      const response = await fetch(`/api/clients/${clientId}`);
      if (!response.ok) throw new Error('Failed to fetch client');

      const data = await response.json();
      setClient(data.client);

      setClientStatus(data.client.clientStatus || '');
      setSubscriptionStatus(data.client.subscriptionStatus || '');
      setInitialPaymentStatus(data.client.initialPaymentStatus || '');
      setNextPaymentDueDate(
        data.client.nextPaymentDueDate
          ? new Date(data.client.nextPaymentDueDate).toISOString().split('T')[0]
          : ''
      );
    } catch (error) {
      console.error('Error fetching client:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChecklist = async () => {
    try {
      const response = await fetch(`/api/clients/${clientId}/checklist`);
      if (!response.ok) throw new Error('Failed to fetch checklist');

      const data = await response.json();
      setChecklist(data.tasks ?? []);
    } catch (error) {
      console.error('Error fetching checklist:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientStatus,
          subscriptionStatus,
          initialPaymentStatus,
          nextPaymentDueDate: nextPaymentDueDate ? new Date(nextPaymentDueDate).toISOString() : null,
        }),
      });

      if (!response.ok) throw new Error('Failed to update client');

      const data = await response.json();
      setClient(data.client);
      showSuccessBanner('Client updated successfully');
    } catch (error) {
      console.error('Error updating client:', error);
      alert('Failed to update client');
    } finally {
      setSaving(false);
    }
  };

  const handleChecklistToggle = async (taskKey: string, checked: boolean) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/clients/${clientId}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskKey, checked }),
      });

      if (!response.ok) throw new Error('Failed to update onboarding checklist item');

      await fetchChecklist();
      await fetchClient();
      showSuccessBanner(`Onboarding task ${checked ? 'checked' : 'unchecked'}`);
    } catch (error) {
      console.error('Error updating onboarding checklist:', error);
      alert('Failed to update onboarding checklist item');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatChecklistOutcome = (outcome: string | null) => {
    if (!outcome) return 'Contact';

    return outcome
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const parseOnboardingActivity = (outcome: string | null) => {
    if (!outcome?.startsWith('onboarding_')) {
      return null;
    }

    const [eventType, taskKey] = outcome.split(':');
    if (!taskKey) {
      return null;
    }

    const task = checklist.find((item) => item.taskKey === taskKey);

    return {
      label: task?.label ?? formatChecklistOutcome(taskKey),
      actionText: eventType === 'onboarding_unchecked' ? 'Unchecked' : 'Checked',
    };
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen">
        <TopNav />
        <div className="flex justify-center items-center h-64">
          <p className="theme-text-muted">Loading client...</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen">
        <TopNav />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <p className="text-red-600">Client not found</p>
        </div>
      </div>
    );
  }

  const primaryContact = client.contactInfo[0];
  const contactEmail = primaryContact?.email || null;
  const contactPhone = client.phone || primaryContact?.phone || null;
  const hasSocialLinks = !!(
    primaryContact?.facebookUrl ||
    primaryContact?.instagramUrl ||
    primaryContact?.linkedinUrl
  );
  const googlePlacesUrl = client.placeId
    ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(client.placeId)}`
    : null;
  const hasContactDetails = !!(
    contactEmail ||
    contactPhone ||
    client.website ||
    hasSocialLinks ||
    googlePlacesUrl
  );
  const outreachTracking = client.outreachTracking ?? [];
  const onboardingActivities = outreachTracking.filter((activity) =>
    activity.outcome?.startsWith('onboarding_')
  );

  return (
    <div className="min-h-screen">
      <TopNav />
      <div
        className="fixed inset-x-0 z-50 pointer-events-none"
        style={{ top: navHeight }}
      >
        <div className="w-full">
          <div
            aria-live="polite"
            className={`transition-opacity duration-500 ease-out ${successBannerVisible ? 'opacity-100' : 'opacity-0'}`}
          >
            <div className="w-full bg-green-600 border border-green-600 text-white shadow-sm">
              <div className="px-4 sm:px-6 lg:px-8 py-3 text-center">
                {successBannerMessage}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <button
            onClick={() => router.push('/clients')}
            className="text-blue-600 hover:text-blue-800 mb-2"
          >
            {'<- Back to Active Clients'}
          </button>
          <div>
            <Link
              href={`/leads/${client.id}`}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              View Lead Details
            </Link>
          </div>
          <h1 className="text-3xl font-bold">{client.name}</h1>
          <p className="theme-text-muted">{client.address}</p>
          <p className="theme-text-muted text-sm mt-1">
            Converted on {formatDate(client.convertedAt)}
            {client.convertedByUser && ` by ${client.convertedByUser.name || client.convertedByUser.email}`}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="theme-surface theme-border border shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Client Information</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="theme-text-muted block text-sm font-medium mb-1">
                    Client Status
                  </label>
                  <select
                    value={clientStatus}
                    onChange={(e) => setClientStatus(e.target.value)}
                    className="theme-input w-full rounded-md border px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">Select status</option>
                    <option value="active">Active</option>
                    <option value="onboarding">Onboarding</option>
                    <option value="needs_review">Needs Review</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div>
                  <label className="theme-text-muted block text-sm font-medium mb-1">
                    Subscription Status
                  </label>
                  <select
                    value={subscriptionStatus}
                    onChange={(e) => setSubscriptionStatus(e.target.value)}
                    className="theme-input w-full rounded-md border px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">Select status</option>
                    <option value="active">Active</option>
                    <option value="trial">Trial</option>
                    <option value="past_due">Past Due</option>
                    <option value="payment_failed">Payment Failed</option>
                    <option value="unpaid">Unpaid</option>
                    <option value="canceled">Canceled</option>
                  </select>
                </div>

                <div>
                  <label className="theme-text-muted block text-sm font-medium mb-1">
                    Initial Payment Status
                  </label>
                  <select
                    value={initialPaymentStatus}
                    onChange={(e) => setInitialPaymentStatus(e.target.value)}
                    className="theme-input w-full rounded-md border px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">Select status</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>

                <div>
                  <label className="theme-text-muted block text-sm font-medium mb-1">
                    Next Payment Due Date
                  </label>
                  <input
                    type="date"
                    value={nextPaymentDueDate}
                    onChange={(e) => setNextPaymentDueDate(e.target.value)}
                    className="theme-input w-full rounded-md border px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>

            <div className="theme-surface theme-border border shadow rounded-lg p-6">
              {clientId && (
                <LeadCommentsThread
                  leadId={clientId}
                  currentUserId={session?.user?.id ?? null}
                />
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="theme-surface theme-border border shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Contact Information</h2>
              {hasContactDetails ? (
                <div className="space-y-2">
                  {contactEmail && (
                    <p>
                      <strong>Email:</strong>{' '}
                      <a href={`mailto:${contactEmail}`} className="text-blue-600 hover:underline">
                        {contactEmail}
                      </a>
                    </p>
                  )}
                  {contactPhone && (
                    <p>
                      <strong>Phone:</strong>{' '}
                      <a href={`tel:${contactPhone}`} className="text-blue-600 hover:underline">
                        {contactPhone}
                      </a>
                    </p>
                  )}
                  {client.website && (
                    <p>
                      <strong>Website:</strong>{' '}
                      <a href={client.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {client.website}
                      </a>
                    </p>
                  )}
                  {googlePlacesUrl && (
                    <p>
                      <strong>Google Place:</strong>{' '}
                      <a href={googlePlacesUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        View Listing
                      </a>
                    </p>
                  )}
                  {primaryContact?.facebookUrl && (
                    <p>
                      <strong>Facebook:</strong>{' '}
                      <a href={primaryContact.facebookUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        Profile
                      </a>
                    </p>
                  )}
                  {primaryContact?.instagramUrl && (
                    <p>
                      <strong>Instagram:</strong>{' '}
                      <a href={primaryContact.instagramUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        Profile
                      </a>
                    </p>
                  )}
                  {primaryContact?.linkedinUrl && (
                    <p>
                      <strong>LinkedIn:</strong>{' '}
                      <a href={primaryContact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        Profile
                      </a>
                    </p>
                  )}
                </div>
              ) : (
                <p className="theme-text-muted">No contact information available</p>
              )}
            </div>

            <div className="theme-surface theme-border border shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Onboarding Checklist</h2>
              <div className="max-h-72 overflow-y-auto pr-1">
                {checklist.length > 0 ? (
                  <ul className="space-y-2">
                    {checklist.map((item) => (
                      <li key={item.taskKey} className="theme-surface-muted theme-border border rounded-md px-3 py-2">
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.checked}
                            disabled={saving}
                            onChange={(e) => handleChecklistToggle(item.taskKey, e.target.checked)}
                            className="mt-0.5 h-4 w-4"
                          />
                          <div className="min-w-0 flex-1">
                            <div className={`font-medium text-sm ${item.checked ? 'line-through theme-text-muted' : ''}`}>
                              {item.label}
                            </div>
                            {item.occurredAt && (
                              <div className="theme-text-muted text-xs mt-1">
                                {formatDate(item.occurredAt)}
                                {item.createdByUser && ` by ${item.createdByUser.name || item.createdByUser.email}`}
                              </div>
                            )}
                          </div>
                        </label>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="theme-text-muted text-sm">No onboarding tasks configured</p>
                )}
              </div>
            </div>

            <div className="theme-surface theme-border border shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
              <div className="max-h-72 overflow-y-auto pr-1">
                {onboardingActivities.length > 0 ? (
                  <ul className="space-y-2">
                    {onboardingActivities.map((activity) => {
                      const onboardingActivity = parseOnboardingActivity(activity.outcome);

                      if (!onboardingActivity) {
                        return null;
                      }

                      return (
                        <li key={activity.id} className="text-sm border-l-2 border-gray-300 pl-3 py-1">
                          <div>Onboarding - {onboardingActivity.label}</div>
                          <div className="theme-text-muted text-xs">
                            {onboardingActivity.actionText}
                            {activity.createdByUser?.name ? ` by ${activity.createdByUser.name}` : ''}
                          </div>
                          <div className="theme-text-muted text-xs">{formatDate(activity.occurredAt)}</div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="theme-text-muted text-sm">No activity recorded</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
