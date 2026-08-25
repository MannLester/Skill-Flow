import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ReactNode, useEffect } from 'react';

import ClientHomeScreen from '@/app/client-home';
import StudentHomeScreen from '@/app/student-home';
import { SessionProvider, useSession } from '@/context/session';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args), replace: jest.fn(), back: jest.fn() },
}));

function ClientSession({ children }: { children: ReactNode }) {
  const { loginAsRole } = useSession();
  useEffect(() => loginAsRole('client'), [loginAsRole]);
  return children;
}

describe('projects list navigation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('opens the shared projects list from the Student Designer bottom navigation', () => {
    const screen = render(<SessionProvider><StudentHomeScreen /></SessionProvider>);

    fireEvent.press(screen.getByRole('button', { name: 'Projects' }));

    expect(mockPush).toHaveBeenCalledWith('/projects');
  });

  it('opens the shared projects list from the Client bottom navigation', async () => {
    const screen = render(<SessionProvider><ClientSession><ClientHomeScreen /></ClientSession></SessionProvider>);
    await waitFor(() => expect(screen.getByText('Hi, Mark! 👋')).toBeTruthy());

    fireEvent.press(screen.getByText('My\nProjects'));
    expect(mockPush).toHaveBeenCalledWith('/projects');

    mockPush.mockClear();
    fireEvent.press(screen.getByRole('button', { name: 'Projects' }));

    expect(mockPush).toHaveBeenCalledWith('/projects');
  });
});
