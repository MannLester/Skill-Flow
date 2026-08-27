import { Image, ImageStyle, StyleProp } from 'react-native';

const serviceSources = {
  logo: require('../../assets/images/optimized/service-logo.jpg'),
  uiux: require('../../assets/images/optimized/service-uiux.jpg'),
  poster: require('../../assets/images/optimized/service-poster.jpg'),
  illustration: require('../../assets/images/optimized/service-illustration.jpg'),
} as const;

export const optimizedArtwork = {
  clientAvatar: require('../../assets/images/optimized/client-avatar.jpg'),
  loginLogo: require('../../assets/images/optimized/login-logo.jpg'),
  whiteLogo: require('../../assets/images/optimized/white logo.png'),
  redLogo: require('../../assets/images/optimized/red logo.png'),
  mentorRobot: require('../../assets/images/optimized/mentor-robot.jpg'),
  serviceHero: require('../../assets/images/optimized/service-hero.jpg'),
  studentAvatar: require('../../assets/images/optimized/student-avatar.jpg'),
  studentProject: require('../../assets/images/optimized/student-project.jpg'),
} as const;

export function OptimizedArtwork({ source, style }: { source: number; style?: StyleProp<ImageStyle> }) {
  return <Image source={source} resizeMode="cover" resizeMethod="resize" fadeDuration={0} style={style} />;
}

export function ServiceArtwork({ serviceId, style }: { serviceId: string; style?: StyleProp<ImageStyle> }) {
  const source = serviceSources[serviceId as keyof typeof serviceSources] ?? serviceSources.logo;
  return <OptimizedArtwork source={source} style={style} />;
}
