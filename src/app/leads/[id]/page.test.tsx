import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import LeadDetailPage from './page';

// Mock next-auth
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useParams: jest.fn(),
}));

// Mock the TopNav component
jest.mock('@/components/TopNav', () => {
  return function MockTopNav() {
    return <div data-testid="top-nav">TopNav</div>;
  };
});

jest.mock('@/components/LeadCommentsThread', () => {
  return function MockLeadCommentsThread() {
    return <div data-testid="lead-comments-thread">Comments</div>;
  };
});

global.fetch = jest.fn();

describe('LeadDetailPage', () => {
  const mockPush = jest.fn();
  const mockRouter = {
    push: mockPush,
  };

  const mockBusiness = {
    id: 'business-123',
    placeId: 'place-123',
    name: 'Test Business Inc',
    address: '123 Main St, City, State 12345',
    lat: '40.7128',
    lng: '-74.0060',
    phone: '555-1234',
    website: 'https://testbusiness.com',
    businessTypes: ['retail', 'e-commerce'],
    rating: 4.5,
    reviewCount: 128,
    smallBusinessScore: 85,
    websiteStatus: 'acceptable',
    leadStatus: 'pending',
    source: 'google_maps',
    discoveredAt: '2026-01-15T10:00:00Z',
    approvedAt: null,
    approvedByUser: null,
    rejectedAt: null,
    rejectedByUser: null,
    rejectedReason: null,
    lastContactAt: null,
    nextFollowupAt: null,
    notes: null,
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-01-15T10:00:00Z',
    isClient: false,
    convertedAt: null,
    clientStatus: null,
    convertedByUser: null,
    contactInfo: [
      {
        id: 'contact-123',
        email: null,
        phone: null,
        facebookUrl: 'https://facebook.com/testbusiness',
        instagramUrl: 'https://instagram.com/testbusiness',
        linkedinUrl: null,
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { id: 'user-1' } },
    });
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useParams as jest.Mock).mockReturnValue({ id: 'business-123' });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockBusiness,
    });
  });

  it('should render the lead detail page when authenticated', async () => {
    render(<LeadDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Business Inc')).toBeInTheDocument();
      expect(screen.getByText('Business Information')).toBeInTheDocument();
    });
  });

  it('should display the pencil icon for editing business info', async () => {
    render(<LeadDetailPage />);

    await waitFor(() => {
      const editButton = screen.getByTitle('Edit Business Information');
      expect(editButton).toBeInTheDocument();
    });
  });

  it('should display email in business info when available in any contact record', async () => {
    const businessWithSecondaryEmail = {
      ...mockBusiness,
      contactInfo: [
        {
          id: 'contact-1',
          email: null,
          phone: null,
          facebookUrl: null,
          instagramUrl: null,
          linkedinUrl: null,
        },
        {
          id: 'contact-2',
          email: 'owner@testbusiness.com',
          phone: null,
          facebookUrl: null,
          instagramUrl: null,
          linkedinUrl: null,
        },
      ],
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => businessWithSecondaryEmail,
    });

    render(<LeadDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'owner@testbusiness.com' })).toHaveAttribute(
        'href',
        'mailto:owner@testbusiness.com',
      );
    });
  });

  it('should prefer website-domain email when multiple emails exist', async () => {
    const businessWithTelemetryAndDomainEmail = {
      ...mockBusiness,
      website: 'https://www.eventsatmagnolia.com/',
      contactInfo: [
        {
          id: 'contact-telemetry',
          email: '605a7baede844d278b89dc95ae0a9123@sentry-next.wixpress.com',
          phone: null,
          facebookUrl: null,
          instagramUrl: null,
          linkedinUrl: null,
        },
        {
          id: 'contact-domain',
          email: 'info@eventsatmagnolia.com',
          phone: null,
          facebookUrl: null,
          instagramUrl: null,
          linkedinUrl: null,
        },
      ],
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => businessWithTelemetryAndDomainEmail,
    });

    render(<LeadDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'info@eventsatmagnolia.com' })).toHaveAttribute(
        'href',
        'mailto:info@eventsatmagnolia.com',
      );
    });
  });

  it('should show edit form when pencil icon is clicked', async () => {
    render(<LeadDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Business Inc')).toBeInTheDocument();
    });

    const editButton = screen.getByTitle('Edit Business Information');
    fireEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByDisplayValue('123 Main St, City, State 12345')).toBeInTheDocument();
      expect(screen.getByDisplayValue('555-1234')).toBeInTheDocument();
      expect(screen.getByDisplayValue('https://testbusiness.com')).toBeInTheDocument();
    });
  });

  it('should populate edit form with current business data', async () => {
    render(<LeadDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Business Inc')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Edit Business Information'));

    await waitFor(() => {
      const addressInput = screen.getByDisplayValue('123 Main St, City, State 12345') as HTMLInputElement;
      const phoneInput = screen.getByDisplayValue('555-1234') as HTMLInputElement;
      const websiteInput = screen.getByDisplayValue('https://testbusiness.com') as HTMLInputElement;
      const ratingInput = screen.getByDisplayValue('4.5') as HTMLInputElement;

      expect(addressInput).toBeInTheDocument();
      expect(phoneInput).toBeInTheDocument();
      expect(websiteInput).toBeInTheDocument();
      expect(ratingInput).toBeInTheDocument();
    });
  });

  it('should populate business types field correctly', async () => {
    render(<LeadDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Business Inc')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Edit Business Information'));

    await waitFor(() => {
      const businessTypesButton = screen.getByRole('button', { name: 'Business Types dropdown' });
      expect(businessTypesButton).toBeInTheDocument();
      expect(businessTypesButton).toHaveTextContent('Retail, E-commerce');
      expect(screen.queryByLabelText('Retail')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Business Types dropdown' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Retail')).toBeChecked();
      expect(screen.getByLabelText('E-commerce')).toBeChecked();
      expect(screen.getByLabelText('Store')).not.toBeChecked();
    });
  });

  it('should populate lead status select correctly', async () => {
    render(<LeadDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Business Inc')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Edit Business Information'));

    await waitFor(() => {
      const leadStatusSelect = screen.getByDisplayValue('Pending') as HTMLSelectElement;
      expect(leadStatusSelect).toBeInTheDocument();
      expect(leadStatusSelect.value).toBe('pending');
    });
  });

  it('should allow editing address field', async () => {
    render(<LeadDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Business Inc')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Edit Business Information'));

    await waitFor(() => {
      expect(screen.getByDisplayValue('123 Main St, City, State 12345')).toBeInTheDocument();
    });

    const addressInput = screen.getByDisplayValue('123 Main St, City, State 12345') as HTMLInputElement;
    fireEvent.change(addressInput, { target: { value: '456 Oak Ave, New City, ST 54321' } });

    expect(addressInput.value).toBe('456 Oak Ave, New City, ST 54321');
  });

  it('should allow editing phone field', async () => {
    render(<LeadDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Business Inc')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Edit Business Information'));

    await waitFor(() => {
      expect(screen.getByDisplayValue('555-1234')).toBeInTheDocument();
    });

    const phoneInput = screen.getByDisplayValue('555-1234') as HTMLInputElement;
    fireEvent.change(phoneInput, { target: { value: '555-9999' } });

    expect(phoneInput.value).toBe('555-9999');
  });

  it('should allow editing email field', async () => {
    const businessWithEmail = {
      ...mockBusiness,
      contactInfo: [
        {
          id: 'contact-123',
          email: 'owner@testbusiness.com',
          phone: null,
          facebookUrl: null,
          instagramUrl: null,
          linkedinUrl: null,
        },
      ],
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => businessWithEmail,
    });

    render(<LeadDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Business Inc')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Edit Business Information'));

    await waitFor(() => {
      expect(screen.getByDisplayValue('owner@testbusiness.com')).toBeInTheDocument();
    });

    const emailInput = screen.getByDisplayValue('owner@testbusiness.com') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'contact@testbusiness.com' } });

    expect(emailInput.value).toBe('contact@testbusiness.com');
  });

  it('should allow editing website field', async () => {
    render(<LeadDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Business Inc')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Edit Business Information'));

    await waitFor(() => {
      expect(screen.getByDisplayValue('https://testbusiness.com')).toBeInTheDocument();
    });

    const websiteInput = screen.getByDisplayValue('https://testbusiness.com') as HTMLInputElement;
    fireEvent.change(websiteInput, { target: { value: 'https://newsite.com' } });

    expect(websiteInput.value).toBe('https://newsite.com');
  });

  it('should allow editing lead status', async () => {
    render(<LeadDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Business Inc')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Edit Business Information'));

    await waitFor(() => {
      expect(screen.getByDisplayValue('Pending')).toBeInTheDocument();
    });

    const statusSelect = screen.getByDisplayValue('Pending') as HTMLSelectElement;
    fireEvent.change(statusSelect, { target: { value: 'approved' } });

    expect(statusSelect.value).toBe('approved');
  });

  it('should allow editing business types', async () => {
    render(<LeadDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Business Inc')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Edit Business Information'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Business Types dropdown' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Business Types dropdown' }));

    const ecommerceCheckbox = screen.getByLabelText('E-commerce') as HTMLInputElement;
    const storeCheckbox = screen.getByLabelText('Store') as HTMLInputElement;

    fireEvent.click(ecommerceCheckbox);
    fireEvent.click(storeCheckbox);

    const businessTypesButton = screen.getByRole('button', { name: 'Business Types dropdown' });
    expect(businessTypesButton).toHaveTextContent('Retail, Store');
  });

  it('should allow editing rating', async () => {
    render(<LeadDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Business Inc')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Edit Business Information'));

    await waitFor(() => {
      expect(screen.getByDisplayValue('4.5')).toBeInTheDocument();
    });

    const ratingInput = screen.getByDisplayValue('4.5') as HTMLInputElement;
    fireEvent.change(ratingInput, { target: { value: '4.8' } });

    expect(ratingInput.value).toBe('4.8');
  });

  it('should send PATCH request with updated values on save', async () => {
    render(<LeadDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Business Inc')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Edit Business Information'));

    await waitFor(() => {
      expect(screen.getByDisplayValue('123 Main St, City, State 12345')).toBeInTheDocument();
    });

    const addressInput = screen.getByDisplayValue('123 Main St, City, State 12345') as HTMLInputElement;
    fireEvent.change(addressInput, { target: { value: '789 Elm St' } });

    const statusSelect = screen.getByDisplayValue('Pending') as HTMLSelectElement;
    fireEvent.change(statusSelect, { target: { value: 'approved' } });

    const ratingInput = screen.getByDisplayValue('4.5') as HTMLInputElement;
    fireEvent.change(ratingInput, { target: { value: '4.9' } });

    // Reset mock to verify the PATCH call
    (global.fetch as jest.Mock).mockClear();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...mockBusiness,
        address: '789 Elm St',
        leadStatus: 'approved',
        rating: 4.9,
      }),
    });

    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    await waitFor(() => {
      const fetchMock = global.fetch as jest.Mock;
      expect(fetchMock).toHaveBeenCalled();
      const patchCall = [...fetchMock.mock.calls].reverse().find(
        ([url, options]) =>
          url === '/api/leads/business-123' && options && options.method === 'PATCH',
      );
      expect(patchCall).toBeDefined();
      const [, options] = patchCall as [RequestInfo | URL, RequestInit];
      const payload = JSON.parse(options.body as string);
      expect(payload.address).toBe('789 Elm St');
      expect(payload.phone).toBe('555-1234');
      expect(payload.website).toBe('https://testbusiness.com');
      expect(payload.leadStatus).toBe('approved');
      expect(payload.businessTypes).toEqual(['retail', 'e-commerce']);
      expect(payload.rating).toBe(4.9);
    });
  });

  it('should cancel edit mode when Cancel button is clicked', async () => {
    render(<LeadDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Business Inc')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Edit Business Information'));

    await waitFor(() => {
      expect(screen.getByDisplayValue('123 Main St, City, State 12345')).toBeInTheDocument();
    });

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByDisplayValue('123 Main St, City, State 12345')).not.toBeInTheDocument();
      expect(screen.getByText('123 Main St, City, State 12345')).toBeInTheDocument(); // In non-input form
    });
  });

  it('should validate address is required', async () => {
    render(<LeadDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Business Inc')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Edit Business Information'));

    await waitFor(() => {
      expect(screen.getByDisplayValue('123 Main St, City, State 12345')).toBeInTheDocument();
    });

    const addressInput = screen.getByDisplayValue('123 Main St, City, State 12345') as HTMLInputElement;
    fireEvent.change(addressInput, { target: { value: '' } });

    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Address is required')).toBeInTheDocument();
    });
  });

  it('should validate website URL format', async () => {
    render(<LeadDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Business Inc')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Edit Business Information'));

    await waitFor(() => {
      expect(screen.getByDisplayValue('https://testbusiness.com')).toBeInTheDocument();
    });

    const websiteInput = screen.getByDisplayValue('https://testbusiness.com') as HTMLInputElement;
    fireEvent.change(websiteInput, { target: { value: 'not-a-url' } });

    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Website must start with http:// or https://')).toBeInTheDocument();
    });
  });

  it('should disable convert button when lead is not approved', async () => {
    render(<LeadDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Business Inc')).toBeInTheDocument();
    });

    const convertButton = screen.getByRole('button', { name: 'Convert To Active Client' });
    expect(convertButton).toBeDisabled();
    expect(screen.getByText(/Lead must have status/i)).toBeInTheDocument();
  });

  it('should enable convert button for approved lead and call conversion endpoint', async () => {
    const approvedBusiness = {
      ...mockBusiness,
      leadStatus: 'approved',
    };

    (global.fetch as jest.Mock).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/api/leads/convert-to-client')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            business: {
              ...approvedBusiness,
              isClient: true,
              clientStatus: 'active',
              convertedAt: '2026-02-05T12:00:00Z',
              convertedByUser: {
                id: 'user-1',
                name: 'Test User',
                email: 'test@example.com',
              },
            },
          }),
        };
      }

      return {
        ok: true,
        json: async () => approvedBusiness,
      };
    });

    render(<LeadDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Business Inc')).toBeInTheDocument();
    });

    const convertButton = screen.getByRole('button', { name: 'Convert To Active Client' });
    expect(convertButton).toBeEnabled();

    fireEvent.click(convertButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/leads/convert-to-client',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
      expect(mockPush).toHaveBeenCalledWith('/clients/business-123');
    });
  });

  it('should handle business types as multi-select values', async () => {
    render(<LeadDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Business Inc')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Edit Business Information'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Business Types dropdown' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Business Types dropdown' }));

    const ecommerceCheckbox = screen.getByLabelText('E-commerce') as HTMLInputElement;
    const storeCheckbox = screen.getByLabelText('Store') as HTMLInputElement;
    const healthCheckbox = screen.getByLabelText('Health') as HTMLInputElement;

    fireEvent.click(ecommerceCheckbox);
    fireEvent.click(storeCheckbox);
    fireEvent.click(healthCheckbox);

    // Reset mock to verify correct selected values are sent
    (global.fetch as jest.Mock).mockClear();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...mockBusiness,
        businessTypes: ['retail', 'store', 'health'],
      }),
    });

    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    await waitFor(() => {
      const fetchMock = global.fetch as jest.Mock;
      expect(fetchMock).toHaveBeenCalled();
      const patchCall = [...fetchMock.mock.calls].reverse().find(
        ([url, options]) =>
          url === '/api/leads/business-123' && options && options.method === 'PATCH',
      );
      expect(patchCall).toBeDefined();
      const [, options] = patchCall as [RequestInfo | URL, RequestInit];
      const payload = JSON.parse(options.body as string);
      expect(payload.businessTypes).toHaveLength(3);
      expect(payload.businessTypes).toEqual(expect.arrayContaining(['retail', 'store', 'health']));
    });
  });

  it('should return to view mode after successful save', async () => {
    render(<LeadDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Business Inc')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Edit Business Information'));

    await waitFor(() => {
      expect(screen.getByDisplayValue('123 Main St, City, State 12345')).toBeInTheDocument();
    });

    (global.fetch as jest.Mock).mockClear();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockBusiness,
    });

    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.queryByDisplayValue('123 Main St, City, State 12345')).not.toBeInTheDocument();
      expect(screen.getByText('123 Main St, City, State 12345')).toBeInTheDocument();
    });
  });
});
