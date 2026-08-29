import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';

import { SessionProvider, useNavigationSession, useSession } from '@/context/session';

function NavigationHarness() {
  const { hydrated, loginAsRole } = useSession();
  const navigation = useNavigationSession();
  return <View>
    <Text testID="hydrated">{String(hydrated)}</Text>
    <Text testID="navigation-account">{navigation.currentAccount?.id ?? 'none'}</Text>
    <Text testID="navigation-role">{navigation.role}</Text>
    <Text testID="navigation-unread">{String(navigation.messageUnread)}</Text>
    <Pressable testID="use-client" onPress={() => loginAsRole('client')}><Text>Use client</Text></Pressable>
    <Pressable testID="use-student" onPress={() => loginAsRole('student')}><Text>Use student</Text></Pressable>
  </View>;
}

const navigationRenderSpy = jest.fn();
const markerRenderSpy = jest.fn();

function NavigationProbe() {
  useEffect(() => { navigationRenderSpy(); });
  const { currentAccount, messageUnread, role } = useNavigationSession();
  return <View>
    <Text testID="probe-account">{currentAccount?.id ?? 'none'}</Text>
    <Text testID="probe-role">{role}</Text>
    <Text testID="probe-unread">{String(messageUnread)}</Text>
  </View>;
}

function PreferenceHarness() {
  const { hydrated, updatePreferences } = useSession();
  return <View>
    <Text testID="hydrated">{String(hydrated)}</Text>
    <Pressable testID="toggle-preference" onPress={() => updatePreferences({ darkMode: true })}><Text>Toggle preference</Text></Pressable>
  </View>;
}

function MarkerHarness() {
  useEffect(() => { markerRenderSpy(); });
  const { bookings, createBooking, hydrated, loginAsRole, markNotificationRead, markProjectMessagesRead, notifications, sendMessage } = useSession();
  const navigation = useNavigationSession();
  const booking = bookings[0];
  const messageNotification = notifications.find((item) => item.kind === 'message');
  return <View>
    <Text testID="hydrated">{String(hydrated)}</Text>
    <Text testID="navigation-unread">{String(navigation.messageUnread)}</Text>
    <Text testID="booking-id">{booking?.id ?? 'none'}</Text>
    <Text testID="message-notification-id">{messageNotification?.id ?? 'none'}</Text>
    <Pressable testID="marker-use-client" onPress={() => loginAsRole('client')}><Text>Use client</Text></Pressable>
    <Pressable testID="marker-use-student" onPress={() => loginAsRole('student')}><Text>Use student</Text></Pressable>
    <Pressable testID="create-booking" onPress={() => createBooking({ serviceId: 'logo', studentId: 'student-alex', title: 'Logo Design', description: 'Create a coffee shop logo.', deliveryDays: 3, budget: 1500 })}><Text>Create booking</Text></Pressable>
    <Pressable testID="send-message" disabled={!booking} onPress={() => booking && sendMessage(booking.id, 'Hello from the client.')}><Text>Send message</Text></Pressable>
    <Pressable testID="mark-notification" disabled={!messageNotification} onPress={() => messageNotification && markNotificationRead(messageNotification.id)}><Text>Mark notification</Text></Pressable>
    <Pressable testID="mark-project-messages" disabled={!booking} onPress={() => booking && markProjectMessagesRead(booking.id)}><Text>Mark project messages</Text></Pressable>
  </View>;
}

async function settleHydration(screen: ReturnType<typeof render>) {
  await waitFor(() => expect(screen.getByTestId('hydrated')).toHaveTextContent('true'));
  await act(async () => { jest.runOnlyPendingTimers(); await Promise.resolve(); await Promise.resolve(); });
  jest.mocked(AsyncStorage.setItem).mockClear();
}

async function flushDeferredPersistence() {
  await act(async () => {
    jest.advanceTimersByTime(100);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('session performance boundaries', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    jest.mocked(AsyncStorage.setItem).mockResolvedValue(undefined);
    jest.mocked(AsyncStorage.removeItem).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('keeps the navigation context narrow and coalesces to the latest state snapshot', async () => {
    const screen = render(<SessionProvider><NavigationHarness /></SessionProvider>);
    await settleHydration(screen);

    fireEvent.press(screen.getByTestId('use-client'));
    fireEvent.press(screen.getByTestId('use-student'));
    expect(screen.getByTestId('navigation-account')).toHaveTextContent('student-alex');
    expect(screen.getByTestId('navigation-role')).toHaveTextContent('student');
    expect(jest.mocked(AsyncStorage.setItem)).not.toHaveBeenCalled();

    await flushDeferredPersistence();
    expect(jest.mocked(AsyncStorage.setItem)).toHaveBeenCalledTimes(1);
    const [, serialized] = jest.mocked(AsyncStorage.setItem).mock.calls[0];
    expect(JSON.parse(serialized as string).currentAccountId).toBe('student-alex');
  });

  it('does not re-render navigation consumers for unrelated session updates', async () => {
    const screen = render(<SessionProvider><><PreferenceHarness /><NavigationProbe /></></SessionProvider>);
    await settleHydration(screen);
    const before = navigationRenderSpy.mock.calls.length;

    fireEvent.press(screen.getByTestId('toggle-preference'));

    expect(navigationRenderSpy).toHaveBeenCalledTimes(before);
  });

  it('returns the same state for repeated notification and project-message read marks', async () => {
    const screen = render(<SessionProvider><MarkerHarness /></SessionProvider>);
    await settleHydration(screen);

    fireEvent.press(screen.getByTestId('marker-use-client'));
    fireEvent.press(screen.getByTestId('create-booking'));
    fireEvent.press(screen.getByTestId('send-message'));
    fireEvent.press(screen.getByTestId('marker-use-student'));
    expect(screen.getByTestId('message-notification-id')).not.toHaveTextContent('none');
    expect(screen.getByTestId('navigation-unread')).toHaveTextContent('true');

    const beforeNotificationMark = markerRenderSpy.mock.calls.length;
    fireEvent.press(screen.getByTestId('mark-notification'));
    const afterNotificationMark = markerRenderSpy.mock.calls.length;
    expect(afterNotificationMark).toBeGreaterThan(beforeNotificationMark);
    fireEvent.press(screen.getByTestId('mark-notification'));
    expect(markerRenderSpy).toHaveBeenCalledTimes(afterNotificationMark);

    const beforeProjectMark = markerRenderSpy.mock.calls.length;
    fireEvent.press(screen.getByTestId('mark-project-messages'));
    const afterProjectMark = markerRenderSpy.mock.calls.length;
    expect(afterProjectMark).toBeGreaterThan(beforeProjectMark);
    expect(screen.getByTestId('navigation-unread')).toHaveTextContent('false');
    fireEvent.press(screen.getByTestId('mark-project-messages'));
    expect(markerRenderSpy).toHaveBeenCalledTimes(afterProjectMark);
  });
});
