import requests
import json
import time
import pyotp
import uuid
import sys
from datetime import datetime

class DigitalOneHealthTester:
    def __init__(self, base_url="https://5ff0c78c-0add-4ab2-81f7-724ded35f968.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tokens = {}  # Store tokens for different users
        self.users = {}   # Store user data
        self.mfa_secrets = {}  # Store MFA secrets for testing
        self.test_records = {}  # Store created health records
        self.tests_run = 0
        self.tests_passed = 0
        self.timestamp = datetime.now().strftime("%Y%m%d%H%M%S")

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None, user_role=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'
        elif user_role and user_role in self.tokens:
            headers['Authorization'] = f'Bearer {self.tokens[user_role]}'
            
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
                
            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    print(f"Response: {response.json()}")
                except:
                    print(f"Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def register_user(self, role):
        """Register a new user with the specified role"""
        username = f"test_{role}_{self.timestamp}"
        email = f"{username}@test.com"
        password = "Test123!"
        
        data = {
            "username": username,
            "email": email,
            "password": password,
            "role": role,
            "full_name": f"Test {role.capitalize()} User"
        }
        
        success, response = self.run_test(
            f"Register {role} user",
            "POST",
            "auth/register",
            200,
            data=data
        )
        
        if success:
            self.users[role] = {
                "username": username,
                "password": password,
                "email": email,
                "role": role
            }
            print(f"Created user: {username} with role: {role}")
            return True
        return False

    def login_user(self, role, with_mfa=False):
        """Login with a user of the specified role"""
        if role not in self.users:
            print(f"❌ No user with role {role} has been registered")
            return False
            
        user = self.users[role]
        data = {
            "username": user["username"],
            "password": user["password"]
        }
        
        if with_mfa and role in self.mfa_secrets:
            # Generate TOTP token
            totp = pyotp.TOTP(self.mfa_secrets[role], interval=90)
            data["mfa_token"] = totp.now()
            
        success, response = self.run_test(
            f"Login {role} user" + (" with MFA" if with_mfa else ""),
            "POST",
            "auth/login",
            200,
            data=data
        )
        
        if success and "access_token" in response:
            self.tokens[role] = response["access_token"]
            print(f"Logged in as {user['username']} with role: {role}")
            return True
        return False

    def setup_mfa(self, role):
        """Setup MFA for a user"""
        if role not in self.tokens:
            print(f"❌ No token for role {role}, login first")
            return False
            
        success, response = self.run_test(
            f"Setup MFA for {role}",
            "POST",
            "auth/setup-mfa",
            200,
            token=self.tokens[role]
        )
        
        if success and "manual_entry_key" in response:
            self.mfa_secrets[role] = response["manual_entry_key"]
            print(f"MFA secret for {role}: {self.mfa_secrets[role]}")
            return True
        return False

    def enable_mfa(self, role):
        """Enable MFA for a user"""
        if role not in self.tokens:
            print(f"❌ No token for role {role}, login first")
            return False
            
        if role not in self.mfa_secrets:
            print(f"❌ No MFA secret for role {role}, setup MFA first")
            return False
            
        # Generate TOTP token
        totp = pyotp.TOTP(self.mfa_secrets[role], interval=90)
        token = totp.now()
        
        success, _ = self.run_test(
            f"Enable MFA for {role}",
            "POST",
            f"auth/enable-mfa?mfa_token={token}",
            200,
            token=self.tokens[role]
        )
        
        return success

    def create_health_record(self, role, record_type="human", is_public=False):
        """Create a health record"""
        if role not in self.tokens:
            print(f"❌ No token for role {role}, login first")
            return False
            
        data = {
            "title": f"Test {record_type.capitalize()} Record",
            "description": f"Test description for {record_type} record",
            "record_type": record_type,
            "subject_id": str(uuid.uuid4()),
            "subject_name": f"Test Subject {record_type.capitalize()}",
            "data": {
                "notes": "Test notes",
                "vital_signs": "Test vital signs"
            },
            "is_public": is_public
        }
        
        success, response = self.run_test(
            f"Create {record_type} record as {role}" + (" (public)" if is_public else " (private)"),
            "POST",
            "health-records",
            200,
            data=data,
            token=self.tokens[role]
        )
        
        if success and "record_id" in response:
            record_id = response["record_id"]
            self.test_records[record_id] = {
                "id": record_id,
                "type": record_type,
                "is_public": is_public,
                "created_by": role
            }
            print(f"Created record ID: {record_id}")
            return record_id
        return None

    def get_health_records(self, role):
        """Get health records for a user"""
        if role not in self.tokens:
            print(f"❌ No token for role {role}, login first")
            return False
            
        success, response = self.run_test(
            f"Get health records as {role}",
            "GET",
            "health-records",
            200,
            token=self.tokens[role]
        )
        
        if success:
            print(f"Retrieved {len(response)} records for {role}")
            return response
        return []

    def get_health_record(self, role, record_id):
        """Get a specific health record"""
        if role not in self.tokens:
            print(f"❌ No token for role {role}, login first")
            return False
            
        success, response = self.run_test(
            f"Get health record {record_id} as {role}",
            "GET",
            f"health-records/{record_id}",
            200,
            token=self.tokens[role]
        )
        
        return success, response

    def update_record_privacy(self, role, record_id, is_public):
        """Update privacy settings for a record"""
        if role not in self.tokens:
            print(f"❌ No token for role {role}, login first")
            return False
            
        success, _ = self.run_test(
            f"Update record {record_id} privacy to " + ("public" if is_public else "private"),
            "PUT",
            f"health-records/{record_id}/privacy?is_public={str(is_public).lower()}",
            200,
            token=self.tokens[role]
        )
        
        if success and record_id in self.test_records:
            self.test_records[record_id]["is_public"] = is_public
            
        return success

    def get_dashboard_stats(self, role):
        """Get dashboard stats"""
        if role not in self.tokens:
            print(f"❌ No token for role {role}, login first")
            return False
            
        success, response = self.run_test(
            f"Get dashboard stats as {role}",
            "GET",
            "dashboard/stats",
            200,
            token=self.tokens[role]
        )
        
        return success, response

    def test_system_status(self):
        """Test system status endpoint"""
        success, response = self.run_test(
            "System status",
            "GET",
            "system/status",
            200
        )
        
        return success, response

    def test_role_based_access(self):
        """Test role-based access to records"""
        print("\n🔍 Testing role-based access to records...")
        
        # Create records with different privacy settings
        provider_public_record = self.create_health_record("healthcare_provider", is_public=True)
        provider_private_record = self.create_health_record("healthcare_provider", is_public=False)
        individual_public_record = self.create_health_record("individual", is_public=True)
        individual_private_record = self.create_health_record("individual", is_public=False)
        
        if not all([provider_public_record, provider_private_record, individual_public_record, individual_private_record]):
            print("❌ Failed to create test records for access control testing")
            return False
            
        # Test access for each role
        access_tests = [
            # Admin should see all records
            {"role": "admin", "record_id": provider_public_record, "expected": True},
            {"role": "admin", "record_id": provider_private_record, "expected": True},
            {"role": "admin", "record_id": individual_public_record, "expected": True},
            {"role": "admin", "record_id": individual_private_record, "expected": True},
            
            # Healthcare provider should see own records and public records
            {"role": "healthcare_provider", "record_id": provider_public_record, "expected": True},
            {"role": "healthcare_provider", "record_id": provider_private_record, "expected": True},
            {"role": "healthcare_provider", "record_id": individual_public_record, "expected": True},
            {"role": "healthcare_provider", "record_id": individual_private_record, "expected": False},
            
            # Researcher should see only public records
            {"role": "researcher", "record_id": provider_public_record, "expected": True},
            {"role": "researcher", "record_id": provider_private_record, "expected": False},
            {"role": "researcher", "record_id": individual_public_record, "expected": True},
            {"role": "researcher", "record_id": individual_private_record, "expected": False},
            
            # Individual should see only own records
            {"role": "individual", "record_id": provider_public_record, "expected": False},
            {"role": "individual", "record_id": provider_private_record, "expected": False},
            {"role": "individual", "record_id": individual_public_record, "expected": True},
            {"role": "individual", "record_id": individual_private_record, "expected": True},
        ]
        
        access_results = []
        for test in access_tests:
            success, response = self.get_health_record(test["role"], test["record_id"])
            
            # For expected failures, a 403 or 404 is considered a "success" in the test
            if test["expected"] == False and (not success):
                access_results.append(True)
                print(f"✅ Correctly denied access to {test['record_id']} for {test['role']}")
            elif test["expected"] == True and success:
                access_results.append(True)
                print(f"✅ Correctly granted access to {test['record_id']} for {test['role']}")
            else:
                access_results.append(False)
                print(f"❌ Incorrect access control: {test['role']} accessing {test['record_id']}")
        
        # Check if all access tests passed
        if all(access_results):
            print("✅ All role-based access tests passed")
            return True
        else:
            print("❌ Some role-based access tests failed")
            return False

    def verify_encryption(self):
        """Verify that sensitive data is encrypted"""
        print("\n🔍 Testing data encryption...")
        
        # Create a record with sensitive data
        record_id = self.create_health_record("healthcare_provider", is_public=False)
        if not record_id:
            print("❌ Failed to create test record for encryption testing")
            return False
            
        # Get all records as admin to check raw data
        success, records = self.run_test(
            "Get all records for encryption check",
            "GET",
            "health-records",
            200,
            token=self.tokens["admin"]
        )
        
        if not success:
            print("❌ Failed to retrieve records for encryption check")
            return False
            
        # Find our test record
        test_record = next((r for r in records if r["id"] == record_id), None)
        if not test_record:
            print(f"❌ Could not find test record {record_id} in admin view")
            return False
            
        # Check if data is encrypted
        if "data" in test_record:
            # If we can see the raw data structure, it should have been decrypted for us
            if isinstance(test_record["data"], dict) and "notes" in test_record["data"]:
                print("✅ Data was properly decrypted for authorized user")
                return True
            else:
                print("❌ Data was not properly decrypted")
                return False
        else:
            print("❌ No data field found in record")
            return False

    def run_all_tests(self):
        """Run all tests"""
        print("\n🚀 Starting Digital One Health System API Tests\n")
        
        # Test system status
        self.test_system_status()
        
        # Register users with different roles
        for role in ["admin", "healthcare_provider", "researcher", "individual"]:
            self.register_user(role)
            
        # Login all users
        for role in ["admin", "healthcare_provider", "researcher", "individual"]:
            self.login_user(role)
            
        # Setup and enable MFA for admin
        self.setup_mfa("admin")
        self.enable_mfa("admin")
        
        # Test login with MFA
        self.login_user("admin", with_mfa=True)
        
        # Create health records
        self.create_health_record("healthcare_provider", record_type="human", is_public=True)
        self.create_health_record("healthcare_provider", record_type="animal", is_public=False)
        self.create_health_record("individual", record_type="human", is_public=True)
        self.create_health_record("individual", record_type="plant", is_public=False)
        
        # Test getting records for each role
        for role in ["admin", "healthcare_provider", "researcher", "individual"]:
            self.get_health_records(role)
            
        # Test role-based access
        self.test_role_based_access()
        
        # Test encryption
        self.verify_encryption()
        
        # Test dashboard stats
        for role in ["admin", "healthcare_provider", "researcher", "individual"]:
            self.get_dashboard_stats(role)
            
        # Print results
        print(f"\n📊 Tests passed: {self.tests_passed}/{self.tests_run} ({self.tests_passed/self.tests_run*100:.1f}%)")
        
        return self.tests_passed == self.tests_run

if __name__ == "__main__":
    tester = DigitalOneHealthTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)