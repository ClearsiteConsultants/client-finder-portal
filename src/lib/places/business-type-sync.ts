export const BUSINESS_TYPE_OPTIONS_UPDATED_EVENT = 'client-finder:business-type-options-updated';
export const BUSINESS_TYPE_OPTIONS_UPDATED_STORAGE_KEY = 'client-finder:business-type-options-updated-at';

export function notifyBusinessTypeOptionsUpdated() {
  if (typeof window === 'undefined') {
    return;
  }

  const timestamp = Date.now().toString();

  window.dispatchEvent(new CustomEvent(BUSINESS_TYPE_OPTIONS_UPDATED_EVENT, {
    detail: { timestamp },
  }));

  try {
    window.localStorage.setItem(BUSINESS_TYPE_OPTIONS_UPDATED_STORAGE_KEY, timestamp);
  } catch {
    // Ignore storage failures and still rely on the in-tab custom event.
  }
}