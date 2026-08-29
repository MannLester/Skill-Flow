import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Pressable } from 'react-native';

import AiMentorScreen from '@/app/ai-mentor';
import { AppText } from '@/components/ui';
import { SessionProvider, useSession } from '@/context/session';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: (...args: unknown[]) => mockReplace(...args) },
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
    expect(screen.queryByPlaceholderText('Ask about a project or portfolio…')).toBeNull();
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

  it('preserves the Student prompts and deterministic mentor exchange', async () => {
    const screen = render(<SessionProvider><RoleHarness /></SessionProvider>);
    fireEvent.press(screen.getByText('Use Student'));
    await waitFor(() => expect(screen.getByText('Improve my project idea')).toBeTruthy());
    expect(screen.getByText(/responses are deterministic and do not contact an external AI service/i)).toBeTruthy();
    expect(screen.getByText(/Prompts and conversation history are stored in Convex Cloud/i)).toBeTruthy();
    expect(screen.queryByText(/responses are deterministic, local/i)).toBeNull();

    fireEvent.press(screen.getByText('Suggest color combinations'));
    fireEvent.press(screen.getByRole('button', { name: 'Send mentor question' }));

    expect(screen.getByText('Suggest color combinations')).toBeTruthy();
    expect(screen.getByText(/Start with one primary color/)).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
