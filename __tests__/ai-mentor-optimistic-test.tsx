import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import AiMentorScreen from '@/app/ai-mentor';

const mockSendMentorMessage = jest.fn();
const mockDeleteMentorConversation = jest.fn(async () => ({ ok: true }));
const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockMentorMessages: unknown[] = [];

jest.mock('expo-router', () => ({
  router: { back: (...args: unknown[]) => mockBack(...args), canGoBack: jest.fn(() => false), replace: (...args: unknown[]) => mockReplace(...args) },
}));

jest.mock('@/context/session.remote', () => ({
  useSession: () => ({
    currentAccount: { id: 'student-test', name: 'Clarenz Mauro', role: 'student' },
    createMentorConversation: jest.fn(async () => ({ ok: true, conversationId: 'conversation-new' })),
    deleteMentorConversation: mockDeleteMentorConversation,
    ensureMentorConversation: jest.fn(async () => ({ ok: true, conversationId: 'conversation-1' })),
    hydrated: true,
    mentorConversations: [{ id: 'conversation-1', accountId: 'student-test', title: 'New chat', createdAt: '2026-09-02T00:00:00.000Z', updatedAt: '2026-09-02T00:00:00.000Z' }],
    mentorMessages: mockMentorMessages,
    sendMentorMessage: mockSendMentorMessage,
  }),
}));

describe('AI Mentor optimistic chat UX', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMentorMessages = [];
  });

  it('shows the user message and thinking state before the provider responds', async () => {
    let finishRequest: ((result: { ok: false; message: string }) => void) | undefined;
    mockSendMentorMessage.mockImplementation(() => new Promise((resolve) => { finishRequest = resolve; }));
    const screen = render(<AiMentorScreen />);

    expect(screen.getByText('How can I help, Clarenz?')).toBeTruthy();
    expect(screen.getByText('Improve an idea')).toBeTruthy();

    fireEvent.changeText(screen.getByPlaceholderText('Message your AI mentor…'), 'Help me plan a case study.');
    fireEvent.press(screen.getByRole('button', { name: 'Send mentor question' }));

    expect(screen.getByText('Help me plan a case study.')).toBeTruthy();
    expect(screen.getByLabelText('Mentor is thinking')).toBeTruthy();
    expect(screen.queryByText('Improve an idea')).toBeNull();
    expect(screen.getByPlaceholderText('You can type your next message…').props.value).toBe('');

    await act(async () => finishRequest?.({ ok: false, message: 'Please try again.' }));
    await waitFor(() => expect(screen.getByText('Please try again.')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('falls back to Student Home when the route has no back stack', () => {
    const screen = render(<AiMentorScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Go back' }));
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/student-home');
  });

  it('confirms before deleting a chat from Your chats', async () => {
    const screen = render(<AiMentorScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'Open chat history' }));
    fireEvent.press(screen.getByRole('button', { name: 'Delete chat New chat' }));
    expect(screen.getByText('Delete this chat?')).toBeTruthy();
    expect(mockDeleteMentorConversation).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: 'Confirm delete chat' }));

    await waitFor(() => expect(mockDeleteMentorConversation).toHaveBeenCalledWith('conversation-1'));
  });

  it('offers numbered question choices and sends the selected answer', async () => {
    mockMentorMessages = [{
      id: 'mentor-question-1',
      accountId: 'student-test',
      conversationId: 'conversation-1',
      role: 'mentor',
      body: 'Choose a direction.',
      createdAt: '2026-09-02T00:00:01.000Z',
      question: {
        topic: 'goal',
        text: 'What would you like to work on next?',
        options: [
          { label: 'Build something', recommended: true },
          { label: 'Research something', recommended: false },
        ],
      },
    }];
    mockSendMentorMessage.mockResolvedValue({ ok: true });
    const screen = render(<AiMentorScreen />);

    expect(screen.getByText('What would you like to work on next?')).toBeTruthy();
    expect(screen.getByText('Build something (Recommended)')).toBeTruthy();
    expect(screen.getByText('Or type a different answer below.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Answer Build something' }));

    await waitFor(() => expect(mockSendMentorMessage).toHaveBeenCalledWith('Build something', expect.any(String), 'conversation-1'));
  });
});
