import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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

interface OrderCardProps {
  order: Order;
  onPress?: () => void;
  showAcceptButton?: boolean;
  onAccept?: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pendiente: { label: 'Pendiente', color: '#D97706', bg: '#FEF3C7' },
  aceptado: { label: 'Aceptado', color: '#2563EB', bg: '#DBEAFE' },
  en_camino: { label: 'En camino', color: '#7C3AED', bg: '#EDE9FE' },
  completado: { label: 'Completado', color: '#059669', bg: '#D1FAE5' },
  cancelado: { label: 'Cancelado', color: '#DC2626', bg: '#FEE2E2' },
};

const SERVICE_ICONS: Record<string, string> = {
  moto_mandado: 'cube',
  moto_transporte: 'bicycle',
};

export function OrderCard({ order, onPress, showAcceptButton, onAccept }: OrderCardProps) {
  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pendiente;
  const icon = SERVICE_ICONS[order.tipo_servicio] || 'cube';

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name={icon as any} size={24} color="#E11D48" />
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.serviceType}>
            {order.tipo_servicio === 'moto_mandado' ? 'Moto Mandado' : 'Moto Transporte'}
          </Text>
          <Text style={styles.date}>{formatDate(order.created_at)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
          <Text style={[styles.statusText, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.description} numberOfLines={2}>
          {order.descripcion}
        </Text>

        <View style={styles.route}>
          <View style={styles.routeItem}>
            <Ionicons name="location" size={16} color="#059669" />
            <Text style={styles.routeText} numberOfLines={1}>{order.origen_texto}</Text>
          </View>
          <View style={styles.routeItem}>
            <Ionicons name="flag" size={16} color="#E11D48" />
            <Text style={styles.routeText} numberOfLines={1}>{order.destino_texto}</Text>
          </View>
        </View>

        {order.repartidor_nombre && (
          <View style={styles.driverInfo}>
            <Ionicons name="person" size={14} color="#6B7280" />
            <Text style={styles.driverText}>{order.repartidor_nombre}</Text>
          </View>
        )}
      </View>

      {showAcceptButton && (
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={(e) => {
            e.stopPropagation();
            onAccept?.();
          }}
        >
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={styles.acceptButtonText}>Aceptar pedido</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFF1F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  serviceType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  date: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  body: {},
  description: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 12,
  },
  route: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  routeText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    marginLeft: 8,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  driverText: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 6,
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 12,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});
