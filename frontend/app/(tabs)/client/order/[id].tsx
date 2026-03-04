import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../../src/contexts/AuthContext';
import { useSocket } from '../../../../src/contexts/SocketContext';
import { orderAPI, ratingAPI } from '../../../../src/services/api';
import { ChatComponent } from '../../../../src/components/ChatComponent';
import { RatingModal } from '../../../../src/components/RatingModal';

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
  pendiente: { label: 'Buscando repartidor', color: '#D97706', bg: '#FEF3C7', icon: 'search' },
  aceptado: { label: 'Repartidor asignado', color: '#2563EB', bg: '#DBEAFE', icon: 'person' },
  en_camino: { label: 'En camino', color: '#7C3AED', bg: '#EDE9FE', icon: 'bicycle' },
  completado: { label: 'Completado', color: '#059669', bg: '#D1FAE5', icon: 'checkmark-circle' },
  cancelado: { label: 'Cancelado', color: '#DC2626', bg: '#FEE2E2', icon: 'close-circle' },
};

export default function ClientOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { subscribe } = useSocket();
  
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [hasRated, setHasRated] = useState(false);

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

  const checkRating = async () => {
    if (order?.repartidor_id) {
      try {
        const response = await ratingAPI.getDriverRatings(order.repartidor_id);
        const myRating = response.data.ratings.find((r: any) => r.order_id === id);
        setHasRated(!!myRating);
      } catch (error) {
        console.error('Error checking rating:', error);
      }
    }
  };

  useEffect(() => {
    loadOrder();
  }, [id]);

  useEffect(() => {
    if (order?.status === 'completado') {
      checkRating();
    }
  }, [order?.status]);

  useEffect(() => {
    const unsubAccepted = subscribe('order:accepted', (data) => {
      if (data.id === id) {
        setOrder(data);
      }
    });

    const unsubStatus = subscribe('order:status', (data) => {
      if (data.id === id) {
        setOrder(data);
      }
    });

    const unsubLocation = subscribe('order:location', (data) => {
      if (data.id === id) {
        setOrder(data);
      }
    });

    return () => {
      unsubAccepted();
      unsubStatus();
      unsubLocation();
    };
  }, [id]);

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
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Status banner */}
          <View style={[styles.statusBanner, { backgroundColor: statusConfig.bg }]}>
            <Ionicons name={statusConfig.icon as any} size={32} color={statusConfig.color} />
            <View style={styles.statusInfo}>
              <Text style={[styles.statusLabel, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
              {order.status === 'pendiente' && (
                <Text style={styles.statusHint}>Espera a que un repartidor acepte tu pedido</Text>
              )}
            </View>
          </View>

          {/* Driver info */}
          {order.repartidor_nombre && (
            <View style={styles.driverCard}>
              <View style={styles.driverAvatar}>
                <Ionicons name="person" size={28} color="#E11D48" />
              </View>
              <View style={styles.driverInfo}>
                <Text style={styles.driverName}>{order.repartidor_nombre}</Text>
                <Text style={styles.driverRole}>Tu repartidor</Text>
              </View>
              {order.repartidor_id && ['aceptado', 'en_camino'].includes(order.status) && (
                <TouchableOpacity
                  style={styles.chatButton}
                  onPress={() => setShowChat(true)}
                >
                  <Ionicons name="chatbubble" size={20} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          )}

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
                  <Text style={styles.routeLabel}>Origen</Text>
                  <Text style={styles.routeAddress}>{order.origen_texto}</Text>
                </View>
              </View>
              <View style={styles.routeLine} />
              <View style={styles.routeItem}>
                <View style={[styles.routeDot, { backgroundColor: '#E11D48' }]} />
                <View style={styles.routeContent}>
                  <Text style={styles.routeLabel}>Destino</Text>
                  <Text style={styles.routeAddress}>{order.destino_texto}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Driver location tracking */}
          {order.driver_location && order.status === 'en_camino' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ubicación del repartidor</Text>
              <View style={styles.locationCard}>
                <Ionicons name="navigate" size={24} color="#7C3AED" />
                <Text style={styles.locationText}>
                  Lat: {order.driver_location.lat.toFixed(6)}, Lng: {order.driver_location.lng.toFixed(6)}
                </Text>
              </View>
            </View>
          )}

          {/* Rating button */}
          {order.status === 'completado' && !hasRated && order.repartidor_id && (
            <TouchableOpacity
              style={styles.ratingButton}
              onPress={() => setShowRating(true)}
            >
              <Ionicons name="star" size={20} color="#fff" />
              <Text style={styles.ratingButtonText}>Calificar repartidor</Text>
            </TouchableOpacity>
          )}

          {order.status === 'completado' && hasRated && (
            <View style={styles.ratedBadge}>
              <Ionicons name="checkmark-circle" size={20} color="#059669" />
              <Text style={styles.ratedText}>Ya calificaste este pedido</Text>
            </View>
          )}
        </ScrollView>
      ) : (
        <View style={styles.chatContainer}>
          <TouchableOpacity style={styles.chatBackButton} onPress={() => setShowChat(false)}>
            <Ionicons name="arrow-back" size={20} color="#374151" />
            <Text style={styles.chatBackText}>Volver al detalle</Text>
          </TouchableOpacity>
          <ChatComponent orderId={id} />
        </View>
      )}

      <RatingModal
        visible={showRating}
        orderId={id}
        repartidorNombre={order.repartidor_nombre}
        onClose={() => setShowRating(false)}
        onSuccess={() => setHasRated(true)}
      />
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
  statusHint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  driverCard: {
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
  driverAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFF1F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverInfo: {
    flex: 1,
    marginLeft: 12,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  driverRole: {
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
  routeLine: {
    width: 2,
    height: 24,
    backgroundColor: '#E5E7EB',
    marginLeft: 5,
    marginVertical: 4,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE9FE',
    borderRadius: 16,
    padding: 16,
  },
  locationText: {
    fontSize: 14,
    color: '#7C3AED',
    marginLeft: 12,
  },
  ratingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 8,
  },
  ratingButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  ratedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D1FAE5',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 8,
  },
  ratedText: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
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
