import { Platform } from 'react-native';

export const colors = {
  red: '#d60000', deepRed: '#a70000', burgundy: '#7c1019', white: '#ffffff',
  ink: '#171717', muted: '#747474', border: '#e8e8e8', surface: '#f8f8f8',
  blush: '#fff0f1', blushStrong: '#f8dfe2', green: '#4c9b5f',
  greenSoft: '#e8f7ec', gold: '#f3a517', graySwitch: '#d9d9d9',
};

export const font = {
  regular: 'Poppins_400Regular', medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold', bold: 'Poppins_700Bold',
};

export const shadow = Platform.select({
  android: { elevation: 3 },
  default: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6 },
});

export const MAX_PHONE_WIDTH = 480;
export const contentPadding = 20;
