import { Redirect } from 'expo-router';
import { useAuth } from '../store/AuthContext';

export default function Index() {
  const { authState } = useAuth();

  if (authState === 'AUTHENTICATED') {
    return <Redirect href="/(tabs)" />;
  } else {
    return <Redirect href="/login" />;
  }
}
