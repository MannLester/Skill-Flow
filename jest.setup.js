jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@react-native-async-storage/async-storage', () => {
  const storage = require('@react-native-async-storage/async-storage/jest/async-storage-mock');
  storage.getItem = jest.fn(() => new Promise(() => undefined));
  return storage;
});

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
}));

Object.defineProperty(globalThis, 'fetch', {
  configurable: true,
  writable: true,
  value: jest.fn(),
});

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const Icon = (props) => React.createElement(Text, props, props.name);
  Icon.font = {};
  Icon.glyphMap = {};
  return { Ionicons: Icon };
});

jest.mock('@expo/vector-icons/Ionicons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const Icon = (props) => React.createElement(Text, props, props.name);
  Icon.font = {};
  Icon.glyphMap = {};
  return { __esModule: true, default: Icon };
});

jest.mock('@clerk/expo', () => {
  const React = require('react');
  const success = async () => ({ error: null });
  const setActive = jest.fn(success);
  const startOAuthFlow = jest.fn(async () => ({ createdSessionId: 'sess_mock', setActive }));
  const signIn = {
    status: 'complete',
    password: jest.fn(success),
    finalize: jest.fn(success),
    create: jest.fn(success),
    resetPasswordEmailCode: {
      sendCode: jest.fn(success),
      verifyCode: jest.fn(success),
      submitPassword: jest.fn(success),
    },
  };
  const signUp = {
    status: 'complete',
    create: jest.fn(success),
    finalize: jest.fn(success),
    verifications: {
      sendEmailCode: jest.fn(success),
      verifyEmailCode: jest.fn(success),
    },
  };
  return {
    ClerkProvider: ({ children }) => React.createElement(React.Fragment, null, children),
    ClerkLoaded: ({ children }) => React.createElement(React.Fragment, null, children),
    ClerkLoading: () => null,
    useAuth: () => ({ getToken: jest.fn(), isLoaded: true, isSignedIn: false }),
    useClerk: () => ({ signOut: jest.fn(success) }),
    useOAuth: () => ({ startOAuthFlow }),
    useSignIn: () => ({ signIn, fetchStatus: 'idle' }),
    useSignUp: () => ({ signUp, fetchStatus: 'idle' }),
    useUser: () => ({ user: null }),
  };
});
