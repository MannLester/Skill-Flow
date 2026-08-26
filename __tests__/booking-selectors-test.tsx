import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';

import BookServiceScreen from '@/app/services/[serviceId]/request';
import { SessionProvider, useSession } from '@/context/session';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: (...args: unknown[]) => mockReplace(...args) },
  useLocalSearchParams: () => ({ serviceId: 'logo' }),
}));

function ClientSession({ children }: { children: React.ReactNode }) {
  const { loginAsRole } = useSession();
  useEffect(() => loginAsRole('client'), [loginAsRole]);
  return children;
}

function BookingProbe() {
  const { bookings } = useSession();
  return <Text testID="booking-probe">{JSON.stringify(bookings[0] ?? null)}</Text>;
}

function renderBooking() {
  return render(
    <SafeAreaProvider>
      <SessionProvider>
        <ClientSession>
          <BookServiceScreen />
          <BookingProbe />
        </ClientSession>
      </SessionProvider>
    </SafeAreaProvider>,
  );
}

describe('Book Service selectors', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows the allowed choices, updates state, and keeps only one selector open', async () => {
    const screen = renderBooking();
    await waitFor(() => expect(screen.getByTestId('delivery-selector')).toBeTruthy());

    fireEvent.press(screen.getByTestId('delivery-selector'));
    expect(screen.getByTestId('delivery-selector-option-3')).toBeTruthy();
    expect(screen.getByTestId('delivery-selector-option-5')).toBeTruthy();
    expect(screen.getByTestId('delivery-selector-option-7')).toBeTruthy();

    fireEvent.press(screen.getByTestId('delivery-selector-option-7'));
    expect(screen.getByTestId('delivery-selector').props.accessibilityState).toEqual({ expanded: false });
    expect(screen.getByTestId('delivery-selector').props.accessibilityLabel).toBe('Delivery Time: 7 Days');

    fireEvent.press(screen.getByTestId('budget-selector'));
    expect(screen.getByTestId('budget-selector-option-1500')).toBeTruthy();
    expect(screen.getByTestId('budget-selector-option-2000')).toBeTruthy();
    expect(screen.getByTestId('budget-selector-option-2500')).toBeTruthy();
    expect(screen.queryByTestId('delivery-selector-option-3')).toBeNull();
  });

  it('closes without changing the current value and exposes checked state', async () => {
    const screen = renderBooking();
    await waitFor(() => expect(screen.getByTestId('budget-selector')).toBeTruthy());

    fireEvent.press(screen.getByTestId('budget-selector'));
    expect(screen.getByTestId('budget-selector-option-1500').props.accessibilityState).toEqual({ checked: true });
    fireEvent.press(screen.getByTestId('budget-selector'));
    expect(screen.queryByTestId('budget-selector-option-1500')).toBeNull();
    expect(screen.getByTestId('budget-selector').props.accessibilityLabel).toBe('Budget: ₱1,500');

    fireEvent.press(screen.getByTestId('budget-selector'));
    fireEvent(screen.getByTestId('booking-scroll'), 'touchStart');
    expect(screen.queryByTestId('budget-selector-option-1500')).toBeNull();
  });

  it('passes selected values to the local booking and rejects short descriptions', async () => {
    const screen = renderBooking();
    await waitFor(() => expect(screen.getByTestId('delivery-selector')).toBeTruthy());

    fireEvent.press(screen.getByText('Send Request'));
    expect(screen.getByTestId('booking-probe').props.children).toBe('null');
    expect(screen.getByText('Enter at least 10 characters describing your project.').props.accessibilityRole).toBe('alert');

    fireEvent.changeText(screen.getByPlaceholderText('Describe your project…'), 'Create a complete coffee shop logo.');
    expect(screen.queryByText('Enter at least 10 characters describing your project.')).toBeNull();
    fireEvent.press(screen.getByTestId('delivery-selector'));
    fireEvent.press(screen.getByTestId('delivery-selector-option-5'));
    fireEvent.press(screen.getByTestId('budget-selector'));
    fireEvent.press(screen.getByTestId('budget-selector-option-2000'));
    fireEvent.press(screen.getByText('Send Request'));

    await waitFor(() => expect(screen.getByTestId('booking-probe').props.children).not.toBe('null'));
    expect(screen.getByTestId('booking-probe').props.children).toEqual(expect.stringContaining('"deliveryDays":5'));
    expect(screen.getByTestId('booking-probe').props.children).toEqual(expect.stringContaining('"budget":2000'));
    expect(screen.getByTestId('booking-probe').props.children).toEqual(expect.stringContaining('"description":"Create a complete coffee shop logo."'));
    expect(mockReplace).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/projects/[projectId]' }));
  });
});
