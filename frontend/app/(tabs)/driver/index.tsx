import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { useSocket } from '../../src/contexts/SocketContext';
import { orderAPI, ratingAPI } from '../../src/services/api';
import { OrderCard } from '../../src/components/OrderCard';

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

type TabType = 'available' | 'myOrders';

export default function DriverDashboard() {
  const { user } = useAuth();
  const { subscribe } = useSocket();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<TabType>('available');
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [driverRating, setDriverRating] = useState<{ average: number; count: number } | null>(null);

  const loadOrders = async () => {
    try {
      const [pendingRes, myRes] = await Promise.all([
        orderAPI.getPending(),
        orderAPI.getDriverOrders(),
      ]);
      setPendingOrders(pendingRes.data);
      setMyOrders(myRes.data);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadRating = async () => {
    if (user?.id) {
      try {
        const response = await ratingAPI.getDriverRatings(user.id);
        setDriverRating({
          average: response.data.average,
          count: response.data.count,
        });
      } catch (error) {
        console.error('Error loading rating:', error);
      }
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadOrders();
    loadRating();
  }, []);

  const acceptOrder = async (orderId: string) => {
    setAccepting(orderId);
    try {
      const response = await orderAPI.accept(orderId);
      await loadOrders();
      setActiveTab('myOrders');
      router.push(`/(tabs)/driver/order/${orderId}`);
    } catch (error: any) {
      console.error('Error accepting order:', error);
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo aceptar el pedido');
    } finally {
      setAccepting(null);
    }
  };

  useEffect(() => {
    loadOrders();
    loadRating();

    // Subscribe to new orders
    const unsubNew = subscribe('order:new', (data) => {
      setPendingOrders((prev) => [data, ...prev]);
    });

    return () => {
      unsubNew();
    };
  }, []);

  const activeMyOrders = myOrders.filter((o) => !['completado', 'cancelado'].includes(o.status));
  const completedMyOrders = myOrders.filter((o) => ['completado', 'cancelado'].includes(o.status));

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E11D48" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Driver stats header */}
      <View style={styles.statsHeader}>
        <View style={styles.statsLeft}>
          <Text style={styles.welcomeText}>Hola, {user?.nombre}</Text>
          <Text style={styles.roleText}>Repartidor</Text>
        </View>
        {driverRating && driverRating.count > 0 && (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={16} color="#F59E0B" />
            <Text style={styles.ratingText}>{driverRating.average.toFixed(1)}</Text>
            <Text style={styles.ratingCount}>({driverRating.count})</Text>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'available' && styles.tabActive]}
          onPress={() => setActiveTab('available')}
        >
          <Ionicons
            name="cube-outline"
            size={20}
            color={activeTab === 'available' ? '#E11D48' : '#6B7280'}
          />
          <Text style={[styles.tabText, activeTab === 'available' && styles.tabTextActive]}>
            Disponibles
          </Text>
          {pendingOrders.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{pendingOrders.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'myOrders' && styles.tabActive]}
          onPress={() => setActiveTab('myOrders')}
        >
          <Ionicons
            name="checkmark-circle-outline"
            size={20}
            color={activeTab === 'myOrders' ? '#E11D48' : '#6B7280'}
          />
          <Text style={[styles.tabText, activeTab === 'myOrders' && styles.tabTextActive]}>
            Mis pedidos
          </Text>
          {activeMyOrders.length > 0 && (
            <View style={[styles.tabBadge, { backgroundColor: '#059669' }]}>
              <Text style={styles.tabBadgeText}>{activeMyOrders.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E11D48" />
        }
      >
        {activeTab === 'available' ? (
          <>
            {pendingOrders.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="cube-outline" size={64} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>Sin pedidos disponibles</Text>
                <Text style={styles.emptyText}>Cuando haya nuevos pedidos aparecerán aquí</Text>
              </View>
            ) : (
              pendingOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  showAcceptButton
                  onAccept={() => acceptOrder(order.id)}
                  onPress={() => {}}
                />
              ))
            )}
          </>
        ) : (
          <>
            {/* Active orders */}
            {activeMyOrders.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Pedidos activos</Text>
                {activeMyOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onPress={() => router.push(`/(tabs)/driver/order/${order.id}`)}
                  />
                ))}
              </View>
            )}

            {/* Completed orders */}
            {completedMyOrders.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Historial</Text>
                {completedMyOrders.slice(0, 10).map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onPress={() => router.push(`/(tabs)/driver/order/${order.id}`)}
                  />
                ))}
              </View>
            )}

            {myOrders.length === 0 && (
              <View style={styles.emptyContainer}>
                <Ionicons name="bicycle-outline" size={64} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>Sin pedidos aún</Text>
                <Text style={styles.emptyText}>Acepta pedidos de la pestaña "Disponibles"</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
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
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0c0c0c',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  statsLeft: {},
  welcomeText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  roleText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1F1F',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F59E0B',
    marginLeft: 4,
  },
  ratingCount: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 2,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#E11D48',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: 8,
  },
  tabTextActive: {
    color: '#E11D48',
  },
  tabBadge: {
    backgroundColor: '#E11D48',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
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
    textAlign: 'center',
  },
});
