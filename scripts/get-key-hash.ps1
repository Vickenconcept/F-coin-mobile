# PowerShell script to generate Android Key Hash for Facebook/Meta
# This script generates the debug key hash

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Facebook/Meta Key Hash Generator" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Auto-detect Java keytool
$keytoolPath = $null

# First, try to find keytool in PATH
$keytoolInPath = Get-Command keytool -ErrorAction SilentlyContinue
if ($keytoolInPath) {
    $keytoolPath = $keytoolInPath.Path
} else {
    # Try common Java installation locations
    $javaPaths = @(
        "$env:JAVA_HOME\bin\keytool.exe",
        "C:\Program Files\Java\jdk-*\bin\keytool.exe",
        "C:\Program Files (x86)\Java\jdk-*\bin\keytool.exe",
        "C:\Program Files\Eclipse Adoptium\*\bin\keytool.exe"
    )
    
    foreach ($path in $javaPaths) {
        $resolved = Resolve-Path $path -ErrorAction SilentlyContinue
        if ($resolved) {
            $keytoolPath = $resolved[0].Path
            break
        }
    }
    
    # Try to find any JDK installation
    if (-not $keytoolPath) {
        $jdkDirs = Get-ChildItem "C:\Program Files\Java" -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "jdk*" }
        if ($jdkDirs) {
            $latestJdk = $jdkDirs | Sort-Object Name -Descending | Select-Object -First 1
            $keytoolPath = Join-Path $latestJdk.FullName "bin\keytool.exe"
            if (-not (Test-Path $keytoolPath)) {
                $keytoolPath = $null
            }
        }
    }
}

if (-not $keytoolPath -or -not (Test-Path $keytoolPath)) {
    Write-Host "ERROR: 'keytool' not found" -ForegroundColor Red
    Write-Host "Please install Java JDK and add it to your PATH" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Download Java JDK from: https://adoptium.net/" -ForegroundColor Yellow
    exit 1
}

Write-Host "Found keytool at: $keytoolPath" -ForegroundColor Gray

# Auto-detect OpenSSL
$opensslPath = $null

# First, try to find openssl in PATH
$opensslInPath = Get-Command openssl -ErrorAction SilentlyContinue
if ($opensslInPath) {
    $opensslPath = $opensslInPath.Path
} else {
    # Try Git's OpenSSL (most common on Windows)
    $gitOpenSSL = "C:\Program Files\Git\usr\bin\openssl.exe"
    if (Test-Path $gitOpenSSL) {
        $opensslPath = $gitOpenSSL
    }
}

if (-not $opensslPath -or -not (Test-Path $opensslPath)) {
    Write-Host "ERROR: 'openssl' not found" -ForegroundColor Red
    Write-Host "Please install OpenSSL" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "For Windows, you can:" -ForegroundColor Yellow
    Write-Host "1. Install Git for Windows (includes OpenSSL)" -ForegroundColor Yellow
    Write-Host "2. Or install OpenSSL from: https://slproweb.com/products/Win32OpenSSL.html" -ForegroundColor Yellow
    exit 1
}

Write-Host "Found openssl at: $opensslPath" -ForegroundColor Gray
Write-Host ""

# Default debug keystore path
$debugKeystore = "$env:USERPROFILE\.android\debug.keystore"

if (-not (Test-Path $debugKeystore)) {
    Write-Host "WARNING: Debug keystore not found at: $debugKeystore" -ForegroundColor Yellow
    Write-Host "This is normal if you haven't built an Android app yet." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To generate the debug keystore, run:" -ForegroundColor Cyan
    Write-Host "  keytool -genkey -v -keystore $debugKeystore -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 -storepass android -keypass android" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "Generating DEBUG key hash..." -ForegroundColor Green
Write-Host "Using keystore: $debugKeystore" -ForegroundColor Gray
Write-Host ""

try {
    # Export certificate and generate hash
    $certOutput = & $keytoolPath -exportcert -alias androiddebugkey -keystore $debugKeystore -storepass android -keypass android 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to export certificate" -ForegroundColor Red
        Write-Host $certOutput -ForegroundColor Red
        exit 1
    }
    
    # Convert to base64 hash using OpenSSL
    $hash = $certOutput | & $opensslPath sha1 -binary | & $opensslPath base64
    
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "DEBUG KEY HASH (Copy this to Facebook):" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host $hash.Trim() -ForegroundColor White
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Copy the key hash above" -ForegroundColor Yellow
    Write-Host "2. Go to Facebook Developer Console" -ForegroundColor Yellow
    Write-Host "3. Add this key hash to your Android app settings" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "NOTE: For RELEASE builds, you'll need to generate a hash" -ForegroundColor Yellow
    Write-Host "      from your release keystore (after building with EAS)" -ForegroundColor Yellow
    
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

