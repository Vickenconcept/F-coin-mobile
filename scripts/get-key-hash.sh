#!/bin/bash
# Bash script to generate Android Key Hash for Facebook/Meta
# This script generates the debug key hash

echo "========================================"
echo "Facebook/Meta Key Hash Generator"
echo "========================================"
echo ""

# Check if Java keytool is available
if ! command -v keytool &> /dev/null; then
    echo "ERROR: 'keytool' not found in PATH"
    echo "Please install Java JDK and add it to your PATH"
    echo ""
    echo "On macOS: brew install openjdk"
    echo "On Linux: sudo apt-get install default-jdk"
    exit 1
fi

# Check if OpenSSL is available
if ! command -v openssl &> /dev/null; then
    echo "ERROR: 'openssl' not found in PATH"
    echo "Please install OpenSSL"
    echo ""
    echo "On macOS: brew install openssl"
    echo "On Linux: sudo apt-get install openssl"
    exit 1
fi

# Default debug keystore path
DEBUG_KEYSTORE="$HOME/.android/debug.keystore"

if [ ! -f "$DEBUG_KEYSTORE" ]; then
    echo "WARNING: Debug keystore not found at: $DEBUG_KEYSTORE"
    echo "This is normal if you haven't built an Android app yet."
    echo ""
    echo "To generate the debug keystore, run:"
    echo "  keytool -genkey -v -keystore $DEBUG_KEYSTORE -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 -storepass android -keypass android"
    echo ""
    exit 1
fi

echo "Generating DEBUG key hash..."
echo "Using keystore: $DEBUG_KEYSTORE"
echo ""

# Export certificate and generate hash
HASH=$(keytool -exportcert -alias androiddebugkey -keystore "$DEBUG_KEYSTORE" -storepass android -keypass android 2>/dev/null | openssl sha1 -binary | openssl base64)

if [ -z "$HASH" ]; then
    echo "ERROR: Failed to generate key hash"
    exit 1
fi

echo "========================================"
echo "DEBUG KEY HASH (Copy this to Facebook):"
echo "========================================"
echo "$HASH"
echo ""
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Copy the key hash above"
echo "2. Go to Facebook Developer Console"
echo "3. Add this key hash to your Android app settings"
echo ""
echo "NOTE: For RELEASE builds, you'll need to generate a hash"
echo "      from your release keystore (after building with EAS)"

