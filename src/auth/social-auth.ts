import { makeRedirectUri } from 'expo-auth-session';

export const socialAuthStrategies = {
  google: 'oauth_google',
  facebook: 'oauth_facebook',
} as const;

export type SocialAuthProvider = keyof typeof socialAuthStrategies;

export function socialAuthRedirectUrl() {
  return makeRedirectUri({ scheme: 'skillflow', path: 'oauth-native-callback' });
}
