#!/usr/bin/env python3
"""
TOKIO XPRESS v2.0 NEW ENDPOINTS Testing
Testing specific NEW endpoints added in v2.0 as requested
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://ride-share-app-113.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@tokioxpress.com"
ADMIN_PASSWORD = "admin123"
COURIER_EMAIL = "repartidor@test.com"
COURIER_PASSWORD = "123456"

class TokioV2Tester:
    def __init__(self):
        self.session = requests.Session()
        self.admin_token = None
        self.courier_token = None
        self.client_token = None
        self.test_results = []
        self.test_user_id = None
        self.test_order_id = None
        
    def log_test(self, test_name, success, details=""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })
        print(f"{status} {test_name}")
        if details:
            print(f"    Details: {details}")
        print()

    def make_request(self, method, endpoint, token=None, **kwargs):
        """Make HTTP request with optional authentication"""
        url = f"{BASE_URL}{endpoint}"
        headers = kwargs.get('headers', {})
        
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        kwargs['headers'] = headers
        
        try:
            response = self.session.request(method, url, **kwargs)
            return response
        except Exception as e:
            print(f"Request failed: {e}")
            return None

    def test_admin_login(self):
        """Test admin login"""
        try:
            response = self.make_request(
                'POST', 
                '/auth/login',
                data={
                    'username': ADMIN_EMAIL,
                    'password': ADMIN_PASSWORD
                }
            )
            
            if response and response.status_code == 200:
                data = response.json()
                if 'access_token' in data and data.get('user', {}).get('role') == 'admin':
                    self.admin_token = data['access_token']
                    self.log_test("Admin Login", True, f"Admin user: {data['user']['nombre']}")
                    return True
                else:
                    self.log_test("Admin Login", False, "Invalid response structure")
            else:
                self.log_test("Admin Login", False, f"Status: {response.status_code if response else 'No response'}")
        except Exception as e:
            self.log_test("Admin Login", False, f"Exception: {str(e)}")
        return False

    def test_courier_login(self):
        """Test courier login"""
        try:
            response = self.make_request(
                'POST', 
                '/auth/login',
                data={
                    'username': COURIER_EMAIL,
                    'password': COURIER_PASSWORD
                }
            )
            
            if response and response.status_code == 200:
                data = response.json()
                if 'access_token' in data and data.get('user', {}).get('role') == 'repartidor':
                    self.courier_token = data['access_token']
                    self.log_test("Courier Login", True, f"Courier user: {data['user']['nombre']}")
                    return True
                else:
                    self.log_test("Courier Login", False, "Invalid response structure")
            else:
                self.log_test("Courier Login", False, f"Status: {response.status_code if response else 'No response'}")
        except Exception as e:
            self.log_test("Courier Login", False, f"Exception: {str(e)}")
        return False

    def create_test_client(self):
        """Create a test client user for testing admin endpoints"""
        try:
            test_email = f"testclient_{datetime.now().strftime('%Y%m%d_%H%M%S')}@test.com"
            response = self.make_request(
                'POST',
                '/auth/register',
                json={
                    'nombre': 'Test Client User',
                    'email': test_email,
                    'password': 'testpass123',
                    'role': 'cliente'
                }
            )
            
            if response and response.status_code == 200:
                data = response.json()
                self.client_token = data['access_token']
                self.test_user_id = data['user']['id']
                self.log_test("Create Test Client", True, f"Created user: {test_email}")
                return True
            else:
                self.log_test("Create Test Client", False, f"Status: {response.status_code if response else 'No response'}")
        except Exception as e:
            self.log_test("Create Test Client", False, f"Exception: {str(e)}")
        return False

    def create_test_order(self):
        """Create a test order for testing NEW FIELDS"""
        if not self.client_token:
            return False
            
        try:
            response = self.make_request(
                'POST',
                '/orders',
                token=self.client_token,
                json={
                    'tipo_servicio': 'moto_mandado',
                    'descripcion': 'Test delivery order for v2.0 testing',
                    'origen_texto': 'Plaza Mayor, Ciudad de México',
                    'destino_texto': 'Aeropuerto Internacional CDMX',
                    'client_location': {'lat': 19.4326, 'lng': -99.1332},
                    'payment_method': 'efectivo'
                }
            )
            
            if response and response.status_code == 200:
                data = response.json()
                self.test_order_id = data['id']
                # Check NEW fields
                has_payment_method = 'payment_method' in data
                has_payment_status = 'payment_status' in data
                has_amount = 'amount' in data
                
                if has_payment_method and has_payment_status and has_amount:
                    self.log_test("NEW Order Fields Test", True, 
                                f"Order ID: {self.test_order_id}, Payment: {data['payment_method']}, Status: {data['payment_status']}, Amount: {data['amount']}")
                    return True
                else:
                    self.log_test("NEW Order Fields Test", False, 
                                f"Missing new fields - payment_method: {has_payment_method}, payment_status: {has_payment_status}, amount: {has_amount}")
            else:
                self.log_test("NEW Order Fields Test", False, f"Status: {response.status_code if response else 'No response'}")
        except Exception as e:
            self.log_test("NEW Order Fields Test", False, f"Exception: {str(e)}")
        return False

    def test_admin_stats(self):
        """Test GET /admin/stats - NEW ENDPOINT"""
        if not self.admin_token:
            self.log_test("GET /admin/stats", False, "No admin token available")
            return False
            
        try:
            response = self.make_request('GET', '/admin/stats', token=self.admin_token)
            
            if response and response.status_code == 200:
                data = response.json()
                required_keys = ['users', 'orders', 'revenue']
                if all(key in data for key in required_keys):
                    self.log_test("GET /admin/stats", True, f"Stats retrieved - Users: {data['users']['total']}, Orders: {data['orders']['total']}, Revenue: {data['revenue']['total']}")
                    return True
                else:
                    self.log_test("GET /admin/stats", False, f"Missing required keys in response: {list(data.keys())}")
            else:
                self.log_test("GET /admin/stats", False, f"Status: {response.status_code if response else 'No response'}")
        except Exception as e:
            self.log_test("GET /admin/stats", False, f"Exception: {str(e)}")
        return False

    def test_admin_users(self):
        """Test GET /admin/users - NEW ENDPOINT"""
        if not self.admin_token:
            self.log_test("GET /admin/users", False, "No admin token available")
            return False
            
        try:
            response = self.make_request('GET', '/admin/users', token=self.admin_token)
            
            if response and response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and len(data) > 0:
                    self.log_test("GET /admin/users", True, f"Retrieved {len(data)} users")
                    return True
                else:
                    self.log_test("GET /admin/users", False, f"Invalid response format or empty list")
            else:
                self.log_test("GET /admin/users", False, f"Status: {response.status_code if response else 'No response'}")
        except Exception as e:
            self.log_test("GET /admin/users", False, f"Exception: {str(e)}")
        return False

    def test_admin_orders(self):
        """Test GET /admin/orders - NEW ENDPOINT"""
        if not self.admin_token:
            self.log_test("GET /admin/orders", False, "No admin token available")
            return False
            
        try:
            # Test without filter
            response = self.make_request('GET', '/admin/orders', token=self.admin_token)
            
            if response and response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("GET /admin/orders", True, f"Retrieved {len(data)} orders")
                    
                    # Test with status filter
                    response_filtered = self.make_request('GET', '/admin/orders?status=pendiente', token=self.admin_token)
                    if response_filtered and response_filtered.status_code == 200:
                        filtered_data = response_filtered.json()
                        self.log_test("GET /admin/orders (with filter)", True, f"Retrieved {len(filtered_data)} pending orders")
                        return True
                    else:
                        self.log_test("GET /admin/orders (with filter)", False, f"Filter test failed")
                else:
                    self.log_test("GET /admin/orders", False, f"Invalid response format")
            else:
                self.log_test("GET /admin/orders", False, f"Status: {response.status_code if response else 'No response'}")
        except Exception as e:
            self.log_test("GET /admin/orders", False, f"Exception: {str(e)}")
        return False

    def test_admin_block_user(self):
        """Test PATCH /admin/users/{user_id}/status - NEW ENDPOINT"""
        if not self.admin_token or not self.test_user_id:
            self.log_test("PATCH /admin/users/{user_id}/status", False, "No admin token or test user available")
            return False
            
        try:
            # Block user
            response = self.make_request(
                'PATCH', 
                f'/admin/users/{self.test_user_id}/status',
                token=self.admin_token,
                json={'is_active': False}
            )
            
            if response and response.status_code == 200:
                data = response.json()
                if data.get('is_active') == False:
                    # Unblock user
                    response_unblock = self.make_request(
                        'PATCH', 
                        f'/admin/users/{self.test_user_id}/status',
                        token=self.admin_token,
                        json={'is_active': True}
                    )
                    
                    if response_unblock and response_unblock.status_code == 200:
                        unblock_data = response_unblock.json()
                        if unblock_data.get('is_active') == True:
                            self.log_test("PATCH /admin/users/{user_id}/status", True, f"Successfully blocked and unblocked user {self.test_user_id}")
                            return True
                        else:
                            self.log_test("PATCH /admin/users/{user_id}/status", False, "Unblock failed")
                    else:
                        self.log_test("PATCH /admin/users/{user_id}/status", False, "Unblock request failed")
                else:
                    self.log_test("PATCH /admin/users/{user_id}/status", False, "Block operation failed")
            else:
                self.log_test("PATCH /admin/users/{user_id}/status", False, f"Status: {response.status_code if response else 'No response'}")
        except Exception as e:
            self.log_test("PATCH /admin/users/{user_id}/status", False, f"Exception: {str(e)}")
        return False

    def test_admin_assign_driver(self):
        """Test PATCH /admin/orders/{order_id}/assign - NEW ENDPOINT"""
        if not self.admin_token or not self.test_order_id:
            self.log_test("PATCH /admin/orders/{order_id}/assign", False, "No admin token or test order available")
            return False
            
        try:
            # First get a courier ID
            users_response = self.make_request('GET', '/admin/users?role=repartidor', token=self.admin_token)
            if not users_response or users_response.status_code != 200:
                self.log_test("PATCH /admin/orders/{order_id}/assign", False, "Could not get courier list")
                return False
                
            couriers = users_response.json()
            if not couriers:
                self.log_test("PATCH /admin/orders/{order_id}/assign", False, "No couriers available")
                return False
                
            courier_id = couriers[0]['id']
            
            response = self.make_request(
                'PATCH',
                f'/admin/orders/{self.test_order_id}/assign',
                token=self.admin_token,
                json={'repartidor_id': courier_id}
            )
            
            if response and response.status_code == 200:
                data = response.json()
                if data.get('repartidor_id') == courier_id:
                    self.log_test("PATCH /admin/orders/{order_id}/assign", True, f"Successfully assigned courier {courier_id} to order {self.test_order_id}")
                    return True
                else:
                    self.log_test("PATCH /admin/orders/{order_id}/assign", False, "Assignment not reflected in response")
            else:
                self.log_test("PATCH /admin/orders/{order_id}/assign", False, f"Status: {response.status_code if response else 'No response'}")
        except Exception as e:
            self.log_test("PATCH /admin/orders/{order_id}/assign", False, f"Exception: {str(e)}")
        return False

    def test_admin_update_order_status(self):
        """Test PATCH /admin/orders/{order_id}/status - NEW ENDPOINT"""
        if not self.admin_token or not self.test_order_id:
            self.log_test("PATCH /admin/orders/{order_id}/status", False, "No admin token or test order available")
            return False
            
        try:
            response = self.make_request(
                'PATCH',
                f'/admin/orders/{self.test_order_id}/status',
                token=self.admin_token,
                json={'status': 'en_camino'}
            )
            
            if response and response.status_code == 200:
                data = response.json()
                if data.get('status') == 'en_camino':
                    self.log_test("PATCH /admin/orders/{order_id}/status", True, f"Successfully updated order status to 'en_camino'")
                    return True
                else:
                    self.log_test("PATCH /admin/orders/{order_id}/status", False, f"Status not updated correctly: {data.get('status')}")
            else:
                self.log_test("PATCH /admin/orders/{order_id}/status", False, f"Status: {response.status_code if response else 'No response'}")
        except Exception as e:
            self.log_test("PATCH /admin/orders/{order_id}/status", False, f"Exception: {str(e)}")
        return False

    def test_courier_stats(self):
        """Test GET /courier/stats - NEW ENDPOINT"""
        if not self.courier_token:
            self.log_test("GET /courier/stats", False, "No courier token available")
            return False
            
        try:
            response = self.make_request('GET', '/courier/stats', token=self.courier_token)
            
            if response and response.status_code == 200:
                data = response.json()
                required_keys = ['total_deliveries', 'deliveries_today', 'deliveries_week', 'deliveries_month', 
                               'earnings_today', 'earnings_week', 'earnings_month', 'average_rating', 'total_ratings']
                
                if all(key in data for key in required_keys):
                    self.log_test("GET /courier/stats", True, 
                                f"Stats retrieved - Total deliveries: {data['total_deliveries']}, "
                                f"Today: {data['deliveries_today']}, Rating: {data['average_rating']}")
                    return True
                else:
                    missing_keys = [key for key in required_keys if key not in data]
                    self.log_test("GET /courier/stats", False, f"Missing keys: {missing_keys}")
            else:
                self.log_test("GET /courier/stats", False, f"Status: {response.status_code if response else 'No response'}")
        except Exception as e:
            self.log_test("GET /courier/stats", False, f"Exception: {str(e)}")
        return False

    def test_payment_config(self):
        """Test GET /payments/config - NEW ENDPOINT"""
        try:
            response = self.make_request('GET', '/payments/config')
            
            if response and response.status_code == 200:
                data = response.json()
                required_keys = ['stripe_configured', 'currency', 'delivery_fee']
                
                if all(key in data for key in required_keys):
                    self.log_test("GET /payments/config", True, 
                                f"Config retrieved - Stripe: {data['stripe_configured']}, "
                                f"Currency: {data['currency']}, Fee: {data['delivery_fee']}")
                    return True
                else:
                    missing_keys = [key for key in required_keys if key not in data]
                    self.log_test("GET /payments/config", False, f"Missing keys: {missing_keys}")
            else:
                self.log_test("GET /payments/config", False, f"Status: {response.status_code if response else 'No response'}")
        except Exception as e:
            self.log_test("GET /payments/config", False, f"Exception: {str(e)}")
        return False

    def test_health_check_v2(self):
        """Test GET /health - Verify version 2.0 and features object"""
        try:
            response = self.make_request('GET', '/health')
            
            if response and response.status_code == 200:
                data = response.json()
                
                # Check version
                if data.get('version') == '2.0':
                    # Check features object
                    if 'features' in data and isinstance(data['features'], dict):
                        features = data['features']
                        if 'push_notifications' in features and 'stripe_payments' in features:
                            self.log_test("GET /health (v2.0)", True, 
                                        f"Version: {data['version']}, Service: {data.get('service')}, "
                                        f"Features: Push={features['push_notifications']}, Stripe={features['stripe_payments']}")
                            return True
                        else:
                            self.log_test("GET /health (v2.0)", False, f"Missing features in features object: {features}")
                    else:
                        self.log_test("GET /health (v2.0)", False, "Missing or invalid features object")
                else:
                    self.log_test("GET /health (v2.0)", False, f"Wrong version: {data.get('version')} (expected 2.0)")
            else:
                self.log_test("GET /health (v2.0)", False, f"Status: {response.status_code if response else 'No response'}")
        except Exception as e:
            self.log_test("GET /health (v2.0)", False, f"Exception: {str(e)}")
        return False

    def run_all_tests(self):
        """Run all NEW v2.0 endpoint tests"""
        print("🚀 TOKIO XPRESS v2.0 NEW ENDPOINTS TESTING")
        print("=" * 60)
        print(f"📍 Base URL: {BASE_URL}")
        print(f"🎯 Testing NEW endpoints added in v2.0")
        print()
        
        # Authentication tests
        print("🔐 AUTHENTICATION SETUP")
        print("-" * 30)
        admin_login_success = self.test_admin_login()
        courier_login_success = self.test_courier_login()
        client_creation_success = self.create_test_client()
        print()
        
        # Order creation test (to verify NEW fields)
        print("📦 NEW ORDER FIELDS TEST")
        print("-" * 30)
        order_creation_success = self.create_test_order()
        print()
        
        # Admin endpoint tests (NEW in v2.0)
        print("👑 NEW ADMIN ENDPOINTS")
        print("-" * 30)
        if admin_login_success:
            self.test_admin_stats()
            self.test_admin_users()
            self.test_admin_orders()
            if client_creation_success:
                self.test_admin_block_user()
            if order_creation_success:
                self.test_admin_assign_driver()
                self.test_admin_update_order_status()
        else:
            self.log_test("Admin Tests Skipped", False, "Admin login failed")
        print()
        
        # Courier endpoint tests (NEW in v2.0)
        print("🏍️ NEW COURIER ENDPOINTS")
        print("-" * 30)
        if courier_login_success:
            self.test_courier_stats()
        else:
            self.log_test("Courier Tests Skipped", False, "Courier login failed")
        print()
        
        # Payment endpoint tests (NEW in v2.0)
        print("💳 NEW PAYMENT ENDPOINTS")
        print("-" * 30)
        self.test_payment_config()
        print()
        
        # Health check test (v2.0 verification)
        print("🏥 HEALTH CHECK v2.0")
        print("-" * 25)
        self.test_health_check_v2()
        print()
        
        # Summary
        self.print_summary()

    def print_summary(self):
        """Print test summary"""
        print("=" * 60)
        print("📊 TOKIO XPRESS v2.0 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result['success'])
        total = len(self.test_results)
        failed = total - passed
        
        print(f"Total Tests: {total}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"Success Rate: {(passed/total*100):.1f}%")
        print()
        
        if failed > 0:
            print("❌ FAILED TESTS:")
            print("-" * 20)
            for result in self.test_results:
                if not result['success']:
                    print(f"• {result['test']}: {result['details']}")
            print()
        
        print("✅ PASSED TESTS:")
        print("-" * 20)
        for result in self.test_results:
            if result['success']:
                print(f"• {result['test']}")
        
        return passed, failed, total

if __name__ == "__main__":
    tester = TokioV2Tester()
    tester.run_all_tests()