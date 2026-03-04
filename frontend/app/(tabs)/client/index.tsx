import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../src/contexts/AuthContext';
import { useSocket } from '../../../src/contexts/SocketContext';
import { orderAPI } from '../../../src/services/api';
import { OrderCard } from '../../../src/components/OrderCard';
import { NotificationBanner } from '../../../src/components/NotificationBanner';
import * as Location from 'expo-location';

interface Order {
  id: string;
  tipo_servicio: string;
  descripcion: string;
  origen_texto: string;
  destino_texto: string;
  status: string;
  created_at: string;
  cliente_nombre?: string;
  repartidor_nombre?: string;
}

export default function ClientDashboard() {
  const { user } = useAuth();
  const { subscribe } = useSocket();
  const router = useRouter();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // Form state
  const [tipoServicio, setTipoServicio] = useState<'moto_mandado' | 'moto_transporte'>('moto_mandado');
  const [descripcion, setDescripcion] = useState('');
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');
  const [useLocation, setUseLocation] = useState(false);
  const [clientLocation, setClientLocation] = useState<{ lat: number; lng: number } | null>(null);

  const loadOrders = async () => {
    try {
      const response = await orderAPI.getMyOrders();
      setOrders(response.data);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadOrders();
  }, []);

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'No podemos acceder a tu ubicación');
        return;
      }
      
      const location = await Location.getCurrentPositionAsync({});
      setClientLocation({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      });
      setUseLocation(true);
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'No se pudo obtener la ubicación');
    }
  };

  const createOrder = async () => {
    if (!descripcion.trim() || !origen.trim() || !destino.trim()) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    setCreating(true);
    try {
      const response = await orderAPI.create({
        tipo_servicio: tipoServicio,
        descripcion: descripcion.trim(),
        origen_texto: origen.trim(),
        destino_texto: destino.trim(),
        client_location: useLocation ? clientLocation : null,
      });
      
      setModalVisible(false);
      resetForm();
      await loadOrders();
      
      // Navigate to order detail
      router.push(`/(tabs)/client/order/${response.data.id}`);
    } catch (error: any) {
      console.error('Error creating order:', error);
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo crear el pedido');
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setTipoServicio('moto_mandado');
    setDescripcion('');
    setOrigen('');
    setDestino('');
    setUseLocation(false);
    setClientLocation(null);
  };

  useEffect(() => {
    loadOrders();

    // Subscribe to realtime events
    const unsubAccepted = subscribe('order:accepted', (data) => {
      loadOrders();
    });

    const unsubStatus = subscribe('order:status', (data) => {
      loadOrders();
    });

    return () => {
      unsubAccepted();
      unsubStatus();
    };
  }, []);

  const activeOrders = orders.filter((o) => !['completado', 'cancelado'].includes(o.status));
  const completedOrders = orders.filter((o) => ['completado', 'cancelado'].includes(o.status));

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E11D48" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E11D48" />
        }
      >
        {/* Notification banner */}
        <NotificationBanner />

        {/* Welcome message */}
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeText}>Hola, {user?.nombre}</Text>
          <Text style={styles.welcomeSubtext}>¿Qué necesitas enviar hoy?</Text>
        </View>

        {/* Active orders */}
        {activeOrders.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pedidos activos</Text>
            {activeOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onPress={() => router.push(`/(tabs)/client/order/${order.id}`)}
              />
            ))}
          </View>
        )}

        {/* Empty state */}
        {orders.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>Sin pedidos aún</Text>
            <Text style={styles.emptyText}>Crea tu primer pedido presionando el botón</Text>
          </View>
        )}

        {/* Completed orders */}
        {completedOrders.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Historial</Text>
            {completedOrders.slice(0, 5).map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onPress={() => router.push(`/(tabs)/client/order/${order.id}`)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Create order FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Create order modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nuevo pedido</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Service type */}
              <Text style={styles.fieldLabel}>Tipo de servicio</Text>
              <View style={styles.serviceTypeContainer}>
                <TouchableOpacity
                  style={[
                    styles.serviceTypeButton,
                    tipoServicio === 'moto_mandado' && styles.serviceTypeActive,
                  ]}
                  onPress={() => setTipoServicio('moto_mandado')}
                >
                  <Ionicons
                    name="cube"
                    size={24}
                    color={tipoServicio === 'moto_mandado' ? '#E11D48' : '#6B7280'}
                  />
                  <Text
                    style={[
                      styles.serviceTypeText,
                      tipoServicio === 'moto_mandado' && styles.serviceTypeTextActive,
                    ]}
                  >
                    Moto Mandado
                  </Text>
                  <Text style={styles.serviceTypeDesc}>Envío de paquetes</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.serviceTypeButton,
                    tipoServicio === 'moto_transporte' && styles.serviceTypeActive,
                  ]}
                  onPress={() => setTipoServicio('moto_transporte')}
                >
                  <Ionicons
                    name="bicycle"
                    size={24}
                    color={tipoServicio === 'moto_transporte' ? '#E11D48' : '#6B7280'}
                  />
                  <Text
                    style={[
                      styles.serviceTypeText,
                      tipoServicio === 'moto_transporte' && styles.serviceTypeTextActive,
                    ]}
                  >
                    Moto Transporte
                  </Text>
                  <Text style={styles.serviceTypeDesc}>Transporte personal</Text>
                </TouchableOpacity>
              </View>

              {/* Description */}
              <Text style={styles.fieldLabel}>Descripción del pedido</Text>
              <TextInput
                style={styles.textArea}
                placeholder="¿Qué necesitas?"
                placeholderTextColor="#9CA3AF"
                value={descripcion}
                onChangeText={setDescripcion}
                multiline
                numberOfLines={3}
              />

              {/* Origin */}
              <Text style={styles.fieldLabel}>Dirección de recogida</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="location" size={20} color="#059669" />
                <TextInput
                  style={styles.input}
                  placeholder="¿Dónde recogemos?"
                  placeholderTextColor="#9CA3AF"
                  value={origen}
                  onChangeText={setOrigen}
                />
              </View>

              {/* Destination */}
              <Text style={styles.fieldLabel}>Dirección de entrega</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="flag" size={20} color="#E11D48" />
                <TextInput
                  style={styles.input}
                  placeholder="¿A dónde lo llevamos?"
                  placeholderTextColor="#9CA3AF"
                  value={destino}
                  onChangeText={setDestino}
                />
              </View>

              {/* Use location */}
              <TouchableOpacity style={styles.locationToggle} onPress={getLocation}>
                <Ionicons
                  name={useLocation ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={useLocation ? '#059669' : '#6B7280'}
                />
                <Text style={styles.locationToggleText}>
                  {useLocation ? 'Ubicación adjuntada' : 'Adjuntar mi ubicación actual'}
                </Text>
              </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity
              style={[styles.createButton, creating && styles.createButtonDisabled]}
              onPress={createOrder}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="add-circle" size={20} color="#fff" />
                  <Text style={styles.createButtonText}>Crear pedido</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  welcomeContainer: {
    backgroundColor: '#0c0c0c',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  welcomeSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E11D48',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#E11D48',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modalBody: {
    padding: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 16,
  },
  serviceTypeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  serviceTypeButton: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  serviceTypeActive: {
    borderColor: '#E11D48',
    backgroundColor: '#FFF1F2',
  },
  serviceTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 8,
  },
  serviceTypeTextActive: {
    color: '#E11D48',
  },
  serviceTypeDesc: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  textArea: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 14,
    color: '#111827',
    marginLeft: 12,
  },
  locationToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 8,
  },
  locationToggleText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 12,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E11D48',
    margin: 20,
    borderRadius: 12,
    paddingVertical: 16,
  },
  createButtonDisabled: {
    opacity: 0.7,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
