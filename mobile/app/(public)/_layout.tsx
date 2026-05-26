import { Stack } from 'expo-router';

export default function PublicLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="quick/index" />
      <Stack.Screen name="quick/collaborative" />
      <Stack.Screen name="quick/result" />
      <Stack.Screen name="auth/index" />
    </Stack>
  );
}
