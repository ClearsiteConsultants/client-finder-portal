'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import TopNav from '@/components/TopNav';

type Client = {
  id: string;
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
    createdByUser: { name: string | null } | null;
  }>;
};

type ChecklistItem = {
  id: string;
  occurredAt: string;
  outcome: string | null;
  notes: string | null;
  createdByUser: { name: string | null; email: string | null } | null;
};

export default function ClientDetailPage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams<{ id?: string | string[] }>();
  const clientId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [client, setClient] = useState<Client | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [clientStatus, setClientStatus] = useState('');
  const [subscriptionStatus, setSubscriptionStatus] = useState('');
  const [initialPaymentStatus, setInitialPaymentStatus] = useState('');
  const [nextPaymentDueDate, setNextPaymentDueDate] = useState('');
  const [notes, setNotes] = useState('');

  // Checklist action
  const [showChecklistForm, setShowChecklistForm] = useState(false);
  const [checklistAction, setChecklistAction] = useState('');
  const [checklistNotes, setChecklistNotes] = useState('');

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

  const fetchClient = async () => {
    try {
      const response = await fetch(`/api/clients/${clientId}`);
      if (!response.ok) throw new Error('Failed to fetch client');
      
      const data = await response.json();
      setClient(data.client);
      
      // Initialize form fields
      setClientStatus(data.client.clientStatus || '');
      setSubscriptionStatus(data.client.subscriptionStatus || '');
      setInitialPaymentStatus(data.client.initialPaymentStatus || '');
      setNextPaymentDueDate(data.client.nextPaymentDueDate ? 
        new Date(data.client.nextPaymentDueDate).toISOString().split('T')[0] : '');
      setNotes(data.client.notes || '');
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
      setChecklist(data.checklistEntries);
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
          notes,
        }),
      });

      if (!response.ok) throw new Error('Failed to update client');

      const data = await response.json();
      setClient(data.client);
      alert('Client updated successfully');
    } catch (error) {
      console.error('Error updating client:', error);
      alert('Failed to update client');
    } finally {
      setSaving(false);
    }
  };

  const handleChecklistAction = async () => {
    if (!checklistAction) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/clients/${clientId}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: checklistAction,
          notes: checklistNotes,
        }),
      });

      if (!response.ok) throw new Error('Failed to record checklist action');

      await fetchChecklist();
      setShowChecklistForm(false);
      setChecklistAction('');
      setChecklistNotes('');
      alert('Checklist action recorded');
    } catch (error) {
      console.error('Error recording checklist action:', error);
      alert('Failed to record checklist action');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopNav />
        <div className="flex justify-center items-center h-64">
          <p className="text-gray-500">Loading client...</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopNav />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <p className="text-red-600">Client not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <button
            onClick={() => router.push('/clients')}
            className="text-blue-600 hover:text-blue-800 mb-2"
          >
            ← Back to Active Clients
          </button>
          <h1 className="text-3xl font-bold text-gray-900">{client.name}</h1>
          <p className="text-gray-600">{client.address}</p>
          <p className="text-sm text-gray-500 mt-1">
            Converted on {formatDate(client.convertedAt)}
            {client.convertedByUser && ` by ${client.convertedByUser.name || client.convertedByUser.email}`}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Client Details Form */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Client Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client Status
                  </label>
                  <select
                    value={clientStatus}
                    onChange={(e) => setClientStatus(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">Select status</option>
                    <option value="active">Active</option>
                    <option value="onboarding">Onboarding</option>
                    <option value="needs_review">Needs Review</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subscription Status
                  </label>
                  <select
                    value={subscriptionStatus}
                    onChange={(e) => setSubscriptionStatus(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Initial Payment Status
                  </label>
                  <select
                    value={initialPaymentStatus}
                    onChange={(e) => setInitialPaymentStatus(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">Select status</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Next Payment Due Date
                  </label>
                  <input
                    type="date"
                    value={nextPaymentDueDate}
                    onChange={(e) => setNextPaymentDueDate(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Internal notes about this client..."
                />
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

            {/* Contact Info */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Contact Information</h2>
              {client.contactInfo.length > 0 ? (
                <div className="space-y-2">
                  {client.contactInfo[0].email && (
                    <p><strong>Email:</strong> {client.contactInfo[0].email}</p>
                  )}
                  {client.phone && (
                    <p><strong>Phone:</strong> {client.phone}</p>
                  )}
                  {client.website && (
                    <p>
                      <strong>Website:</strong>{' '}
                      <a href={client.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {client.website}
                      </a>
                    </p>
                  )}
                  {client.contactInfo[0].facebookUrl && (
                    <p>
                      <strong>Facebook:</strong>{' '}
                      <a href={client.contactInfo[0].facebookUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        Profile
                      </a>
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-gray-500">No contact information available</p>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Review Checklist */}
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Review Checklist</h2>
                <button
                  onClick={() => setShowChecklistForm(!showChecklistForm)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  + Add
                </button>
              </div>

              {showChecklistForm && (
                <div className="mb-4 p-4 bg-gray-50 rounded-md">
                  <select
                    value={checklistAction}
                    onChange={(e) => setChecklistAction(e.target.value)}
                    className="w-full mb-2 rounded-md border-gray-300"
                  >
                    <option value="">Select action</option>
                    <option value="subscription_verified">Subscription Verified</option>
                    <option value="initial_payment_confirmed">Initial Payment Confirmed</option>
                    <option value="onboarding_complete">Onboarding Complete</option>
                    <option value="payment_method_updated">Payment Method Updated</option>
                    <option value="billing_issue_resolved">Billing Issue Resolved</option>
                    <option value="client_contacted">Client Contacted</option>
                  </select>
                  <textarea
                    value={checklistNotes}
                    onChange={(e) => setChecklistNotes(e.target.value)}
                    rows={2}
                    placeholder="Optional notes..."
                    className="w-full mb-2 rounded-md border-gray-300"
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={handleChecklistAction}
                      disabled={!checklistAction || saving}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setShowChecklistForm(false);
                        setChecklistAction('');
                        setChecklistNotes('');
                      }}
                      className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {checklist.length > 0 ? (
                <ul className="space-y-2">
                  {checklist.map((item) => (
                    <li key={item.id} className="text-sm border-l-4 border-green-500 pl-3 py-2">
                      <div className="font-medium text-gray-900">
                        {item.outcome?.replace(/_/g, ' ')}
                      </div>
                      {item.notes && (
                        <div className="text-gray-600 text-xs">{item.notes}</div>
                      )}
                      <div className="text-gray-400 text-xs mt-1">
                        {formatDate(item.occurredAt)}
                        {item.createdByUser && ` by ${item.createdByUser.name}`}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">No checklist items yet</p>
              )}
            </div>

            {/* Recent Activity */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
              {client.outreachTracking.length > 0 ? (
                <ul className="space-y-2">
                  {client.outreachTracking.slice(0, 5).map((activity) => (
                    <li key={activity.id} className="text-sm border-l-2 border-gray-300 pl-3 py-1">
                      <div className="text-gray-900">
                        {activity.channel} - {activity.outcome || 'Contact'}
                      </div>
                      <div className="text-gray-400 text-xs">
                        {formatDate(activity.occurredAt)}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">No activity recorded</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
