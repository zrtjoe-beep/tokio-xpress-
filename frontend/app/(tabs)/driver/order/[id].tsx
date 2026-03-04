import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAuth } from '../../../../src/contexts/AuthContext';
import { orderAPI } from '../../../../src/services/api';
import { ChatComponent } from '../../../../src/components/ChatComponent';

interface Order {
  id: string;
  cliente_id: string;
  repartidor_id?: string;
  tipo_servicio: string;
  descripcion: string;
  origen_texto: string;
  destino_texto: string;
  client_location?: { lat: number; lng: number };
  driver_location?: { lat: number; lng: number };
  status: string;
  created_at: string;
  updated_at: string;
  cliente_nombre?: string;
  repartidor_nombre?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pendiente: { label: 'Pendiente', color: '#D97706', bg: '#FEF3C7', icon: 'time' },
  aceptado: { label: 'Aceptado', color: '#2563EB', bg: '#DBEAFE', icon: 'checkmark' },
  en_camino: { label: 'En camino', color: '#7C3AED', bg: '#EDE9FE', icon: 'bicycle' },
  completado: { label: 'Completado', color: '#059669', bg: '#D1FAE5', icon: 'checkmark-circle' },
  cancelado: { label: 'Cancelado', color: '#DC2626', bg: '#FEE2E2', icon: 'close-circle' },
};

const STATUS_FLOW = ['aceptado', 'en_camino', 'completado'];

export default function DriverOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [sharingLocation, setSharingLocation] = useState(false);
  const locationWatchRef = useRef<Location.LocationSubscription | null>(null);

  const loadOrder = async () => {
    try {
      const response = await orderAPI.getOrder(id);
      setOrder(response.data);
    } catch (error) {
      console.error('Error loading order:', error);
      Alert.alert('Error', 'No se pudo cargar el pedido');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (newStatus: string) => {
    setUpdating(true);
    try {
      const response = await orderAPI.updateStatus(id, newStatus);
      setOrder(response.data);
      
      if (newStatus === 'en_camino') {
        startLocationSharing();
      } else if (newStatus === 'completado' || newStatus === 'cancelado') {
        stopLocationSharing();
      }
    } catch (error: any) {
      console.error('Error updating status:', error);
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo actualizar el estado');
    } finally {
      setUpdating(false);
    }
  };

  const startLocationSharing = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Necesitamos tu ubicación para compartirla con el cliente');
        return;
      }

      setSharingLocation(true);

      // Initial location update
      const location = await Location.getCurrentPositionAsync({});
      await orderAPI.updateLocation(id, location.coords.latitude, location.coords.longitude);

      // Watch for location changes
      locationWatchRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 10,
        },
        async (location) => {
          try {
            await orderAPI.updateLocation(id, location.coords.latitude, location.coords.longitude);
          } catch (error) {
            console.error('Error updating location:', error);
          }
        }
      );
    } catch (error) {
      console.error('Error starting location sharing:', error);
      Alert.alert('Error', 'No se pudo iniciar el seguimiento de ubicación');
    }
  };

  const stopLocationSharing = () => {
    if (locationWatchRef.current) {
      locationWatchRef.current.remove();
      locationWatchRef.current = null;
    }
    setSharingLocation(false);
  };

  useEffect(() => {
    loadOrder();

    return () => {
      stopLocationSharing();
    };
  }, [id]);

  useEffect(() => {
    // Auto-start location sharing if order is en_camino
    if (order?.status === 'en_camino' && !sharingLocation) {
      startLocationSharing();
    }
  }, [order?.status]);

  const getNextStatus = () => {
    if (!order) return null;
    const currentIndex = STATUS_FLOW.indexOf(order.status);
    if (currentIndex === -1 || currentIndex >= STATUS_FLOW.length - 1) return null;
    return STATUS_FLOW[currentIndex + 1];
  };

  const getNextStatusLabel = () => {
    const next = getNextStatus();
    if (!next) return null;
    if (next === 'en_camino') return 'Iniciar entrega';
    if (next === 'completado') return 'Marcar como completado';
    return null;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E11D48" />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={64} color="#DC2626" />
        <Text style={styles.errorText}>Pedido no encontrado</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pendiente;
  const nextStatus = getNextStatus();
  const nextStatusLabel = getNextStatusLabel();

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: `Pedido #${order.id.slice(0, 8)}`,
          headerStyle: { backgroundColor: '#0c0c0c' },
          headerTintColor: '#fff',
        }}
      />

      {!showChat ? (
        <>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {/* Status banner */}
            <View style={[styles.statusBanner, { backgroundColor: statusConfig.bg }]}>
              <Ionicons name={statusConfig.icon as any} size={32} color={statusConfig.color} />
              <View style={styles.statusInfo}>
                <Text style={[styles.statusLabel, { color: statusConfig.color }]}>
                  {statusConfig.label}
                </Text>
                {sharingLocation && (
                  <View style={styles.locationSharing}>
                    <View style={styles.locationDot} />
                    <Text style={styles.locationSharingText}>Compartiendo ubicación</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Client info */}
            <View style={styles.clientCard}>
              <View style={styles.clientAvatar}>
                <Ionicons name="person" size={28} color="#2563EB" />
              </View>
              <View style={styles.clientInfo}>
                <Text style={styles.clientName}>{order.cliente_nombre || 'Cliente'}</Text>
                <Text style={styles.clientRole}>Cliente</Text>
              </View>
              {['aceptado', 'en_camino'].includes(order.status) && (
                <TouchableOpacity
                  style={styles.chatButton}
                  onPress={() => setShowChat(true)}
                >
                  <Ionicons name="chatbubble" size={20} color="#fff" />
                </TouchableOpacity>
              )}
            </View>

            {/* Order details */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Detalles del pedido</Text>
              <View style={styles.detailCard}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Servicio</Text>
                  <Text style={styles.detailValue}>
                    {order.tipo_servicio === 'moto_mandado' ? 'Moto Mandado' : 'Moto Transporte'}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Descripción</Text>
                  <Text style={styles.detailValue}>{order.descripcion}</Text>
                </View>
              </View>
            </View>

            {/* Route */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ruta</Text>
              <View style={styles.routeCard}>
                <View style={styles.routeItem}>
                  <View style={[styles.routeDot, { backgroundColor: '#059669' }]} />
                  <View style={styles.routeContent}>
                    <Text style={styles.routeLabel}>Recoger en</Text>
                    <Text style={styles.routeAddress}>{order.origen_texto}</Text>
                    {order.client_location && (
                      <Text style={styles.routeCoords}>
                        {order.client_location.lat.toFixed(6)}, {order.client_location.lng.toFixed(6)}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.routeLine} />
                <View style={styles.routeItem}>
                  <View style={[styles.routeDot, { backgroundColor: '#E11D48' }]} />
                  <View style={styles.routeContent}>
                    <Text style={styles.routeLabel}>Entregar en</Text>
                    <Text style={styles.routeAddress}>{order.destino_texto}</Text>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Action buttons */}
          {nextStatus && nextStatusLabel && (
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  Alert.alert(
                    'Cancelar pedido',
                    '¿Estás seguro de cancelar este pedido?',
                    [
                      { text: 'No', style: 'cancel' },
                      { text: 'Sí, cancelar', onPress: () => updateStatus('cancelado'), style: 'destructive' },
                    ]
                  );
                }}
                disabled={updating}
              >
                <Ionicons name="close" size={20} color="#DC2626" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.nextButton, updating && styles.buttonDisabled]}
                onPress={() => updateStatus(nextStatus)}
                disabled={updating}
              >
                {updating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.nextButtonText}>{nextStatusLabel}</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </>
      ) : (
        <View style={styles.chatContainer}>
          <TouchableOpacity style={styles.chatBackButton} onPress={() => setShowChat(false)}>
            <Ionicons name="arrow-back" size={20} color="#374151" />
            <Text style={styles.chatBackText}>Volver al detalle</Text>
          </TouchableOpacity>
          <ChatComponent orderId={id} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F3F4F6',
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
  },
  backButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#E11D48',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  statusInfo: {
    marginLeft: 16,
    flex: 1,
  },
  statusLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  locationSharing: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  locationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#059669',
    marginRight: 6,
  },
  locationSharingText: {
    fontSize: 12,
    color: '#059669',
  },
  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  clientAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clientInfo: {
    flex: 1,
    marginLeft: 12,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  clientRole: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  chatButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E11D48',
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
  },
  detailRow: {
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  routeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  routeContent: {
    flex: 1,
    marginLeft: 12,
  },
  routeLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  routeAddress: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    marginTop: 2,
  },
  routeCoords: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  routeLine: {
    width: 2,
    height: 24,
    backgroundColor: '#E5E7EB',
    marginLeft: 5,
    marginVertical: 4,
  },
  actionsContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cancelButton: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 16,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  chatContainer: {
    flex: 1,
  },
  chatBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  chatBackText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
  },
});
