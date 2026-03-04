import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Text, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Location {
  lat: number;
  lng: number;
}

interface MapTrackingProps {
  driverLocation?: Location | null;
  clientLocation?: Location | null;
  destinationText: string;
  originText: string;
}

export function MapTracking({ driverLocation, clientLocation, destinationText, originText }: MapTrackingProps) {
  const [mapLoaded, setMapLoaded] = useState(false);

  // Default center (Mexico City)
  const defaultCenter = { lat: 19.4326, lng: -99.1332 };
  
  const center = driverLocation || clientLocation || defaultCenter;
  
  // Create map HTML for web
  const mapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body, #map { width: 100%; height: 100%; }
        .driver-marker {
          background: #E11D48;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 3px solid white;
          box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        }
        .client-marker {
          background: #059669;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 3px solid white;
          box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        }
        .pulse {
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        const map = L.map('map').setView([${center.lat}, ${center.lng}], 15);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap'
        }).addTo(map);
        
        // Driver marker (motorcycle icon)
        ${driverLocation ? `
          const driverIcon = L.divIcon({
            className: 'driver-marker pulse',
            html: '<div style="background:#E11D48;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.3);"><svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M19 7c0-1.1-.9-2-2-2h-3v2h3v2.65L13.52 14H10V9H6c-2.21 0-4 1.79-4 4v3h2c0 1.66 1.34 3 3 3s3-1.34 3-3h4.48L19 10.35V7zM7 17c-.55 0-1-.45-1-1h2c0 .55-.45 1-1 1z"/><path d="M5 6h5v2H5zm14 7c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zm0 4c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/></svg></div>',
            iconSize: [40, 40],
            iconAnchor: [20, 20]
          });
          L.marker([${driverLocation.lat}, ${driverLocation.lng}], { icon: driverIcon })
            .addTo(map)
            .bindPopup('<b>🏍️ Repartidor</b><br>En camino...');
        ` : ''}
        
        // Client/Origin marker
        ${clientLocation ? `
          const clientIcon = L.divIcon({
            className: 'client-marker',
            html: '<div style="background:#059669;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.3);"><svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg></div>',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          });
          L.marker([${clientLocation.lat}, ${clientLocation.lng}], { icon: clientIcon })
            .addTo(map)
            .bindPopup('<b>📍 Origen</b><br>${originText.replace(/'/g, "\\'")}');
        ` : ''}
        
        // Fit bounds if both markers exist
        ${driverLocation && clientLocation ? `
          const bounds = L.latLngBounds([
            [${driverLocation.lat}, ${driverLocation.lng}],
            [${clientLocation.lat}, ${clientLocation.lng}]
          ]);
          map.fitBounds(bounds, { padding: [50, 50] });
        ` : ''}
        
        // Draw line between driver and destination if driver location exists
        ${driverLocation && clientLocation ? `
          L.polyline([
            [${driverLocation.lat}, ${driverLocation.lng}],
            [${clientLocation.lat}, ${clientLocation.lng}]
          ], {
            color: '#E11D48',
            weight: 3,
            opacity: 0.7,
            dashArray: '10, 10'
          }).addTo(map);
        ` : ''}
      </script>
    </body>
    </html>
  `;

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <View style={styles.mapHeader}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#E11D48' }]} />
            <Text style={styles.legendText}>Repartidor</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#059669' }]} />
            <Text style={styles.legendText}>Origen</Text>
          </View>
        </View>
        
        {driverLocation ? (
          <iframe
            srcDoc={mapHtml}
            style={{ width: '100%', height: 250, border: 'none', borderRadius: 16 }}
            title="Tracking Map"
          />
        ) : (
          <View style={styles.waitingContainer}>
            <ActivityIndicator size="small" color="#E11D48" />
            <Text style={styles.waitingText}>Esperando ubicación del repartidor...</Text>
          </View>
        )}
        
        {driverLocation && (
          <View style={styles.coordsContainer}>
            <Ionicons name="navigate" size={16} color="#7C3AED" />
            <Text style={styles.coordsText}>
              {driverLocation.lat.toFixed(6)}, {driverLocation.lng.toFixed(6)}
            </Text>
          </View>
        )}
      </View>
    );
  }

  // For native, use a simple view with coordinates (react-native-maps would be better for production)
  return (
    <View style={styles.container}>
      <View style={styles.nativeMapPlaceholder}>
        <Ionicons name="map" size={48} color="#E11D48" />
        <Text style={styles.nativeMapTitle}>Ubicación del repartidor</Text>
        {driverLocation ? (
          <View style={styles.coordsBox}>
            <Text style={styles.coordsLabel}>Latitud: {driverLocation.lat.toFixed(6)}</Text>
            <Text style={styles.coordsLabel}>Longitud: {driverLocation.lng.toFixed(6)}</Text>
          </View>
        ) : (
          <Text style={styles.waitingText}>Esperando ubicación...</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 8,
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#6B7280',
  },
  waitingContainer: {
    height: 200,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waitingText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 12,
  },
  coordsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDE9FE',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  coordsText: {
    fontSize: 12,
    color: '#7C3AED',
    marginLeft: 6,
    fontFamily: 'monospace',
  },
  nativeMapPlaceholder: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  nativeMapTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginTop: 12,
  },
  coordsBox: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    width: '100%',
  },
  coordsLabel: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
});
