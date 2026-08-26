import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ReactNode, useEffect } from 'react';

import ClientHomeScreen from '@/app/client-home';
import MessagesScreen from '@/app/messages';
import StudentHomeScreen from '@/app/student-home';
import { SessionProvider, useSession } from '@/context/session';
import { PrimaryBottomNav } from '@/navigation/primary-navigation';

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args), replace: (...args: unknown[]) => mockReplace(...args), back: jest.fn() },
}));

function ClientSession({ children }: { children: ReactNode }) {
  const { loginAsRole } = useSession();
  useEffect(() => loginAsRole('client'), [loginAsRole]);
  return children;
}

function ClientConversation({ children }: { children: ReactNode }) {
  const { bookings, createBooking, loginAsRole } = useSession();
  useEffect(() => {
    loginAsRole('client');
    if (!bookings.length) createBooking({ serviceId: 'logo', studentId: 'student-alex', title: 'Logo Design', description: 'Create a coffee shop logo.', deliveryDays: 3, budget: 1500 });
  }, [bookings.length, createBooking, loginAsRole]);
  return children;
}

describe('projects list navigation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('opens the shared projects list from the Student Designer bottom navigation', () => {
    const screen = render(<SessionProvider><PrimaryBottomNav active="home" role="student" /></SessionProvider>);

    fireEvent.press(screen.getByRole('button', { name: 'Projects' }));

    expect(mockReplace).toHaveBeenCalledWith('/projects');
    expect(mockPush).not.toHaveBeenCalledWith('/projects');
  });

  it('opens the shared projects list from the Client bottom navigation', async () => {
    const screen = render(<SessionProvider><ClientSession><ClientHomeScreen /></ClientSession></SessionProvider>);
    await waitFor(() => expect(screen.getByText('Hi, Mark! 👋')).toBeTruthy());

    fireEvent.press(screen.getByText('My\nProjects'));
    expect(mockPush).toHaveBeenCalledWith('/projects');

    const nav = render(<SessionProvider><ClientSession><PrimaryBottomNav active="home" role="client" /></ClientSession></SessionProvider>);
    await waitFor(() => expect(nav.getByRole('button', { name: 'Projects' })).toBeTruthy());
    fireEvent.press(nav.getByRole('button', { name: 'Projects' }));

    expect(mockReplace).toHaveBeenCalledWith('/projects');
  });

  it('uses canonical list routes for Student Designer navigation', () => {
    const screen = render(<SessionProvider><StudentHomeScreen /></SessionProvider>);

    fireEvent.press(screen.getByText('My\nPortfolio'));
    expect(mockPush).toHaveBeenLastCalledWith('/portfolio');

    fireEvent.press(screen.getAllByText('Messages')[0]);
    expect(mockPush).toHaveBeenLastCalledWith('/messages');

    const nav = render(<SessionProvider><PrimaryBottomNav active="home" role="student" /></SessionProvider>);
    fireEvent.press(nav.getByRole('button', { name: 'Profile' }));
    expect(mockReplace).toHaveBeenLastCalledWith('/profile');
  });

  it('uses canonical list routes for Client navigation', async () => {
    const screen = render(<SessionProvider><ClientSession><ClientHomeScreen /></ClientSession></SessionProvider>);
    await waitFor(() => expect(screen.getByText('Hi, Mark! 👋')).toBeTruthy());

    fireEvent.press(screen.getAllByText('Messages')[0]);
    expect(mockPush).toHaveBeenLastCalledWith('/messages');

    const nav = render(<SessionProvider><ClientSession><PrimaryBottomNav active="home" role="client" /></ClientSession></SessionProvider>);
    await waitFor(() => expect(nav.getByRole('button', { name: 'Profile' })).toBeTruthy());
    fireEvent.press(nav.getByRole('button', { name: 'Profile' }));
    expect(mockReplace).toHaveBeenLastCalledWith('/profile');
  });

  it('keeps message list and dynamic thread destinations distinct', async () => {
    const screen = render(<SessionProvider><ClientConversation><MessagesScreen /></ClientConversation></SessionProvider>);
    await waitFor(() => expect(screen.getByText('Logo Design')).toBeTruthy());

    fireEvent.press(screen.getByText('Logo Design'));

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/messages/[projectId]', params: { projectId: expect.any(String) } });
    expect(mockPush).not.toHaveBeenCalledWith('/messages/index');
  });
});
