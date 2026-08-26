import { fireEvent, render } from '@testing-library/react-native';
import { FlatList } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import MarketplaceScreen from '@/app/marketplace';
import { SessionProvider } from '@/context/session';

jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() }, useLocalSearchParams: () => ({}) }));

const renderScreen = (screen: React.ReactElement) => render(<SafeAreaProvider><SessionProvider>{screen}</SessionProvider></SafeAreaProvider>);

describe('hardcoded list filters', () => {
  beforeEach(() => jest.clearAllMocks());

  it('filters marketplace services by category', () => {
    const screen = renderScreen(<MarketplaceScreen />);
    fireEvent.press(screen.getByText('Web & App'));
    expect(screen.getByText('UI/UX Design')).toBeTruthy();
    expect(screen.queryByText('Logo Design')).toBeNull();
  });

  it('opens the selected service by id', () => {
    const { router } = jest.requireMock('expo-router') as { router: { push: jest.Mock } };
    const screen = renderScreen(<MarketplaceScreen />);
    fireEvent.press(screen.getByText('UI/UX Design'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/services/[serviceId]', params: { serviceId: 'uiux' } });
  });

  it('filters to saved services with the advanced filter panel', () => {
    const screen = renderScreen(<MarketplaceScreen />);
    fireEvent.press(screen.getByLabelText('Open marketplace filters'));
    fireEvent.press(screen.getByText('Saved services only'));
    expect(screen.getByText('Logo Design')).toBeTruthy();
    expect(screen.queryByText('UI/UX Design')).toBeNull();
  });

  it('keeps the service list inside the visible navigation shell', () => {
    const screen = renderScreen(<MarketplaceScreen />);
    expect(screen.UNSAFE_getByType(FlatList).props.style).toMatchObject({ flex: 1 });
  });

  it('replaces primary destinations instead of pushing tab history', () => {
    const { router } = jest.requireMock('expo-router') as { router: { push: jest.Mock; replace: jest.Mock } };
    const screen = renderScreen(<MarketplaceScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Projects' }));
    expect(router.replace).toHaveBeenCalledWith('/projects');
    expect(router.push).not.toHaveBeenCalledWith('/projects');
  });
});
