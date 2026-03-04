import { Stack } from 'expo-router';

export default function ClientLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="order/[id]" />
    </Stack>
  );
}
