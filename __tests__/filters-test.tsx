import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import MarketplaceScreen from '@/app/marketplace';
import { SessionProvider } from '@/context/session';

jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() }, useLocalSearchParams: () => ({}) }));

const renderScreen = (screen: React.ReactElement) => render(<SafeAreaProvider><SessionProvider>{screen}</SessionProvider></SafeAreaProvider>);

describe('hardcoded list filters', () => {
  it('filters marketplace services by category', () => {
    const screen = renderScreen(<MarketplaceScreen />);
    fireEvent.press(screen.getByText('Web & App'));
    expect(screen.getByText('UI/UX Design')).toBeTruthy();
    expect(screen.queryByText('Logo Design')).toBeNull();
  });

  it('opens the selected service by id', () => {
    const { router } = require('expo-router');
    const screen = renderScreen(<MarketplaceScreen />);
    fireEvent.press(screen.getByText('UI/UX Design'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/services/[serviceId]/index', params: { serviceId: 'uiux' } });
  });

  it('filters to saved services with the advanced filter panel', () => {
    const screen = renderScreen(<MarketplaceScreen />);
    fireEvent.press(screen.getByLabelText('Open marketplace filters'));
    fireEvent.press(screen.getByText('Saved services only'));
    expect(screen.getByText('Logo Design')).toBeTruthy();
    expect(screen.queryByText('UI/UX Design')).toBeNull();
  });
});
