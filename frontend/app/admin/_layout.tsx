import React from 'react';
import { Stack } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

export default function AdminLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) {
      router.replace('/login');
    }
  }, [user, loading]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#E11D48" />
      </View>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Acceso denegado</Text>
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0c0c0c' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Panel Admin' }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0c0c0c',
  },
  text: {
    color: '#fff',
    fontSize: 16,
  },
});
