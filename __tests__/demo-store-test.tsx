import { fireEvent, render } from '@testing-library/react-native';
import { Pressable, Text, View } from 'react-native';

import { SessionProvider, useSession } from '@/context/session';

function StoreHarness() {
  const { bookings, createBooking, currentAccount, loginAsRole, savedServiceIds, toggleSavedService } = useSession();
  return (
    <View>
      <Text>Account: {currentAccount?.name ?? 'None'}</Text>
      <Text>Bookings: {bookings.length}</Text>
      <Text>Latest: {bookings[0]?.description ?? 'None'}</Text>
      <Text>Logo saved: {savedServiceIds.includes('logo') ? 'Yes' : 'No'}</Text>
      <Pressable onPress={() => loginAsRole('client')}><Text>Use Mark</Text></Pressable>
      <Pressable onPress={() => loginAsRole('student')}><Text>Use Alex</Text></Pressable>
      <Pressable onPress={() => createBooking({ serviceId: 'logo', studentId: 'student-alex', title: 'Logo Design', description: 'Create a coffee shop logo.', deliveryDays: 3, budget: 1500 })}><Text>Create Request</Text></Pressable>
      <Pressable onPress={() => toggleSavedService('logo')}><Text>Toggle Logo</Text></Pressable>
    </View>
  );
}

describe('stateful demo store', () => {
  it('keeps a created booking when switching between demo accounts', () => {
    const screen = render(<SessionProvider><StoreHarness /></SessionProvider>);
    fireEvent.press(screen.getByText('Use Mark'));
    expect(screen.getByText('Account: Mark C.')).toBeTruthy();

    fireEvent.press(screen.getByText('Create Request'));
    expect(screen.getByText('Bookings: 1')).toBeTruthy();
    expect(screen.getByText('Latest: Create a coffee shop logo.')).toBeTruthy();

    fireEvent.press(screen.getByText('Use Alex'));
    expect(screen.getByText('Account: Alex D.')).toBeTruthy();
    expect(screen.getByText('Bookings: 1')).toBeTruthy();
  });

  it('toggles saved services in shared local state', () => {
    const screen = render(<SessionProvider><StoreHarness /></SessionProvider>);
    expect(screen.getByText('Logo saved: Yes')).toBeTruthy();
    fireEvent.press(screen.getByText('Toggle Logo'));
    expect(screen.getByText('Logo saved: No')).toBeTruthy();
  });
});
