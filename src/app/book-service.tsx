import { Redirect } from 'expo-router';

export default function LegacyBookServiceRedirect() {
  return <Redirect href={{ pathname: '/services/[serviceId]/request', params: { serviceId: 'logo' } }} />;
}
