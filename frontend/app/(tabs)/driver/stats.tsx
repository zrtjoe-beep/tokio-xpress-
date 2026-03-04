import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { courierAPI } from '../../../src/services/api';

interface Stats {
  total_deliveries: number;
  deliveries_today: number;
  deliveries_week: number;
  deliveries_month: number;
  earnings_today: number;
  earnings_week: number;
  earnings_month: number;
  average_rating: number;
  total_ratings: number;
}

export default function CourierStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = async () => {
    try {
      const response = await courierAPI.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadStats();
  }, []);

  useEffect(() => {
    loadStats();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E11D48" />
      </View>
    );
  }

  if (!stats) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>No se pudieron cargar las estadísticas</Text>
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
        {/* Rating Card */}
        <View style={styles.ratingCard}>
          <View style={styles.ratingStars}>
            <Ionicons name="star" size={32} color="#F59E0B" />
            <Text style={styles.ratingValue}>{stats.average_rating.toFixed(1)}</Text>
          </View>
          <Text style={styles.ratingLabel}>Calificación promedio</Text>
          <Text style={styles.ratingCount}>{stats.total_ratings} calificaciones</Text>
        </View>

        {/* Deliveries Section */}
        <Text style={styles.sectionTitle}>Entregas</Text>
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: '#DBEAFE' }]}>
            <Ionicons name="today" size={24} color="#2563EB" />
            <Text style={styles.statValue}>{stats.deliveries_today}</Text>
            <Text style={styles.statLabel}>Hoy</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#EDE9FE' }]}>
            <Ionicons name="calendar" size={24} color="#7C3AED" />
            <Text style={styles.statValue}>{stats.deliveries_week}</Text>
            <Text style={styles.statLabel}>Esta semana</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#D1FAE5' }]}>
            <Ionicons name="calendar-outline" size={24} color="#059669" />
            <Text style={styles.statValue}>{stats.deliveries_month}</Text>
            <Text style={styles.statLabel}>Este mes</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#FEE2E2' }]}>
            <Ionicons name="trophy" size={24} color="#E11D48" />
            <Text style={styles.statValue}>{stats.total_deliveries}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>

        {/* Earnings Section */}
        <Text style={styles.sectionTitle}>Ganancias estimadas</Text>
        <View style={styles.earningsCard}>
          <View style={styles.earningsRow}>
            <View style={styles.earningsItem}>
              <Text style={styles.earningsLabel}>Hoy</Text>
              <Text style={styles.earningsValue}>${stats.earnings_today.toFixed(2)}</Text>
            </View>
            <View style={styles.earningsDivider} />
            <View style={styles.earningsItem}>
              <Text style={styles.earningsLabel}>Semana</Text>
              <Text style={styles.earningsValue}>${stats.earnings_week.toFixed(2)}</Text>
            </View>
            <View style={styles.earningsDivider} />
            <View style={styles.earningsItem}>
              <Text style={styles.earningsLabel}>Mes</Text>
              <Text style={[styles.earningsValue, { color: '#059669' }]}>
                ${stats.earnings_month.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color="#6B7280" />
          <Text style={styles.infoText}>
            Las ganancias son estimadas basadas en la tarifa por entrega configurada.
            El pago real puede variar según promociones y propinas.
          </Text>
        </View>
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
  errorText: {
    fontSize: 14,
    color: '#6B7280',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  ratingCard: {
    backgroundColor: '#0c0c0c',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  ratingStars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingValue: {
    fontSize: 48,
    fontWeight: '700',
    color: '#fff',
    marginLeft: 12,
  },
  ratingLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
  },
  ratingCount: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 24,
  },
  statCard: {
    width: '50%',
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  earningsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  earningsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  earningsItem: {
    flex: 1,
    alignItems: 'center',
  },
  earningsDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E7EB',
  },
  earningsLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  earningsValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 8,
    lineHeight: 18,
  },
});
