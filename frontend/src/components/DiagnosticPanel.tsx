import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { Ionicons } from '@expo/vector-icons';

export function DiagnosticPanel() {
  const [visible, setVisible] = useState(false);
  const { user, token } = useAuth();
  const { connected, lastEvent } = useSocket();

  return (
    <>
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setVisible(true)}
      >
        <Ionicons name="bug" size={20} color="#fff" />
      </TouchableOpacity>

      <Modal
        visible={visible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.header}>
              <Text style={styles.title}>Diagnóstico</Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.body}>
              <View style={styles.item}>
                <Text style={styles.label}>Token:</Text>
                <View style={[styles.badge, token ? styles.badgeGreen : styles.badgeRed]}>
                  <Text style={styles.badgeText}>{token ? 'Presente' : 'No hay'}</Text>
                </View>
              </View>

              <View style={styles.item}>
                <Text style={styles.label}>Usuario:</Text>
                <Text style={styles.value}>
                  {user ? `${user.nombre} (${user.role})` : 'No autenticado'}
                </Text>
              </View>

              <View style={styles.item}>
                <Text style={styles.label}>WebSocket:</Text>
                <View style={[styles.badge, connected ? styles.badgeGreen : styles.badgeRed]}>
                  <Text style={styles.badgeText}>{connected ? 'Conectado' : 'Desconectado'}</Text>
                </View>
              </View>

              <View style={styles.item}>
                <Text style={styles.label}>Último evento:</Text>
                <Text style={styles.value}>
                  {lastEvent ? lastEvent.event : 'Ninguno'}
                </Text>
              </View>

              {lastEvent && (
                <View style={styles.item}>
                  <Text style={styles.label}>Datos del evento:</Text>
                  <Text style={styles.code}>
                    {JSON.stringify(lastEvent.data, null, 2).substring(0, 500)}
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 80,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6B7280',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    zIndex: 1000,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  body: {
    padding: 16,
  },
  item: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  value: {
    fontSize: 14,
    color: '#111827',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  badgeGreen: {
    backgroundColor: '#DEF7EC',
  },
  badgeRed: {
    backgroundColor: '#FDE8E8',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  code: {
    fontSize: 12,
    fontFamily: 'monospace',
    backgroundColor: '#F3F4F6',
    padding: 8,
    borderRadius: 8,
    color: '#374151',
  },
});
