import { fireEvent, render } from '@testing-library/react-native';
import { Pressable, Text, View } from 'react-native';
import { useState } from 'react';

import { SessionProvider, useSession } from '@/context/session';

function FinalPhasesHarness() {
  const { changePassword, clearMentorConversation, currentAccount, login, loginAsRole, mentorMessages, preferences, sendMentorMessage, updatePreferences } = useSession();
  const [result, setResult] = useState('none');
  const ownMessages = mentorMessages.filter((item) => item.accountId === currentAccount?.id);
  const show = (value: { ok: boolean; message?: string }) => setResult(value.ok ? 'ok' : value.message ?? 'failed');
  return <View>
    <Text>Account: {currentAccount?.name ?? 'none'}</Text><Text>Result: {result}</Text><Text>Mentor messages: {ownMessages.length}</Text><Text>Reply: {ownMessages.find((item) => item.role === 'mentor')?.body ?? 'none'}</Text><Text>Badges: {preferences.notificationsEnabled ? 'on' : 'off'}</Text><Text>Dark: {preferences.darkMode ? 'on' : 'off'}</Text>
    <Pressable onPress={() => loginAsRole('student')}><Text>Use Alex</Text></Pressable><Pressable onPress={() => loginAsRole('client')}><Text>Use Mark</Text></Pressable>
    <Pressable onPress={() => show(sendMentorMessage('Suggest color combinations'))}><Text>Ask Mentor</Text></Pressable><Pressable onPress={clearMentorConversation}><Text>Clear Mentor</Text></Pressable>
    <Pressable onPress={() => updatePreferences({ notificationsEnabled: false, darkMode: true })}><Text>Update Preferences</Text></Pressable>
    <Pressable onPress={() => show(changePassword('demo123', 'newpass1'))}><Text>Change Password</Text></Pressable><Pressable onPress={() => show(login('alex@skillflow.demo', 'newpass1', 'student'))}><Text>Login New Password</Text></Pressable>
  </View>;
}

describe('persisted mentor and utility preferences', () => {
  it('creates deterministic local mentor responses and isolates them by account', () => {
    const screen = render(<SessionProvider><FinalPhasesHarness /></SessionProvider>);
    fireEvent.press(screen.getByText('Use Alex')); fireEvent.press(screen.getByText('Ask Mentor')); expect(screen.getByText('Mentor messages: 2')).toBeTruthy(); expect(screen.getByText(/Start with one primary color/)).toBeTruthy(); fireEvent.press(screen.getByText('Use Mark')); expect(screen.getByText('Mentor messages: 0')).toBeTruthy(); fireEvent.press(screen.getByText('Use Alex')); expect(screen.getByText('Mentor messages: 2')).toBeTruthy(); fireEvent.press(screen.getByText('Clear Mentor')); expect(screen.getByText('Mentor messages: 0')).toBeTruthy();
  });
  it('updates preferences and changes the local account password', () => {
    const screen = render(<SessionProvider><FinalPhasesHarness /></SessionProvider>);
    fireEvent.press(screen.getByText('Use Alex')); fireEvent.press(screen.getByText('Update Preferences')); expect(screen.getByText('Badges: off')).toBeTruthy(); expect(screen.getByText('Dark: on')).toBeTruthy(); fireEvent.press(screen.getByText('Change Password')); expect(screen.getByText('Result: ok')).toBeTruthy(); fireEvent.press(screen.getByText('Login New Password')); expect(screen.getByText('Account: Alex D.')).toBeTruthy();
  });
});
