#!/usr/bin/env python3
"""
TOKIO XPRESS Backend API Testing Suite
Tests all backend endpoints for the delivery app
"""

import requests
import json
import time
from datetime import datetime
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://ride-share-app-113.preview.emergentagent.com/api"
TIMEOUT = 30

class TokioXpressAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.session.timeout = TIMEOUT
        self.client_token = None
        self.driver_token = None
        self.client_user = None
        self.driver_user = None
        self.test_order_id = None
        self.timestamp = str(int(time.time()))
        
        # Test results tracking
        self.results = {
            "total_tests": 0,
            "passed": 0,
            "failed": 0,
            "errors": []
        }
    
    def log_result(self, test_name: str, success: bool, message: str = "", response_data: Any = None):
        """Log test result"""
        self.results["total_tests"] += 1
        if success:
            self.results["passed"] += 1
            print(f"✅ {test_name}: {message}")
        else:
            self.results["failed"] += 1
            error_msg = f"❌ {test_name}: {message}"
            if response_data:
                error_msg += f" | Response: {response_data}"
            print(error_msg)
            self.results["errors"].append(error_msg)
    
    def make_request(self, method: str, endpoint: str, data: Dict = None, 
                    token: str = None, form_data: bool = False) -> tuple:
        """Make HTTP request and return (success, response_data, status_code)"""
        url = f"{BASE_URL}{endpoint}"
        headers = {"Content-Type": "application/json"}
        
        if token:
            headers["Authorization"] = f"Bearer {token}"
        
        try:
            if method.upper() == "GET":
                response = self.session.get(url, headers=headers)
            elif method.upper() == "POST":
                if form_data:
                    headers.pop("Content-Type")  # Let requests set it for form data
                    response = self.session.post(url, data=data, headers=headers)
                else:
                    response = self.session.post(url, json=data, headers=headers)
            elif method.upper() == "PATCH":
                response = self.session.patch(url, json=data, headers=headers)
            else:
                return False, f"Unsupported method: {method}", 0
            
            try:
                response_data = response.json()
            except:
                response_data = response.text
            
            return response.status_code < 400, response_data, response.status_code
            
        except requests.exceptions.RequestException as e:
            return False, str(e), 0
    
    def test_health_check(self):
        """Test health check endpoint"""
        success, data, status = self.make_request("GET", "/health")
        
        if success and isinstance(data, dict) and data.get("status") == "healthy":
            self.log_result("Health Check", True, f"Service healthy, {data.get('websocket_connections', 0)} WS connections")
        else:
            self.log_result("Health Check", False, f"Health check failed", data)
    
    def test_register_client(self):
        """Test client registration"""
        client_data = {
            "nombre": "Test Cliente",
            "email": f"cliente_{self.timestamp}@test.com",
            "password": "testpass123",
            "role": "cliente"
        }
        
        success, data, status = self.make_request("POST", "/auth/register", client_data)
        
        if success and isinstance(data, dict) and "access_token" in data:
            self.client_token = data["access_token"]
            self.client_user = data["user"]
            self.log_result("Client Registration", True, f"Registered client: {self.client_user['email']}")
        else:
            self.log_result("Client Registration", False, f"Registration failed (status: {status})", data)
    
    def test_register_driver(self):
        """Test driver registration"""
        driver_data = {
            "nombre": "Test Repartidor",
            "email": f"repartidor_{self.timestamp}@test.com",
            "password": "testpass123",
            "role": "repartidor"
        }
        
        success, data, status = self.make_request("POST", "/auth/register", driver_data)
        
        if success and isinstance(data, dict) and "access_token" in data:
            self.driver_token = data["access_token"]
            self.driver_user = data["user"]
            self.log_result("Driver Registration", True, f"Registered driver: {self.driver_user['email']}")
        else:
            self.log_result("Driver Registration", False, f"Registration failed (status: {status})", data)
    
    def test_login_client(self):
        """Test client login"""
        if not self.client_user:
            self.log_result("Client Login", False, "No client user to test login")
            return
        
        login_data = {
            "username": self.client_user["email"],
            "password": "testpass123"
        }
        
        success, data, status = self.make_request("POST", "/auth/login", login_data, form_data=True)
        
        if success and isinstance(data, dict) and "access_token" in data:
            self.log_result("Client Login", True, f"Login successful for {data['user']['email']}")
        else:
            self.log_result("Client Login", False, f"Login failed (status: {status})", data)
    
    def test_login_driver(self):
        """Test driver login"""
        if not self.driver_user:
            self.log_result("Driver Login", False, "No driver user to test login")
            return
        
        login_data = {
            "username": self.driver_user["email"],
            "password": "testpass123"
        }
        
        success, data, status = self.make_request("POST", "/auth/login", login_data, form_data=True)
        
        if success and isinstance(data, dict) and "access_token" in data:
            self.log_result("Driver Login", True, f"Login successful for {data['user']['email']}")
        else:
            self.log_result("Driver Login", False, f"Login failed (status: {status})", data)
    
    def test_get_current_user_client(self):
        """Test get current user for client"""
        if not self.client_token:
            self.log_result("Get Current User (Client)", False, "No client token available")
            return
        
        success, data, status = self.make_request("GET", "/auth/me", token=self.client_token)
        
        if success and isinstance(data, dict) and data.get("role") == "cliente":
            self.log_result("Get Current User (Client)", True, f"Retrieved user: {data['nombre']}")
        else:
            self.log_result("Get Current User (Client)", False, f"Failed to get user (status: {status})", data)
    
    def test_get_current_user_driver(self):
        """Test get current user for driver"""
        if not self.driver_token:
            self.log_result("Get Current User (Driver)", False, "No driver token available")
            return
        
        success, data, status = self.make_request("GET", "/auth/me", token=self.driver_token)
        
        if success and isinstance(data, dict) and data.get("role") == "repartidor":
            self.log_result("Get Current User (Driver)", True, f"Retrieved user: {data['nombre']}")
        else:
            self.log_result("Get Current User (Driver)", False, f"Failed to get user (status: {status})", data)
    
    def test_create_order(self):
        """Test creating an order as client"""
        if not self.client_token:
            self.log_result("Create Order", False, "No client token available")
            return
        
        order_data = {
            "tipo_servicio": "moto_mandado",
            "descripcion": "Entregar documentos importantes",
            "origen_texto": "Calle 123 #45-67, Bogotá",
            "destino_texto": "Carrera 15 #32-10, Bogotá",
            "client_location": {
                "lat": 4.6097,
                "lng": -74.0817
            }
        }
        
        success, data, status = self.make_request("POST", "/orders", order_data, token=self.client_token)
        
        if success and isinstance(data, dict) and "id" in data:
            self.test_order_id = data["id"]
            self.log_result("Create Order", True, f"Order created: {data['id']}, Status: {data['status']}")
        else:
            self.log_result("Create Order", False, f"Order creation failed (status: {status})", data)
    
    def test_get_my_orders(self):
        """Test getting client's orders"""
        if not self.client_token:
            self.log_result("Get My Orders", False, "No client token available")
            return
        
        success, data, status = self.make_request("GET", "/orders/my", token=self.client_token)
        
        if success and isinstance(data, list):
            order_count = len(data)
            self.log_result("Get My Orders", True, f"Retrieved {order_count} orders")
        else:
            self.log_result("Get My Orders", False, f"Failed to get orders (status: {status})", data)
    
    def test_get_pending_orders(self):
        """Test getting pending orders as driver"""
        if not self.driver_token:
            self.log_result("Get Pending Orders", False, "No driver token available")
            return
        
        success, data, status = self.make_request("GET", "/orders/pending", token=self.driver_token)
        
        if success and isinstance(data, list):
            pending_count = len(data)
            self.log_result("Get Pending Orders", True, f"Retrieved {pending_count} pending orders")
        else:
            self.log_result("Get Pending Orders", False, f"Failed to get pending orders (status: {status})", data)
    
    def test_accept_order(self):
        """Test accepting an order as driver"""
        if not self.driver_token or not self.test_order_id:
            self.log_result("Accept Order", False, "No driver token or test order available")
            return
        
        success, data, status = self.make_request("POST", f"/orders/{self.test_order_id}/accept", 
                                                token=self.driver_token)
        
        if success and isinstance(data, dict) and data.get("status") == "aceptado":
            self.log_result("Accept Order", True, f"Order accepted, assigned to: {data.get('repartidor_nombre')}")
        else:
            self.log_result("Accept Order", False, f"Failed to accept order (status: {status})", data)
    
    def test_update_order_status(self):
        """Test updating order status"""
        if not self.driver_token or not self.test_order_id:
            self.log_result("Update Order Status", False, "No driver token or test order available")
            return
        
        status_data = {"status": "en_camino"}
        
        success, data, status = self.make_request("PATCH", f"/orders/{self.test_order_id}/status", 
                                                status_data, token=self.driver_token)
        
        if success and isinstance(data, dict) and data.get("status") == "en_camino":
            self.log_result("Update Order Status", True, f"Status updated to: {data['status']}")
        else:
            self.log_result("Update Order Status", False, f"Failed to update status (status: {status})", data)
    
    def test_update_driver_location(self):
        """Test updating driver location"""
        if not self.driver_token or not self.test_order_id:
            self.log_result("Update Driver Location", False, "No driver token or test order available")
            return
        
        location_data = {
            "lat": 4.6110,
            "lng": -74.0820
        }
        
        success, data, status = self.make_request("PATCH", f"/orders/{self.test_order_id}/location", 
                                                location_data, token=self.driver_token)
        
        if success and isinstance(data, dict) and data.get("driver_location"):
            self.log_result("Update Driver Location", True, 
                          f"Location updated: {data['driver_location']['lat']}, {data['driver_location']['lng']}")
        else:
            self.log_result("Update Driver Location", False, f"Failed to update location (status: {status})", data)
    
    def test_send_chat_message(self):
        """Test sending a chat message"""
        if not self.client_token or not self.test_order_id:
            self.log_result("Send Chat Message", False, "No client token or test order available")
            return
        
        message_data = {"message": "Hola, ¿cuánto tiempo falta para la entrega?"}
        
        success, data, status = self.make_request("POST", f"/orders/{self.test_order_id}/chat", 
                                                message_data, token=self.client_token)
        
        if success and isinstance(data, dict) and "id" in data:
            self.log_result("Send Chat Message", True, f"Message sent: {data['message'][:50]}...")
        else:
            self.log_result("Send Chat Message", False, f"Failed to send message (status: {status})", data)
    
    def test_get_chat_messages(self):
        """Test getting chat messages"""
        if not self.driver_token or not self.test_order_id:
            self.log_result("Get Chat Messages", False, "No driver token or test order available")
            return
        
        success, data, status = self.make_request("GET", f"/orders/{self.test_order_id}/chat", 
                                                token=self.driver_token)
        
        if success and isinstance(data, list):
            message_count = len(data)
            self.log_result("Get Chat Messages", True, f"Retrieved {message_count} messages")
        else:
            self.log_result("Get Chat Messages", False, f"Failed to get messages (status: {status})", data)
    
    def test_complete_order(self):
        """Test completing an order"""
        if not self.driver_token or not self.test_order_id:
            self.log_result("Complete Order", False, "No driver token or test order available")
            return
        
        status_data = {"status": "completado"}
        
        success, data, status = self.make_request("PATCH", f"/orders/{self.test_order_id}/status", 
                                                status_data, token=self.driver_token)
        
        if success and isinstance(data, dict) and data.get("status") == "completado":
            self.log_result("Complete Order", True, f"Order completed successfully")
        else:
            self.log_result("Complete Order", False, f"Failed to complete order (status: {status})", data)
    
    def test_create_rating(self):
        """Test creating a rating for completed order"""
        if not self.client_token or not self.test_order_id:
            self.log_result("Create Rating", False, "No client token or test order available")
            return
        
        rating_data = {
            "stars": 5,
            "comment": "Excelente servicio, muy rápido y profesional!"
        }
        
        success, data, status = self.make_request("POST", f"/orders/{self.test_order_id}/rating", 
                                                rating_data, token=self.client_token)
        
        if success and isinstance(data, dict) and "id" in data:
            self.log_result("Create Rating", True, f"Rating created: {data['stars']} stars")
        else:
            self.log_result("Create Rating", False, f"Failed to create rating (status: {status})", data)
    
    def test_get_driver_ratings(self):
        """Test getting driver ratings"""
        if not self.driver_user:
            self.log_result("Get Driver Ratings", False, "No driver user available")
            return
        
        success, data, status = self.make_request("GET", f"/ratings/repartidor/{self.driver_user['id']}")
        
        if success and isinstance(data, dict) and "average" in data:
            self.log_result("Get Driver Ratings", True, 
                          f"Driver rating: {data['average']} stars ({data['count']} ratings)")
        else:
            self.log_result("Get Driver Ratings", False, f"Failed to get ratings (status: {status})", data)
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print(f"\n🚀 Starting TOKIO XPRESS API Tests - {datetime.now()}")
        print(f"📍 Base URL: {BASE_URL}")
        print(f"🔖 Test ID: {self.timestamp}")
        print("=" * 60)
        
        # Health check
        self.test_health_check()
        
        # Authentication flow
        print("\n📋 AUTHENTICATION TESTS")
        self.test_register_client()
        self.test_register_driver()
        self.test_login_client()
        self.test_login_driver()
        self.test_get_current_user_client()
        self.test_get_current_user_driver()
        
        # Order flow
        print("\n📦 ORDER FLOW TESTS")
        self.test_create_order()
        self.test_get_my_orders()
        self.test_get_pending_orders()
        self.test_accept_order()
        self.test_update_order_status()
        self.test_update_driver_location()
        
        # Chat flow
        print("\n💬 CHAT TESTS")
        self.test_send_chat_message()
        self.test_get_chat_messages()
        
        # Complete order and rating
        print("\n⭐ COMPLETION & RATING TESTS")
        self.test_complete_order()
        self.test_create_rating()
        self.test_get_driver_ratings()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print(f"✅ Passed: {self.results['passed']}")
        print(f"❌ Failed: {self.results['failed']}")
        print(f"📈 Total: {self.results['total_tests']}")
        
        if self.results['failed'] > 0:
            print(f"\n🔍 FAILED TESTS:")
            for error in self.results['errors']:
                print(f"   {error}")
        
        success_rate = (self.results['passed'] / self.results['total_tests']) * 100 if self.results['total_tests'] > 0 else 0
        print(f"\n🎯 Success Rate: {success_rate:.1f}%")
        
        return self.results

if __name__ == "__main__":
    tester = TokioXpressAPITester()
    results = tester.run_all_tests()