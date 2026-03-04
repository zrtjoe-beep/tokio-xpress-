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
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { adminAPI } from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';

interface User {
  id: string;
  nombre: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface Order {
  id: string;
  tipo_servicio: string;
  descripcion: string;
  origen_texto: string;
  destino_texto: string;
  status: string;
  cliente_nombre?: string;
  repartidor_nombre?: string;
  repartidor_id?: string;
  created_at: string;
  amount: number;
}

interface Stats {
  users: { total: number; clients: number; drivers: number; active_drivers: number };
  orders: { total: number; pending: number; in_progress: number; completed: number; today: number };
  revenue: { total: number; today: number; week: number; month: number; currency: string };
}

type TabType = 'dashboard' | 'users' | 'orders';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pendiente: { label: 'Pendiente', color: '#D97706', bg: '#FEF3C7' },
  aceptado: { label: 'Aceptado', color: '#2563EB', bg: '#DBEAFE' },
  en_camino: { label: 'En camino', color: '#7C3AED', bg: '#EDE9FE' },
  completado: { label: 'Completado', color: '#059669', bg: '#D1FAE5' },
  cancelado: { label: 'Cancelado', color: '#DC2626', bg: '#FEE2E2' },
};

export default function AdminDashboard() {
  const { logout } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<User[]>([]);
  
  // Modals
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const loadData = async () => {
    try {
      const [statsRes, usersRes, ordersRes] = await Promise.all([
        adminAPI.getStats(),
        adminAPI.getUsers(),
        adminAPI.getOrders(statusFilter || undefined),
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data);
      setOrders(ordersRes.data);
      setDrivers(usersRes.data.filter((u: User) => u.role === 'repartidor' && u.is_active));
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [statusFilter]);

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const toggleUserStatus = async (user: User) => {
    try {
      await adminAPI.updateUserStatus(user.id, !user.is_active);
      loadData();
      Alert.alert('Éxito', `Usuario ${user.is_active ? 'bloqueado' : 'activado'}`);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo actualizar');
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      await adminAPI.updateOrderStatus(orderId, status);
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo actualizar');
    }
  };

  const assignDriver = async (driverId: string) => {
    if (!selectedOrderId) return;
    try {
      await adminAPI.assignDriver(selectedOrderId, driverId);
      setAssignModalVisible(false);
      setSelectedOrderId(null);
      loadData();
      Alert.alert('Éxito', 'Repartidor asignado');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo asignar');
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)} ${stats?.revenue.currency?.toUpperCase() || 'MXN'}`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E11D48" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {(['dashboard', 'users', 'orders'] as TabType[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Ionicons
              name={tab === 'dashboard' ? 'stats-chart' : tab === 'users' ? 'people' : 'cube'}
              size={20}
              color={activeTab === tab ? '#E11D48' : '#6B7280'}
            />
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'dashboard' ? 'Dashboard' : tab === 'users' ? 'Usuarios' : 'Pedidos'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E11D48" />
        }
      >
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && stats && (
          <>
            {/* Stats Cards */}
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="people" size={24} color="#2563EB" />
                <Text style={styles.statValue}>{stats.users.total}</Text>
                <Text style={styles.statLabel}>Usuarios</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="bicycle" size={24} color="#059669" />
                <Text style={styles.statValue}>{stats.users.active_drivers}</Text>
                <Text style={styles.statLabel}>Repartidores</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="cube" size={24} color="#D97706" />
                <Text style={styles.statValue}>{stats.orders.pending}</Text>
                <Text style={styles.statLabel}>Pendientes</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="checkmark-circle" size={24} color="#7C3AED" />
                <Text style={styles.statValue}>{stats.orders.completed}</Text>
                <Text style={styles.statLabel}>Completados</Text>
              </View>
            </View>

            {/* Revenue Card */}
            <View style={styles.revenueCard}>
              <Text style={styles.revenueTitle}>Ingresos</Text>
              <View style={styles.revenueGrid}>
                <View style={styles.revenueItem}>
                  <Text style={styles.revenueLabel}>Hoy</Text>
                  <Text style={styles.revenueValue}>{formatCurrency(stats.revenue.today)}</Text>
                </View>
                <View style={styles.revenueItem}>
                  <Text style={styles.revenueLabel}>Semana</Text>
                  <Text style={styles.revenueValue}>{formatCurrency(stats.revenue.week)}</Text>
                </View>
                <View style={styles.revenueItem}>
                  <Text style={styles.revenueLabel}>Mes</Text>
                  <Text style={styles.revenueValue}>{formatCurrency(stats.revenue.month)}</Text>
                </View>
                <View style={styles.revenueItem}>
                  <Text style={styles.revenueLabel}>Total</Text>
                  <Text style={[styles.revenueValue, { color: '#059669' }]}>
                    {formatCurrency(stats.revenue.total)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Quick Stats */}
            <View style={styles.quickStats}>
              <Text style={styles.sectionTitle}>Pedidos de hoy</Text>
              <View style={styles.quickStatsRow}>
                <View style={styles.quickStatItem}>
                  <Text style={styles.quickStatValue}>{stats.orders.today}</Text>
                  <Text style={styles.quickStatLabel}>Nuevos</Text>
                </View>
                <View style={styles.quickStatItem}>
                  <Text style={styles.quickStatValue}>{stats.orders.in_progress}</Text>
                  <Text style={styles.quickStatLabel}>En curso</Text>
                </View>
              </View>
            </View>
          </>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <>
            <Text style={styles.sectionTitle}>Gestión de usuarios ({users.length})</Text>
            {users.map((user) => (
              <View key={user.id} style={styles.userCard}>
                <View style={styles.userInfo}>
                  <View style={[
                    styles.userAvatar,
                    { backgroundColor: user.role === 'cliente' ? '#DBEAFE' : '#FEE2E2' }
                  ]}>
                    <Ionicons
                      name={user.role === 'cliente' ? 'person' : 'bicycle'}
                      size={20}
                      color={user.role === 'cliente' ? '#2563EB' : '#E11D48'}
                    />
                  </View>
                  <View style={styles.userDetails}>
                    <Text style={styles.userName}>{user.nombre}</Text>
                    <Text style={styles.userEmail}>{user.email}</Text>
                    <View style={styles.userTags}>
                      <View style={[styles.roleTag, user.role === 'repartidor' && styles.roleTagDriver]}>
                        <Text style={styles.roleTagText}>
                          {user.role === 'cliente' ? 'Cliente' : 'Repartidor'}
                        </Text>
                      </View>
                      {!user.is_active && (
                        <View style={styles.blockedTag}>
                          <Text style={styles.blockedTagText}>Bloqueado</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
                {user.role !== 'admin' && (
                  <TouchableOpacity
                    style={[styles.toggleButton, !user.is_active && styles.toggleButtonActive]}
                    onPress={() => toggleUserStatus(user)}
                  >
                    <Ionicons
                      name={user.is_active ? 'ban' : 'checkmark-circle'}
                      size={20}
                      color={user.is_active ? '#DC2626' : '#059669'}
                    />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <>
            {/* Status Filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
              <TouchableOpacity
                style={[styles.filterChip, !statusFilter && styles.filterChipActive]}
                onPress={() => setStatusFilter('')}
              >
                <Text style={[styles.filterChipText, !statusFilter && styles.filterChipTextActive]}>Todos</Text>
              </TouchableOpacity>
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.filterChip, statusFilter === key && styles.filterChipActive]}
                  onPress={() => setStatusFilter(key)}
                >
                  <Text style={[styles.filterChipText, statusFilter === key && styles.filterChipTextActive]}>
                    {config.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.sectionTitle}>Pedidos ({orders.length})</Text>
            {orders.map((order) => {
              const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pendiente;
              return (
                <View key={order.id} style={styles.orderCard}>
                  <View style={styles.orderHeader}>
                    <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                      <Text style={[styles.statusText, { color: statusConfig.color }]}>
                        {statusConfig.label}
                      </Text>
                    </View>
                    <Text style={styles.orderAmount}>${order.amount}</Text>
                  </View>
                  
                  <Text style={styles.orderDesc} numberOfLines={1}>{order.descripcion}</Text>
                  <Text style={styles.orderRoute}>
                    {order.origen_texto} → {order.destino_texto}
                  </Text>
                  
                  <View style={styles.orderMeta}>
                    <Text style={styles.orderMetaText}>👤 {order.cliente_nombre || 'Cliente'}</Text>
                    {order.repartidor_nombre && (
                      <Text style={styles.orderMetaText}>🏍️ {order.repartidor_nombre}</Text>
                    )}
                  </View>

                  <View style={styles.orderActions}>
                    {order.status === 'pendiente' && (
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => {
                          setSelectedOrderId(order.id);
                          setAssignModalVisible(true);
                        }}
                      >
                        <Ionicons name="person-add" size={16} color="#2563EB" />
                        <Text style={styles.actionButtonText}>Asignar</Text>
                      </TouchableOpacity>
                    )}
                    {['aceptado', 'en_camino'].includes(order.status) && (
                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: '#D1FAE5' }]}
                        onPress={() => updateOrderStatus(order.id, 'completado')}
                      >
                        <Ionicons name="checkmark" size={16} color="#059669" />
                        <Text style={[styles.actionButtonText, { color: '#059669' }]}>Completar</Text>
                      </TouchableOpacity>
                    )}
                    {order.status !== 'cancelado' && order.status !== 'completado' && (
                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: '#FEE2E2' }]}
                        onPress={() => updateOrderStatus(order.id, 'cancelado')}
                      >
                        <Ionicons name="close" size={16} color="#DC2626" />
                        <Text style={[styles.actionButtonText, { color: '#DC2626' }]}>Cancelar</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out" size={20} color="#fff" />
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>

      {/* Assign Driver Modal */}
      <Modal
        visible={assignModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAssignModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Asignar repartidor</Text>
              <TouchableOpacity onPress={() => setAssignModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={drivers}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.driverItem}
                  onPress={() => assignDriver(item.id)}
                >
                  <View style={styles.driverAvatar}>
                    <Ionicons name="bicycle" size={20} color="#E11D48" />
                  </View>
                  <View>
                    <Text style={styles.driverName}>{item.nombre}</Text>
                    <Text style={styles.driverEmail}>{item.email}</Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No hay repartidores disponibles</Text>
              }
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' },
  tabsContainer: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#E11D48' },
  tabText: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginLeft: 6 },
  tabTextActive: { color: '#E11D48' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6, marginBottom: 16 },
  statCard: { width: '50%', paddingHorizontal: 6, marginBottom: 12 },
  statCardInner: { borderRadius: 16, padding: 16, alignItems: 'center' },
  statValue: { fontSize: 28, fontWeight: '700', color: '#111827', marginTop: 8 },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  revenueCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16 },
  revenueTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 12 },
  revenueGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  revenueItem: { width: '50%', marginBottom: 12 },
  revenueLabel: { fontSize: 12, color: '#6B7280' },
  revenueValue: { fontSize: 18, fontWeight: '700', color: '#111827' },
  quickStats: { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 12 },
  quickStatsRow: { flexDirection: 'row' },
  quickStatItem: { flex: 1, alignItems: 'center' },
  quickStatValue: { fontSize: 32, fontWeight: '700', color: '#E11D48' },
  quickStatLabel: { fontSize: 12, color: '#6B7280' },
  userCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  userInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  userAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  userDetails: { marginLeft: 12, flex: 1 },
  userName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  userEmail: { fontSize: 12, color: '#6B7280' },
  userTags: { flexDirection: 'row', marginTop: 4 },
  roleTag: { backgroundColor: '#DBEAFE', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  roleTagDriver: { backgroundColor: '#FEE2E2' },
  roleTagText: { fontSize: 10, fontWeight: '600', color: '#2563EB' },
  blockedTag: { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginLeft: 4 },
  blockedTagText: { fontSize: 10, fontWeight: '600', color: '#DC2626' },
  toggleButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center' },
  toggleButtonActive: { backgroundColor: '#D1FAE5' },
  filterContainer: { marginBottom: 12 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', marginRight: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  filterChipActive: { backgroundColor: '#E11D48', borderColor: '#E11D48' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  filterChipTextActive: { color: '#fff' },
  orderCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '600' },
  orderAmount: { fontSize: 16, fontWeight: '700', color: '#059669' },
  orderDesc: { fontSize: 14, color: '#374151', marginBottom: 4 },
  orderRoute: { fontSize: 12, color: '#6B7280', marginBottom: 8 },
  orderMeta: { flexDirection: 'row', marginBottom: 8 },
  orderMetaText: { fontSize: 12, color: '#6B7280', marginRight: 12 },
  orderActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 8 },
  actionButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#DBEAFE', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginRight: 8 },
  actionButtonText: { fontSize: 12, fontWeight: '600', color: '#2563EB', marginLeft: 4 },
  logoutButton: { position: 'absolute', bottom: 20, left: 20, right: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#DC2626', borderRadius: 12, paddingVertical: 14 },
  logoutText: { color: '#fff', fontSize: 14, fontWeight: '600', marginLeft: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  driverItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  driverAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center' },
  driverName: { fontSize: 14, fontWeight: '600', color: '#111827', marginLeft: 12 },
  driverEmail: { fontSize: 12, color: '#6B7280', marginLeft: 12 },
  emptyText: { padding: 24, textAlign: 'center', color: '#6B7280' },
});
