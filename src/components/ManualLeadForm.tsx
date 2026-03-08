'use client';

import { useState } from 'react';

type ManualLeadFormData = {
  name: string;
  address: string;
  phone?: string;
  website?: string;
  email?: string;
  instagram?: string;
  facebook?: string;
  twitter?: string;
};

type DuplicateWarning = {
  id: string;
  name: string;
  address: string;
  placeId: string | null;
};

type ManualLeadFormProps = {
  onClose: () => void;
  onSuccess: () => void;
};

export default function ManualLeadForm({ onClose, onSuccess }: ManualLeadFormProps) {
  const [formData, setFormData] = useState<ManualLeadFormData>({
    name: '',
    address: '',
    phone: '',
    website: '',
    email: '',
    instagram: '',
    facebook: '',
    twitter: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateWarning | null>(null);
  const [confirmCreate, setConfirmCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Business name is required';
    }
    
    if (!formData.address.trim()) {
      newErrors.address = 'Address is required';
    }
    
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    
    if (formData.website && !formData.website.match(/^https?:\/\/.+/)) {
      newErrors.website = 'Website must start with http:// or https://';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const checkForDuplicates = async () => {
    try {
      const response = await fetch('/api/leads/check-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          address: formData.address,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.duplicate || null;
      }
    } catch (error) {
      console.error('Error checking duplicates:', error);
    }
    return null;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    
    if (!validateForm()) {
      return;
    }
    
    // Check for duplicates first
    if (!confirmCreate) {
      setSubmitting(true);
      const duplicate = await checkForDuplicates();
      setSubmitting(false);
      
      if (duplicate) {
        setDuplicateWarning(duplicate);
        return;
      }
    }
    
    // Create the lead
    setSubmitting(true);
    try {
      const response = await fetch('/api/leads/create-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      if (response.ok) {
        onSuccess();
      } else {
        const error = await response.json();
        setErrors({ submit: error.message || 'Failed to create lead' });
      }
    } catch (error) {
      console.error('Error creating lead:', error);
      setErrors({ submit: 'Failed to create lead' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmCreate = async () => {
    setConfirmCreate(true);
    setDuplicateWarning(null);
    
    // Create the lead directly
    setSubmitting(true);
    try {
      const response = await fetch('/api/leads/create-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      if (response.ok) {
        onSuccess();
      } else {
        const error = await response.json();
        setErrors({ submit: error.message || 'Failed to create lead' });
      }
    } catch (error) {
      console.error('Error creating lead:', error);
      setErrors({ submit: 'Failed to create lead' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="theme-surface theme-border w-full max-w-2xl rounded-lg border p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Create Manual Lead</h2>
        <p className="theme-text-muted text-sm mb-6">
          Create a business record without a Google Places ID. You can link it to a place_id later if needed.
        </p>
        
        {duplicateWarning && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg dark:bg-yellow-900/20 dark:border-yellow-800">
            <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">⚠️ Potential Duplicate Found</h3>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-2">
              A similar business already exists:
            </p>
            <div className="theme-surface p-3 rounded border border-yellow-300 dark:border-yellow-700 mb-3">
              <p className="font-medium">{duplicateWarning.name}</p>
              <p className="theme-text-muted text-sm">{duplicateWarning.address}</p>
              {duplicateWarning.placeId && (
                <p className="theme-text-muted text-xs mt-1">
                  Place ID: {duplicateWarning.placeId}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleConfirmCreate}
                className="rounded-lg bg-yellow-600 px-4 py-2 text-sm font-semibold text-white hover:bg-yellow-700"
              >
                Create Anyway
              </button>
              <button
                onClick={() => setDuplicateWarning(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-900"
              >
                Go Back & Edit
              </button>
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Required Fields */}
          <div>
            <label htmlFor="business-name" className="block theme-text-muted text-sm font-medium mb-1">
              Business Name <span className="text-red-500">*</span>
            </label>
            <input
              id="business-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={`theme-input w-full rounded-lg border ${errors.name ? 'border-red-500' : 'theme-border'} px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30`}
              placeholder="Enter business name"
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>
          
          <div>
            <label htmlFor="address" className="block theme-text-muted text-sm font-medium mb-1">
              Address <span className="text-red-500">*</span>
            </label>
            <input
              id="address"
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className={`theme-input w-full rounded-lg border ${errors.address ? 'border-red-500' : 'theme-border'} px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30`}
              placeholder="Enter full address"
            />
            {errors.address && <p className="text-xs text-red-500 mt-1">{errors.address}</p>}
          </div>
          
          {/* Optional Contact Fields */}
          <div className="border-t theme-border pt-4">
            <h3 className="theme-text-muted text-sm font-semibold mb-3">Contact Information (Optional)</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="phone" className="block theme-text-muted text-sm font-medium mb-1">Phone</label>
                <input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="theme-input w-full rounded-lg border theme-border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  placeholder="+1 (555) 123-4567"
                />
              </div>
              
              <div>
                <label htmlFor="email" className="block theme-text-muted text-sm font-medium mb-1">Email</label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={`theme-input w-full rounded-lg border ${errors.email ? 'border-red-500' : 'theme-border'} px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30`}
                  placeholder="contact@business.com"
                />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>
            </div>
            
            <div className="mt-4">
              <label htmlFor="website" className="block theme-text-muted text-sm font-medium mb-1">Website</label>
              <input
                id="website"
                type="url"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                className={`theme-input w-full rounded-lg border ${errors.website ? 'border-red-500' : 'theme-border'} px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30`}
                placeholder="https://example.com"
              />
              {errors.website && <p className="text-xs text-red-500 mt-1">{errors.website}</p>}
            </div>
          </div>
          
          {/* Social Media Fields */}
          <div className="border-t theme-border pt-4">
            <h3 className="theme-text-muted text-sm font-semibold mb-3">Social Media (Optional)</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block theme-text-muted text-sm font-medium mb-1">Instagram URL</label>
                <input
                  type="url"
                  value={formData.instagram}
                  onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                  className="theme-input w-full rounded-lg border theme-border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  placeholder="https://instagram.com/business"
                />
              </div>
              
              <div>
                <label className="block theme-text-muted text-sm font-medium mb-1">Facebook URL</label>
                <input
                  type="url"
                  value={formData.facebook}
                  onChange={(e) => setFormData({ ...formData, facebook: e.target.value })}
                  className="theme-input w-full rounded-lg border theme-border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  placeholder="https://facebook.com/business"
                />
              </div>
              
              <div>
                <label className="block theme-text-muted text-sm font-medium mb-1">Twitter/X URL</label>
                <input
                  type="url"
                  value={formData.twitter}
                  onChange={(e) => setFormData({ ...formData, twitter: e.target.value })}
                  className="theme-input w-full rounded-lg border theme-border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  placeholder="https://twitter.com/business"
                />
              </div>
            </div>
          </div>
          
          {errors.submit && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-300">{errors.submit}</p>
            </div>
          )}
          
          <div className="flex gap-2 justify-end pt-4 border-t theme-border">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


