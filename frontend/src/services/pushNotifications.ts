import { Platform } from 'react-native';
import { pushAPI } from './api';

// VAPID public key from backend
let vapidPublicKey: string | null = null;

// Check if push notifications are supported
export const isPushSupported = (): boolean => {
  if (Platform.OS !== 'web') {
    return false; // For now, only web push is supported
  }
  return 'serviceWorker' in navigator && 'PushManager' in window;
};

// Convert VAPID key from base64 to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Get VAPID public key from server
export const getVapidPublicKey = async (): Promise<string | null> => {
  if (vapidPublicKey) return vapidPublicKey;
  
  try {
    const response = await pushAPI.getPublicKey();
    if (response.data.configured && response.data.public_key) {
      vapidPublicKey = response.data.public_key;
      return vapidPublicKey;
    }
    return null;
  } catch (error) {
    console.error('Error getting VAPID key:', error);
    return null;
  }
};

// Register service worker
export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!isPushSupported()) {
    console.log('Push notifications not supported');
    return null;
  }

  try {
    // Register service worker
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service Worker registered:', registration);
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
};

// Request notification permission
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!isPushSupported()) {
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    console.log('Notification permission:', permission);
    return permission === 'granted';
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
};

// Subscribe to push notifications
export const subscribeToPush = async (): Promise<boolean> => {
  if (!isPushSupported()) {
    console.log('Push not supported on this platform');
    return false;
  }

  try {
    // Get VAPID key
    const publicKey = await getVapidPublicKey();
    if (!publicKey) {
      console.log('VAPID key not configured on server');
      return false;
    }

    // Request permission
    const permissionGranted = await requestNotificationPermission();
    if (!permissionGranted) {
      console.log('Notification permission denied');
      return false;
    }

    // Get service worker registration
    let registration = await navigator.serviceWorker.ready;
    
    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      // Create new subscription
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      console.log('New push subscription created');
    }

    // Send subscription to server
    const subscriptionJson = subscription.toJSON();
    await pushAPI.subscribe({
      endpoint: subscriptionJson.endpoint!,
      keys: {
        p256dh: subscriptionJson.keys!.p256dh!,
        auth: subscriptionJson.keys!.auth!,
      },
    });

    console.log('Push subscription saved to server');
    return true;
  } catch (error) {
    console.error('Error subscribing to push:', error);
    return false;
  }
};

// Unsubscribe from push notifications
export const unsubscribeFromPush = async (): Promise<boolean> => {
  if (!isPushSupported()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      const subscriptionJson = subscription.toJSON();
      
      // Unsubscribe from server
      await pushAPI.unsubscribe({
        endpoint: subscriptionJson.endpoint!,
        keys: {
          p256dh: subscriptionJson.keys!.p256dh!,
          auth: subscriptionJson.keys!.auth!,
        },
      });
      
      // Unsubscribe locally
      await subscription.unsubscribe();
      console.log('Unsubscribed from push notifications');
    }
    
    return true;
  } catch (error) {
    console.error('Error unsubscribing from push:', error);
    return false;
  }
};

// Test push notification
export const testPushNotification = async (): Promise<boolean> => {
  try {
    await pushAPI.test();
    return true;
  } catch (error) {
    console.error('Error testing push:', error);
    return false;
  }
};

// Show local notification (for when push is received)
export const showLocalNotification = (title: string, body: string, data?: any): void => {
  if (!isPushSupported() || Notification.permission !== 'granted') {
    return;
  }

  new Notification(title, {
    body,
    icon: '/icon.png',
    badge: '/badge.png',
    data,
  });
};
