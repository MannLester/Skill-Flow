import { Redirect } from 'expo-router';

export default function LegacyServiceDetailsRedirect() {
  return <Redirect href={{ pathname: '/services/[serviceId]', params: { serviceId: 'logo' } }} />;
}
