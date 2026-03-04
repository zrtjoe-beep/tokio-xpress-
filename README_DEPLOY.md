# TOKIO XPRESS - Documentación de Deployment

## Variables de Entorno

### Backend (`/backend/.env`)

```env
# MongoDB Connection
MONGO_URL=mongodb+srv://user:password@cluster.mongodb.net/tokio_xpress
DB_NAME=tokio_xpress

# JWT Secret (cambiar en producción)
SECRET_KEY=your-super-secret-key-change-in-production-min-32-chars

# Business Configuration
DELIVERY_FEE=50.00
CURRENCY=mxn

# Push Notifications (VAPID)
# Generar con: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key

# Stripe Payments (opcional)
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### Frontend (`/frontend/.env`)

```env
EXPO_PUBLIC_BACKEND_URL=https://your-backend-url.com
```

---

## Pruebas con curl

### 1. Health Check
```bash
curl https://your-api-url/api/health
```

### 2. Registro de Usuario
```bash
# Registrar cliente
curl -X POST https://your-api-url/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"nombre": "Juan Test", "email": "cliente@test.com", "password": "123456", "role": "cliente"}'

# Registrar repartidor
curl -X POST https://your-api-url/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"nombre": "Pedro Driver", "email": "driver@test.com", "password": "123456", "role": "repartidor"}'

# Registrar admin
curl -X POST https://your-api-url/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"nombre": "Admin", "email": "admin@test.com", "password": "admin123", "role": "admin"}'
```

### 3. Login
```bash
curl -X POST https://your-api-url/api/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=cliente@test.com&password=123456"
```

### 4. Crear Pedido (como cliente)
```bash
curl -X POST https://your-api-url/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "tipo_servicio": "moto_mandado",
    "descripcion": "Entregar documentos",
    "origen_texto": "Calle 123, Centro",
    "destino_texto": "Avenida Principal 456",
    "payment_method": "efectivo"
  }'
```

### 5. Ver Pedidos Pendientes (como repartidor)
```bash
curl https://your-api-url/api/orders/pending \
  -H "Authorization: Bearer DRIVER_TOKEN"
```

### 6. Aceptar Pedido (como repartidor)
```bash
curl -X POST https://your-api-url/api/orders/{ORDER_ID}/accept \
  -H "Authorization: Bearer DRIVER_TOKEN"
```

### 7. Actualizar Estado
```bash
curl -X PATCH https://your-api-url/api/orders/{ORDER_ID}/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer DRIVER_TOKEN" \
  -d '{"status": "en_camino"}'
```

### 8. Actualizar Ubicación del Repartidor
```bash
curl -X PATCH https://your-api-url/api/orders/{ORDER_ID}/location \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer DRIVER_TOKEN" \
  -d '{"lat": 19.4326, "lng": -99.1332}'
```

### 9. Enviar Mensaje de Chat
```bash
curl -X POST https://your-api-url/api/orders/{ORDER_ID}/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"message": "Hola, ya voy en camino!"}'
```

### 10. Calificar Repartidor (después de completado)
```bash
curl -X POST https://your-api-url/api/orders/{ORDER_ID}/rating \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer CLIENT_TOKEN" \
  -d '{"stars": 5, "comment": "Excelente servicio!"}'
```

### 11. Estadísticas del Repartidor
```bash
curl https://your-api-url/api/courier/stats \
  -H "Authorization: Bearer DRIVER_TOKEN"
```

### 12. Estadísticas Admin
```bash
curl https://your-api-url/api/admin/stats \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

## Checklist de Producción

### Backend
- [ ] Cambiar SECRET_KEY a una clave segura de 32+ caracteres
- [ ] Configurar MONGO_URL con credenciales de producción
- [ ] Configurar VAPID keys para push notifications
- [ ] Configurar Stripe keys para pagos (si aplica)
- [ ] Verificar CORS está configurado correctamente
- [ ] Habilitar HTTPS

### Frontend
- [ ] Actualizar EXPO_PUBLIC_BACKEND_URL con URL de producción
- [ ] Configurar app.json con bundle identifiers correctos
- [ ] Generar builds de producción con EAS

### Base de Datos
- [ ] Crear índices en MongoDB:
  ```javascript
  db.users.createIndex({ "email": 1 }, { unique: true })
  db.orders.createIndex({ "cliente_id": 1 })
  db.orders.createIndex({ "repartidor_id": 1 })
  db.orders.createIndex({ "status": 1 })
  db.orders.createIndex({ "created_at": -1 })
  ```

### Seguridad
- [ ] Verificar rate limiting en endpoints sensibles
- [ ] Configurar firewall para MongoDB
- [ ] Habilitar logs de acceso

---

## Deployment en Render

### Backend (FastAPI)

1. Crear nuevo "Web Service"
2. Conectar repositorio de GitHub
3. Configurar:
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`
   - **Environment Variables**: Agregar todas las del `.env`

### Frontend (Expo Web)

1. Build para web: `npx expo export --platform web`
2. Subir carpeta `dist` a Netlify/Vercel
3. Configurar redirect para SPA:
   ```
   /* /index.html 200
   ```

### MongoDB Atlas

1. Crear cluster en [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Crear usuario de base de datos
3. Agregar IPs permitidas (o 0.0.0.0/0 para desarrollo)
4. Copiar connection string a MONGO_URL

---

## Endpoints Disponibles (v2.0)

### Auth
- `POST /api/auth/register` - Registro
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Usuario actual

### Orders
- `POST /api/orders` - Crear pedido
- `GET /api/orders/my` - Mis pedidos (cliente)
- `GET /api/orders/pending` - Pedidos pendientes
- `GET /api/orders/driver/my` - Mis entregas (repartidor)
- `GET /api/orders/{id}` - Detalle
- `GET /api/orders/{id}/courier-location` - Ubicación repartidor
- `POST /api/orders/{id}/accept` - Aceptar
- `PATCH /api/orders/{id}/status` - Cambiar estado
- `PATCH /api/orders/{id}/location` - Actualizar ubicación

### Chat
- `GET /api/orders/{id}/chat` - Mensajes
- `POST /api/orders/{id}/chat` - Enviar mensaje

### Ratings
- `POST /api/orders/{id}/rating` - Calificar
- `GET /api/ratings/repartidor/{id}` - Rating del repartidor

### Courier
- `GET /api/courier/stats` - Estadísticas
- `POST /api/courier/location` - Actualizar ubicación

### Admin
- `GET /api/admin/users` - Lista usuarios
- `GET /api/admin/orders` - Lista pedidos
- `GET /api/admin/stats` - Estadísticas globales
- `PATCH /api/admin/users/{id}/status` - Bloquear/activar usuario
- `PATCH /api/admin/orders/{id}/assign` - Asignar repartidor
- `PATCH /api/admin/orders/{id}/status` - Cambiar estado

### Payments
- `GET /api/payments/config` - Configuración
- `POST /api/payments/create-intent` - Crear PaymentIntent
- `POST /api/payments/webhook` - Webhook Stripe

### Push
- `GET /api/push/public-key` - VAPID public key
- `POST /api/push/subscribe` - Suscribirse
- `POST /api/push/unsubscribe` - Desuscribirse
- `POST /api/push/test` - Probar notificación

### WebSocket
- `WS /ws?token=xxx` - Conexión tiempo real

---

## Soporte

Para reportar issues o solicitar features, contactar al equipo de desarrollo.
