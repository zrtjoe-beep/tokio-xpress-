import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { 
  isPushSupported, 
  subscribeToPush, 
  registerServiceWorker 
} from '../services/pushNotifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function NotificationBanner() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    checkNotificationStatus();
  }, [user]);

  const checkNotificationStatus = async () => {
    if (!user || Platform.OS !== 'web') {
      setVisible(false);
      return;
    }

    // Check if already dismissed
    const dismissed = await AsyncStorage.getItem('notification_banner_dismissed');
    if (dismissed) {
      setVisible(false);
      return;
    }

    // Check if push is supported and not already subscribed
    if (isPushSupported()) {
      // Register service worker
      await registerServiceWorker();
      
      // Check if permission is already granted
      if (Notification.permission === 'default') {
        setVisible(true);
      } else if (Notification.permission === 'granted') {
        // Auto-subscribe if permission already granted
        subscribeToPush();
        setVisible(false);
      }
    }
  };

  const handleEnable = async () => {
    setSubscribing(true);
    try {
      const success = await subscribeToPush();
      if (success) {
        setVisible(false);
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
    } finally {
      setSubscribing(false);
    }
  };

  const handleDismiss = async () => {
    await AsyncStorage.setItem('notification_banner_dismissed', 'true');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="notifications" size={24} color="#fff" />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>Activa las notificaciones</Text>
          <Text style={styles.subtitle}>
            Recibe alertas cuando tu pedido sea aceptado o actualizado
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.dismissButton} onPress={handleDismiss}>
          <Text style={styles.dismissText}>Ahora no</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.enableButton, subscribing && styles.enableButtonDisabled]} 
          onPress={handleEnable}
          disabled={subscribing}
        >
          <Text style={styles.enableText}>
            {subscribing ? 'Activando...' : 'Activar'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0c0c0c',
    margin: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E11D48',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  subtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 12,
  },
  dismissButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  dismissText: {
    fontSize: 14,
    color: '#6B7280',
  },
  enableButton: {
    backgroundColor: '#E11D48',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  enableButtonDisabled: {
    opacity: 0.7,
  },
  enableText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
