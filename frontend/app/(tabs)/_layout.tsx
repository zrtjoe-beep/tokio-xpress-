import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { DiagnosticPanel } from '../../src/components/DiagnosticPanel';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export default function TabsLayout() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  // Determine which tabs to show based on role
  const isClient = user?.role === 'cliente';
  const isDriver = user?.role === 'repartidor';
  const isAdmin = user?.role === 'admin';

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#E11D48',
          tabBarInactiveTintColor: '#6B7280',
          tabBarStyle: {
            backgroundColor: '#fff',
            borderTopWidth: 1,
            borderTopColor: '#E5E7EB',
            height: 60,
            paddingBottom: 8,
            paddingTop: 8,
          },
          headerStyle: {
            backgroundColor: '#0c0c0c',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: '600',
          },
          headerRight: () => (
            <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
              <Ionicons name="log-out-outline" size={22} color="#E11D48" />
            </TouchableOpacity>
          ),
        }}
      >
        {/* Client tab - show for clients and admins */}
        <Tabs.Screen
          name="client"
          options={{
            title: 'Mis Pedidos',
            headerTitle: 'TOKIO XPRESS',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="cube" size={size} color={color} />
            ),
            href: isClient || isAdmin ? '/(tabs)/client' : null,
          }}
        />

        {/* Driver tab - show for drivers and admins */}
        <Tabs.Screen
          name="driver"
          options={{
            title: 'Repartidor',
            headerTitle: 'TOKIO XPRESS',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="bicycle" size={size} color={color} />
            ),
            href: isDriver || isAdmin ? '/(tabs)/driver' : null,
          }}
        />
      </Tabs>
      <DiagnosticPanel />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  logoutButton: {
    marginRight: 16,
    padding: 8,
  },
});
