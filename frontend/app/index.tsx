import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';

export default function Index() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        if (user.role === 'cliente') {
          router.replace('/(tabs)/client');
        } else if (user.role === 'repartidor') {
          router.replace('/(tabs)/driver');
        } else if (user.role === 'admin') {
          router.replace('/admin');
        }
      } else {
        router.replace('/login');
      }
    }
  }, [user, loading]);

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Text style={styles.logo}>TOKIO</Text>
        <Text style={styles.logoXpress}>XPRESS</Text>
      </View>
      <ActivityIndicator size="large" color="#E11D48" style={styles.loader} />
      <Text style={styles.loadingText}>Cargando...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c0c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 48,
    fontWeight: '900',
    color: '#E11D48',
    letterSpacing: 8,
  },
  logoXpress: {
    fontSize: 24,
    fontWeight: '300',
    color: '#fff',
    letterSpacing: 12,
    marginTop: -4,
  },
  loader: {
    marginBottom: 16,
  },
  loadingText: {
    color: '#6B7280',
    fontSize: 14,
  },
});
