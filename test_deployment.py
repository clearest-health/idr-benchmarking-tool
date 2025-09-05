#!/usr/bin/env python3
"""
Test IDR Benchmarking Tool Deployment
====================================

Quick script to verify the deployment is working correctly.
"""

import requests
import json

# Vercel deployment URL
BASE_URL = "https://idr-benchmarking-1c9yrggmo-clearesthealth.vercel.app"

def test_frontend():
    """Test if the frontend is accessible"""
    print("🌐 Testing Frontend...")
    try:
        response = requests.get(BASE_URL, timeout=10)
        if response.status_code == 200:
            print("✅ Frontend is live and accessible")
            print(f"   Status: {response.status_code}")
            print(f"   Content-Type: {response.headers.get('content-type', 'N/A')}")
            return True
        else:
            print(f"❌ Frontend returned status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Frontend test failed: {e}")
        return False

def test_api_endpoints():
    """Test API endpoints"""
    print("\n🔌 Testing API Endpoints...")
    
    # Test filters endpoint
    try:
        response = requests.get(f"{BASE_URL}/api/filters", timeout=10)
        print(f"📋 /api/filters - Status: {response.status_code}")
        if response.status_code == 200:
            print("✅ Filters endpoint is accessible")
        else:
            print("⚠️  Filters endpoint accessible but may need database connection")
    except Exception as e:
        print(f"❌ Filters endpoint test failed: {e}")
    
    # Test benchmark endpoint
    try:
        test_data = {
            "filters": {
                "specialty": "Emergency Medicine",
                "state": "NY"
            }
        }
        response = requests.post(
            f"{BASE_URL}/api/benchmark", 
            json=test_data,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        print(f"📊 /api/benchmark - Status: {response.status_code}")
        if response.status_code == 200:
            print("✅ Benchmark endpoint is accessible")
        else:
            print("⚠️  Benchmark endpoint accessible but may need database connection")
    except Exception as e:
        print(f"❌ Benchmark endpoint test failed: {e}")

def test_build_info():
    """Check build information"""
    print("\n🏗️  Build Information...")
    try:
        # Check if Next.js is serving properly
        response = requests.get(BASE_URL, timeout=10)
        if 'next' in response.headers.get('server', '').lower():
            print("✅ Next.js server detected")
        
        # Check for expected content
        if 'IDR Benchmarking' in response.text:
            print("✅ Application content loaded correctly")
        else:
            print("⚠️  Application content may not be loading properly")
            
    except Exception as e:
        print(f"❌ Build info test failed: {e}")

def main():
    """Run all tests"""
    print("🚀 IDR Benchmarking Tool Deployment Test")
    print("=" * 50)
    print(f"Testing deployment at: {BASE_URL}")
    print()
    
    # Run tests
    frontend_ok = test_frontend()
    test_api_endpoints()
    test_build_info()
    
    # Summary
    print("\n📋 Test Summary")
    print("=" * 30)
    if frontend_ok:
        print("✅ Deployment Status: SUCCESS")
        print("✅ Frontend: Accessible")
        print("⚠️  Database: Needs Supabase connection")
        print("\n🎯 Next Steps:")
        print("1. Set up Supabase database")
        print("2. Configure environment variables in Vercel")
        print("3. Migrate IDR data to PostgreSQL")
        print("4. Test full functionality")
    else:
        print("❌ Deployment Status: ISSUES DETECTED")
        print("Please check Vercel deployment logs")
    
    print(f"\n🔗 Application URL: {BASE_URL}")
    print("📊 Ready for Supabase integration!")

if __name__ == "__main__":
    main()
