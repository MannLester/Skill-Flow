import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Pressable } from 'react-native';

import AiMentorScreen from '@/app/ai-mentor';
import { AppText } from '@/components/ui';
import { SessionProvider, useSession } from '@/context/session';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: jest.fn(() => false), push: jest.fn(), replace: (...args: unknown[]) => mockReplace(...args) },
}));

function RoleHarness() {
  const { loginAsRole } = useSession();

  return <>
    <Pressable onPress={() => loginAsRole('student')}><AppText>Use Student</AppText></Pressable>
    <Pressable onPress={() => loginAsRole('client')}><AppText>Use Client</AppText></Pressable>
    <AiMentorScreen />
  </>;
}

describe('AI Mentor role guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  });

  it('replaces the route and never exposes mentor controls to a Client', async () => {
    const screen = render(<SessionProvider><RoleHarness /></SessionProvider>);

    fireEvent.press(screen.getByText('Use Client'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/client-home'));
    expect(screen.queryByText('AI Project Mentor')).toBeNull();
    expect(screen.queryByPlaceholderText('Message your AI mentor…')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send mentor question' })).toBeNull();
  });

  it('guards an in-place Student to Client account switch', async () => {
    const screen = render(<SessionProvider><RoleHarness /></SessionProvider>);
    fireEvent.press(screen.getByText('Use Student'));
    await waitFor(() => expect(screen.getByText('AI Project Mentor')).toBeTruthy());

    fireEvent.press(screen.getByText('Use Client'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/client-home'));
    expect(screen.queryByText('AI Project Mentor')).toBeNull();
  });

  it('discloses Zen data handling and preserves the simulated fallback exchange', async () => {
    const screen = render(<SessionProvider><RoleHarness /></SessionProvider>);
    fireEvent.press(screen.getByText('Use Student'));
    await waitFor(() => expect(screen.getByText('Improve an idea')).toBeTruthy());
    expect(screen.getByText(/don't share sensitive information/i)).toBeTruthy();
    expect(screen.queryByText(/temporary OpenCode Zen models may retain prompts/i)).toBeNull();

    fireEvent.press(screen.getByText(/don't share sensitive information/i));
    expect(screen.getByText(/temporary OpenCode Zen models may retain prompts/i)).toBeTruthy();
    expect(screen.getByText(/A simulated response is used when Zen is unavailable/i)).toBeTruthy();

    fireEvent.press(screen.getByText('Build a palette'));

    await waitFor(() => {
      expect(screen.getAllByText('Suggest a color palette for my project.').length).toBeGreaterThan(0);
      expect(screen.getByText(/Start with one primary color/)).toBeTruthy();
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
