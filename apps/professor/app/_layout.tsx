import { Slot } from 'expo-router';
import { AuthProvider, useAuth } from '../store/AuthContext';
import { View, ActivityIndicator } from 'react-native';
import Colors from '../constants/Colors';

function RootLayoutNav() {
  const { authState } = useAuth();
  
  if (authState === 'AUTHENTICATING') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }
  
  return <Slot />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
