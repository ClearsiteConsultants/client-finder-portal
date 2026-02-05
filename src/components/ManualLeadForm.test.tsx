import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ManualLeadForm from './ManualLeadForm';

global.fetch = jest.fn();

describe('ManualLeadForm', () => {
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  it('should render the form with required fields', () => {
    render(<ManualLeadForm onClose={mockOnClose} onSuccess={mockOnSuccess} />);

    expect(screen.getByLabelText(/business name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/address/i)).toBeInTheDocument();
    expect(screen.getByText(/create lead/i)).toBeInTheDocument();
  });

  it('should validate required fields', async () => {
    render(<ManualLeadForm onClose={mockOnClose} onSuccess={mockOnSuccess} />);

    const submitButton = screen.getByText(/create lead/i);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/business name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/address is required/i)).toBeInTheDocument();
    });
  });

  it('should validate email format', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ duplicate: null }),
    });

    render(<ManualLeadForm onClose={mockOnClose} onSuccess={mockOnSuccess} />);

    const nameInput = screen.getByLabelText(/business name/i);
    const addressInput = screen.getByLabelText(/address/i);
    const emailInput = screen.getByLabelText(/email/i);
    
    fireEvent.change(nameInput, { target: { value: 'Test Business' } });
    fireEvent.change(addressInput, { target: { value: '123 Main St' } });
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });

    const submitButton = screen.getByText(/create lead/i);
    fireEvent.click(submitButton);

    // Errors should appear immediately without checking duplicates
    expect(screen.getByText(/invalid email format/i)).toBeInTheDocument();
  });

  it('should validate website URL format', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ duplicate: null }),
    });

    render(<ManualLeadForm onClose={mockOnClose} onSuccess={mockOnSuccess} />);

    const nameInput = screen.getByLabelText(/business name/i);
    const addressInput = screen.getByLabelText(/address/i);
    const websiteInput = screen.getByLabelText(/website/i);
    
    fireEvent.change(nameInput, { target: { value: 'Test Business' } });
    fireEvent.change(addressInput, { target: { value: '123 Main St' } });
    fireEvent.change(websiteInput, { target: { value: 'not-a-url' } });

    const submitButton = screen.getByText(/create lead/i);
    fireEvent.click(submitButton);

    // Errors should appear immediately without checking duplicates
    expect(screen.getByText(/website must start with/i)).toBeInTheDocument();
  });

  it('should check for duplicates before creating', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        duplicate: {
          id: 'existing-123',
          name: 'Existing Business',
          address: '123 Main St',
          placeId: 'place-123',
        },
      }),
    });

    render(<ManualLeadForm onClose={mockOnClose} onSuccess={mockOnSuccess} />);

    const nameInput = screen.getByLabelText(/business name/i);
    const addressInput = screen.getByLabelText(/address/i);

    fireEvent.change(nameInput, { target: { value: 'Existing Business' } });
    fireEvent.change(addressInput, { target: { value: '123 Main St' } });

    const submitButton = screen.getByText(/create lead/i);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/potential duplicate found/i)).toBeInTheDocument();
      expect(screen.getByText('Existing Business')).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/leads/check-duplicate',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: 'Existing Business',
          address: '123 Main St',
        }),
      })
    );
  });

  it('should create lead when no duplicates found', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ duplicate: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

    render(<ManualLeadForm onClose={mockOnClose} onSuccess={mockOnSuccess} />);

    const nameInput = screen.getByLabelText(/business name/i);
    const addressInput = screen.getByLabelText(/address/i);
    const phoneInput = screen.getByLabelText(/phone/i);

    fireEvent.change(nameInput, { target: { value: 'New Business' } });
    fireEvent.change(addressInput, { target: { value: '456 Oak Ave' } });
    fireEvent.change(phoneInput, { target: { value: '+1234567890' } });

    const submitButton = screen.getByText(/create lead/i);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/leads/create-manual',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: 'New Business',
          address: '456 Oak Ave',
          phone: '+1234567890',
          website: '',
          email: '',
          instagram: '',
          facebook: '',
          twitter: '',
        }),
      })
    );
  });

  it('should allow user to confirm creation despite duplicate warning', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          duplicate: {
            id: 'existing-123',
            name: 'Existing Business',
            address: '123 Main St',
            placeId: null,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

    render(<ManualLeadForm onClose={mockOnClose} onSuccess={mockOnSuccess} />);

    const nameInput = screen.getByLabelText(/business name/i);
    const addressInput = screen.getByLabelText(/address/i);

    fireEvent.change(nameInput, { target: { value: 'Existing Business' } });
    fireEvent.change(addressInput, { target: { value: '123 Main St' } });

    const submitButton = screen.getByText(/create lead/i);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/potential duplicate found/i)).toBeInTheDocument();
    });

    const confirmButton = screen.getByText(/create anyway/i);
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('should call onClose when cancel is clicked', () => {
    render(<ManualLeadForm onClose={mockOnClose} onSuccess={mockOnSuccess} />);

    const cancelButton = screen.getByText(/cancel/i);
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });
});
