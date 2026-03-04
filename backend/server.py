from fastapi import FastAPI, APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect, status, Query
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any, Set
import uuid
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
import json
import asyncio

# Try to import pywebpush, if not available create placeholder
try:
    from pywebpush import webpush, WebPushException
    WEBPUSH_AVAILABLE = True
except ImportError:
    WEBPUSH_AVAILABLE = False
    logging.warning("pywebpush not available - push notifications disabled")

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'tokio_xpress')]

# JWT Configuration
SECRET_KEY = os.environ.get("SECRET_KEY", "tokio-xpress-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# VAPID Configuration for Web Push
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "")
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_CLAIMS = {"sub": "mailto:admin@tokioxpress.com"}

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

# Create the main app
app = FastAPI(title="TOKIO XPRESS API")
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============== MODELS ==============

# Valid roles and statuses
VALID_ROLES = ["cliente", "repartidor", "admin"]
VALID_STATUSES = ["pendiente", "aceptado", "en_camino", "completado", "cancelado"]
VALID_SERVICE_TYPES = ["moto_mandado", "moto_transporte"]

class Location(BaseModel):
    lat: float
    lng: float

class UserBase(BaseModel):
    nombre: str
    email: EmailStr
    role: str = Field(default="cliente")

class UserCreate(UserBase):
    password: str

class UserResponse(BaseModel):
    id: str
    nombre: str
    email: str
    role: str
    created_at: datetime

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class OrderCreate(BaseModel):
    tipo_servicio: str
    descripcion: str
    origen_texto: str
    destino_texto: str
    client_location: Optional[Location] = None

class OrderResponse(BaseModel):
    id: str
    cliente_id: str
    repartidor_id: Optional[str] = None
    tipo_servicio: str
    descripcion: str
    origen_texto: str
    destino_texto: str
    client_location: Optional[Location] = None
    driver_location: Optional[Location] = None
    status: str
    created_at: datetime
    updated_at: datetime
    cliente_nombre: Optional[str] = None
    repartidor_nombre: Optional[str] = None

class StatusUpdate(BaseModel):
    status: str

class LocationUpdate(BaseModel):
    lat: float
    lng: float

class ChatMessageCreate(BaseModel):
    message: str

class ChatMessageResponse(BaseModel):
    id: str
    order_id: str
    sender_id: str
    sender_role: str
    message: str
    created_at: datetime

class RatingCreate(BaseModel):
    stars: int = Field(ge=1, le=5)
    comment: Optional[str] = None

class RatingResponse(BaseModel):
    id: str
    order_id: str
    cliente_id: str
    repartidor_id: str
    stars: int
    comment: Optional[str] = None
    created_at: datetime

class PushSubscriptionCreate(BaseModel):
    endpoint: str
    keys: Dict[str, str]

# ============== WebSocket Manager ==============

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}  # user_id -> websocket
        self.user_roles: Dict[str, str] = {}  # user_id -> role
        
    async def connect(self, websocket: WebSocket, user_id: str, role: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        self.user_roles[user_id] = role
        logger.info(f"User {user_id} ({role}) connected. Total: {len(self.active_connections)}")
        
    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        if user_id in self.user_roles:
            del self.user_roles[user_id]
        logger.info(f"User {user_id} disconnected. Total: {len(self.active_connections)}")
        
    async def send_to_user(self, user_id: str, event: str, data: dict):
        if user_id in self.active_connections:
            try:
                message = {"event": event, "data": data}
                await self.active_connections[user_id].send_json(message)
                logger.info(f"Sent {event} to user {user_id}")
            except Exception as e:
                logger.error(f"Error sending to user {user_id}: {e}")
                self.disconnect(user_id)
                
    async def broadcast_to_role(self, role: str, event: str, data: dict):
        disconnected = []
        for user_id, user_role in self.user_roles.items():
            if user_role == role:
                try:
                    message = {"event": event, "data": data}
                    await self.active_connections[user_id].send_json(message)
                    logger.info(f"Broadcast {event} to {user_id} ({role})")
                except Exception as e:
                    logger.error(f"Error broadcasting to {user_id}: {e}")
                    disconnected.append(user_id)
        for uid in disconnected:
            self.disconnect(uid)

manager = ConnectionManager()

# ============== Helper Functions ==============

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: Optional[str] = Depends(oauth2_scheme)):
    if not token:
        raise HTTPException(status_code=401, detail="No se proporcionó token")
    credentials_exception = HTTPException(
        status_code=401,
        detail="No se pudo validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"id": user_id})
    if user is None:
        raise credentials_exception
    return user

async def get_optional_user(token: Optional[str] = Depends(oauth2_scheme)):
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id:
            return await db.users.find_one({"id": user_id})
    except:
        pass
    return None

def user_to_response(user: dict) -> UserResponse:
    return UserResponse(
        id=user["id"],
        nombre=user["nombre"],
        email=user["email"],
        role=user["role"],
        created_at=user["created_at"]
    )

async def order_to_response(order: dict) -> OrderResponse:
    cliente = await db.users.find_one({"id": order.get("cliente_id")})
    repartidor = await db.users.find_one({"id": order.get("repartidor_id")}) if order.get("repartidor_id") else None
    
    return OrderResponse(
        id=order["id"],
        cliente_id=order["cliente_id"],
        repartidor_id=order.get("repartidor_id"),
        tipo_servicio=order["tipo_servicio"],
        descripcion=order["descripcion"],
        origen_texto=order["origen_texto"],
        destino_texto=order["destino_texto"],
        client_location=Location(**order["client_location"]) if order.get("client_location") else None,
        driver_location=Location(**order["driver_location"]) if order.get("driver_location") else None,
        status=order["status"],
        created_at=order["created_at"],
        updated_at=order["updated_at"],
        cliente_nombre=cliente["nombre"] if cliente else None,
        repartidor_nombre=repartidor["nombre"] if repartidor else None
    )

async def send_push_notification(user_id: str, title: str, body: str, data: dict = None):
    """Send push notification to a user"""
    if not WEBPUSH_AVAILABLE or not VAPID_PRIVATE_KEY:
        logger.warning("Push notifications not configured")
        return
    
    subscriptions = await db.push_subscriptions.find({"user_id": user_id}).to_list(100)
    for sub in subscriptions:
        try:
            payload = json.dumps({
                "title": title,
                "body": body,
                "data": data or {}
            })
            webpush(
                subscription_info={
                    "endpoint": sub["endpoint"],
                    "keys": sub["keys"]
                },
                data=payload,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims=VAPID_CLAIMS
            )
            logger.info(f"Push sent to user {user_id}")
        except Exception as e:
            logger.error(f"Push error for user {user_id}: {e}")

async def send_push_to_role(role: str, title: str, body: str, data: dict = None):
    """Send push notification to all users of a role"""
    if not WEBPUSH_AVAILABLE or not VAPID_PRIVATE_KEY:
        return
    
    subscriptions = await db.push_subscriptions.find({"user_role": role}).to_list(1000)
    for sub in subscriptions:
        try:
            payload = json.dumps({
                "title": title,
                "body": body,
                "data": data or {}
            })
            webpush(
                subscription_info={
                    "endpoint": sub["endpoint"],
                    "keys": sub["keys"]
                },
                data=payload,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims=VAPID_CLAIMS
            )
        except Exception as e:
            logger.error(f"Push error: {e}")

# ============== AUTH ENDPOINTS ==============

@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    # Normalize role
    role = user_data.role.lower()
    if role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Rol inválido. Debe ser uno de: {VALID_ROLES}")
    
    # Check if email exists
    existing = await db.users.find_one({"email": user_data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email ya registrado")
    
    # Create user
    user = {
        "id": str(uuid.uuid4()),
        "nombre": user_data.nombre,
        "email": user_data.email.lower(),
        "password_hash": get_password_hash(user_data.password),
        "role": role,
        "created_at": datetime.utcnow()
    }
    
    await db.users.insert_one(user)
    
    # Create token
    access_token = create_access_token(data={"sub": user["id"], "role": user["role"]})
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=user_to_response(user)
    )

@api_router.post("/auth/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await db.users.find_one({"email": form_data.username.lower()})
    if not user or not verify_password(form_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")
    
    access_token = create_access_token(data={"sub": user["id"], "role": user["role"]})
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=user_to_response(user)
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return user_to_response(current_user)

# ============== PUSH NOTIFICATION ENDPOINTS ==============

@api_router.get("/push/public-key")
async def get_vapid_public_key():
    return {"public_key": VAPID_PUBLIC_KEY}

@api_router.post("/push/subscribe")
async def subscribe_push(
    subscription: PushSubscriptionCreate,
    current_user: dict = Depends(get_current_user)
):
    # Remove existing subscription with same endpoint
    await db.push_subscriptions.delete_many({"endpoint": subscription.endpoint})
    
    # Save new subscription
    sub_doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "user_role": current_user["role"],
        "endpoint": subscription.endpoint,
        "keys": subscription.keys,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    await db.push_subscriptions.insert_one(sub_doc)
    
    return {"message": "Suscripción guardada"}

@api_router.post("/push/test")
async def test_push(current_user: dict = Depends(get_current_user)):
    await send_push_notification(
        current_user["id"],
        "TOKIO XPRESS",
        "¡Las notificaciones funcionan correctamente!"
    )
    return {"message": "Notificación enviada"}

# ============== ORDER ENDPOINTS ==============

@api_router.post("/orders", response_model=OrderResponse)
async def create_order(
    order_data: OrderCreate,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "cliente":
        raise HTTPException(status_code=403, detail="Solo clientes pueden crear pedidos")
    
    if order_data.tipo_servicio not in VALID_SERVICE_TYPES:
        raise HTTPException(status_code=400, detail=f"Tipo de servicio inválido")
    
    order = {
        "id": str(uuid.uuid4()),
        "cliente_id": current_user["id"],
        "repartidor_id": None,
        "tipo_servicio": order_data.tipo_servicio,
        "descripcion": order_data.descripcion,
        "origen_texto": order_data.origen_texto,
        "destino_texto": order_data.destino_texto,
        "client_location": order_data.client_location.dict() if order_data.client_location else None,
        "driver_location": None,
        "status": "pendiente",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.orders.insert_one(order)
    
    order_response = await order_to_response(order)
    
    # Emit to all drivers via WebSocket
    await manager.broadcast_to_role("repartidor", "order:new", order_response.dict())
    
    # Send push to drivers
    asyncio.create_task(send_push_to_role(
        "repartidor",
        "Nuevo pedido disponible",
        f"{order_data.tipo_servicio}: {order_data.origen_texto} → {order_data.destino_texto}"
    ))
    
    return order_response

@api_router.get("/orders/my", response_model=List[OrderResponse])
async def get_my_orders(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "cliente":
        raise HTTPException(status_code=403, detail="Solo para clientes")
    
    orders = await db.orders.find({"cliente_id": current_user["id"]}).sort("created_at", -1).to_list(100)
    return [await order_to_response(o) for o in orders]

@api_router.get("/orders/pending", response_model=List[OrderResponse])
async def get_pending_orders(current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["repartidor", "admin"]:
        raise HTTPException(status_code=403, detail="Solo para repartidores")
    
    orders = await db.orders.find({"status": "pendiente"}).sort("created_at", -1).to_list(100)
    return [await order_to_response(o) for o in orders]

@api_router.get("/orders/driver/my", response_model=List[OrderResponse])
async def get_driver_orders(current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["repartidor", "admin"]:
        raise HTTPException(status_code=403, detail="Solo para repartidores")
    
    orders = await db.orders.find({"repartidor_id": current_user["id"]}).sort("created_at", -1).to_list(100)
    return [await order_to_response(o) for o in orders]

@api_router.get("/orders/{order_id}", response_model=OrderResponse)
async def get_order(order_id: str, current_user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    
    # Permission check
    is_owner = order["cliente_id"] == current_user["id"]
    is_assigned_driver = order.get("repartidor_id") == current_user["id"]
    is_admin = current_user["role"] == "admin"
    is_available_driver = current_user["role"] == "repartidor" and order["status"] == "pendiente"
    
    if not (is_owner or is_assigned_driver or is_admin or is_available_driver):
        raise HTTPException(status_code=403, detail="No tienes permiso para ver este pedido")
    
    return await order_to_response(order)

@api_router.post("/orders/{order_id}/accept", response_model=OrderResponse)
async def accept_order(order_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "repartidor":
        raise HTTPException(status_code=403, detail="Solo repartidores pueden aceptar pedidos")
    
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    
    if order["status"] != "pendiente":
        raise HTTPException(status_code=400, detail="Este pedido ya no está disponible")
    
    # Update order
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "repartidor_id": current_user["id"],
            "status": "aceptado",
            "updated_at": datetime.utcnow()
        }}
    )
    
    updated_order = await db.orders.find_one({"id": order_id})
    order_response = await order_to_response(updated_order)
    
    # Notify client via WebSocket
    await manager.send_to_user(order["cliente_id"], "order:accepted", order_response.dict())
    
    # Send push to client
    asyncio.create_task(send_push_notification(
        order["cliente_id"],
        "Pedido aceptado",
        f"{current_user['nombre']} ha aceptado tu pedido"
    ))
    
    return order_response

@api_router.patch("/orders/{order_id}/status", response_model=OrderResponse)
async def update_order_status(
    order_id: str,
    status_data: StatusUpdate,
    current_user: dict = Depends(get_current_user)
):
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    
    # Only assigned driver or admin can update
    is_assigned = order.get("repartidor_id") == current_user["id"]
    is_admin = current_user["role"] == "admin"
    
    if not (is_assigned or is_admin):
        raise HTTPException(status_code=403, detail="Solo el repartidor asignado puede actualizar el estado")
    
    new_status = status_data.status.lower()
    if new_status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Estado inválido. Debe ser uno de: {VALID_STATUSES}")
    
    # Update
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": new_status, "updated_at": datetime.utcnow()}}
    )
    
    updated_order = await db.orders.find_one({"id": order_id})
    order_response = await order_to_response(updated_order)
    
    # Notify client
    await manager.send_to_user(order["cliente_id"], "order:status", order_response.dict())
    
    # Push notification
    status_messages = {
        "en_camino": "Tu repartidor está en camino",
        "completado": "Tu pedido ha sido completado",
        "cancelado": "Tu pedido ha sido cancelado"
    }
    if new_status in status_messages:
        asyncio.create_task(send_push_notification(
            order["cliente_id"],
            "TOKIO XPRESS",
            status_messages[new_status]
        ))
    
    return order_response

@api_router.patch("/orders/{order_id}/location", response_model=OrderResponse)
async def update_driver_location(
    order_id: str,
    location: LocationUpdate,
    current_user: dict = Depends(get_current_user)
):
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    
    if order.get("repartidor_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Solo el repartidor asignado puede actualizar ubicación")
    
    # Update location
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "driver_location": {"lat": location.lat, "lng": location.lng},
            "updated_at": datetime.utcnow()
        }}
    )
    
    updated_order = await db.orders.find_one({"id": order_id})
    order_response = await order_to_response(updated_order)
    
    # Notify client
    await manager.send_to_user(order["cliente_id"], "order:location", order_response.dict())
    
    return order_response

# ============== CHAT ENDPOINTS ==============

@api_router.get("/orders/{order_id}/chat", response_model=List[ChatMessageResponse])
async def get_chat_messages(order_id: str, current_user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    
    # Permission check
    is_owner = order["cliente_id"] == current_user["id"]
    is_assigned = order.get("repartidor_id") == current_user["id"]
    is_admin = current_user["role"] == "admin"
    
    if not (is_owner or is_assigned or is_admin):
        raise HTTPException(status_code=403, detail="No tienes acceso a este chat")
    
    messages = await db.chat_messages.find({"order_id": order_id}).sort("created_at", 1).to_list(500)
    return [ChatMessageResponse(**m) for m in messages]

@api_router.post("/orders/{order_id}/chat", response_model=ChatMessageResponse)
async def send_chat_message(
    order_id: str,
    message_data: ChatMessageCreate,
    current_user: dict = Depends(get_current_user)
):
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    
    # Permission check
    is_owner = order["cliente_id"] == current_user["id"]
    is_assigned = order.get("repartidor_id") == current_user["id"]
    
    if not (is_owner or is_assigned):
        raise HTTPException(status_code=403, detail="No tienes acceso a este chat")
    
    message = {
        "id": str(uuid.uuid4()),
        "order_id": order_id,
        "sender_id": current_user["id"],
        "sender_role": current_user["role"],
        "message": message_data.message,
        "created_at": datetime.utcnow()
    }
    
    await db.chat_messages.insert_one(message)
    
    message_response = ChatMessageResponse(**message)
    
    # Determine recipient
    recipient_id = order["repartidor_id"] if is_owner else order["cliente_id"]
    
    # Notify recipient via WebSocket
    if recipient_id:
        await manager.send_to_user(recipient_id, "chat:new", {
            "order_id": order_id,
            "message": message_response.dict()
        })
        
        # Push notification
        asyncio.create_task(send_push_notification(
            recipient_id,
            "Nuevo mensaje",
            f"{current_user['nombre']}: {message_data.message[:50]}"
        ))
    
    return message_response

# ============== RATING ENDPOINTS ==============

@api_router.post("/orders/{order_id}/rating", response_model=RatingResponse)
async def create_rating(
    order_id: str,
    rating_data: RatingCreate,
    current_user: dict = Depends(get_current_user)
):
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    
    if order["cliente_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Solo el cliente puede calificar")
    
    if order["status"] != "completado":
        raise HTTPException(status_code=400, detail="Solo puedes calificar pedidos completados")
    
    if not order.get("repartidor_id"):
        raise HTTPException(status_code=400, detail="Este pedido no tiene repartidor asignado")
    
    # Check if already rated
    existing = await db.ratings.find_one({"order_id": order_id})
    if existing:
        raise HTTPException(status_code=400, detail="Ya calificaste este pedido")
    
    rating = {
        "id": str(uuid.uuid4()),
        "order_id": order_id,
        "cliente_id": current_user["id"],
        "repartidor_id": order["repartidor_id"],
        "stars": rating_data.stars,
        "comment": rating_data.comment,
        "created_at": datetime.utcnow()
    }
    
    await db.ratings.insert_one(rating)
    
    return RatingResponse(**rating)

@api_router.get("/ratings/repartidor/{repartidor_id}")
async def get_driver_ratings(repartidor_id: str):
    ratings = await db.ratings.find({"repartidor_id": repartidor_id}).to_list(100)
    
    if not ratings:
        return {"average": 0, "count": 0, "ratings": []}
    
    total = sum(r["stars"] for r in ratings)
    average = round(total / len(ratings), 1)
    
    return {
        "average": average,
        "count": len(ratings),
        "ratings": [RatingResponse(**r) for r in ratings]
    }

# ============== ADMIN ENDPOINTS ==============

@api_router.get("/admin/orders", response_model=List[OrderResponse])
async def get_all_orders(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Solo administradores")
    
    orders = await db.orders.find().sort("created_at", -1).to_list(1000)
    return [await order_to_response(o) for o in orders]

@api_router.get("/admin/users")
async def get_all_users(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Solo administradores")
    
    users = await db.users.find().to_list(1000)
    return [user_to_response(u) for u in users]

# ============== WEBSOCKET ==============

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(None)):
    if not token:
        await websocket.close(code=4001)
        return
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        role = payload.get("role")
        
        if not user_id or not role:
            await websocket.close(code=4001)
            return
            
    except JWTError:
        await websocket.close(code=4001)
        return
    
    await manager.connect(websocket, user_id, role)
    
    try:
        while True:
            data = await websocket.receive_text()
            # Handle ping/pong or other messages if needed
            try:
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
            except:
                pass
    except WebSocketDisconnect:
        manager.disconnect(user_id)
    except Exception as e:
        logger.error(f"WebSocket error for {user_id}: {e}")
        manager.disconnect(user_id)

# ============== HEALTH CHECK ==============

@api_router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "TOKIO XPRESS",
        "timestamp": datetime.utcnow().isoformat(),
        "websocket_connections": len(manager.active_connections)
    }

@api_router.get("/")
async def root():
    return {"message": "TOKIO XPRESS API v1.0"}

# Include router and configure app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
