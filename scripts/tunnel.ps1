# Dev Tunnel Management Script for Allocatrix
# This script sets up and runs a dev tunnel for Schwab OAuth redirect

$PORT = 3000
$TUNNEL_FILE = ".devtunnel"

Write-Host "🔧 Allocatrix Dev Tunnel Manager" -ForegroundColor Cyan
Write-Host ""

# Check if devtunnel is installed
if (-not (Get-Command devtunnel -ErrorAction SilentlyContinue)) {
    Write-Host "❌ devtunnel CLI not found!" -ForegroundColor Red
    Write-Host "Please install it using: winget install Microsoft.devtunnel" -ForegroundColor Yellow
    exit 1
}

# Check if user is logged in
$loginCheck = devtunnel user show 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "🔐 Logging into devtunnel..." -ForegroundColor Yellow
    devtunnel user login
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to login to devtunnel" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Logged in successfully" -ForegroundColor Green
}

# Check if we have a saved tunnel ID
$tunnelId = $null
if (Test-Path $TUNNEL_FILE) {
    $tunnelId = Get-Content $TUNNEL_FILE -Raw | ForEach-Object { $_.Trim() }
    Write-Host "📂 Found saved tunnel ID: $tunnelId" -ForegroundColor Cyan
    
    # Verify the tunnel still exists
    $verifyOutput = devtunnel show $tunnelId 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️  Saved tunnel no longer exists, will create a new one" -ForegroundColor Yellow
        $tunnelId = $null
        Remove-Item $TUNNEL_FILE -ErrorAction SilentlyContinue
    }
}

# Create new tunnel if we don't have one
if (-not $tunnelId) {
    Write-Host "📦 Creating new tunnel..." -ForegroundColor Yellow
    $createOutput = devtunnel create --allow-anonymous 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to create tunnel" -ForegroundColor Red
        Write-Host $createOutput -ForegroundColor Red
        exit 1
    }
    
    # Extract tunnel ID from create output (looking for pattern like "tidy-shoe-sg93r3j.use")
    if ($createOutput -match "Tunnel ID\s+:\s+([^\s]+)") {
        $tunnelId = $matches[1]
    } else {
        Write-Host "❌ Failed to extract tunnel ID from output" -ForegroundColor Red
        Write-Host $createOutput -ForegroundColor Red
        exit 1
    }
    
    # Save tunnel ID for reuse
    $tunnelId | Out-File -FilePath $TUNNEL_FILE -NoNewline
    Write-Host "✅ Tunnel created: $tunnelId" -ForegroundColor Green
    Write-Host "💾 Tunnel ID saved to $TUNNEL_FILE" -ForegroundColor Gray
    
    # Add port to tunnel
    Write-Host "🔌 Adding port $PORT to tunnel..." -ForegroundColor Yellow
    devtunnel port create -p $PORT
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to add port to tunnel" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Port $PORT added" -ForegroundColor Green
} else {
    Write-Host "✅ Using existing tunnel: $tunnelId" -ForegroundColor Green
    
    # Check if port is already configured
    $portInfo = devtunnel port show -p $PORT 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "🔌 Adding port $PORT to tunnel..." -ForegroundColor Yellow
        devtunnel port create -p $PORT
        if ($LASTEXITCODE -ne 0) {
            Write-Host "⚠️  Port might already exist or failed to add" -ForegroundColor Yellow
        } else {
            Write-Host "✅ Port $PORT added" -ForegroundColor Green
        }
    } else {
        Write-Host "✅ Port $PORT already configured" -ForegroundColor Green
    }
}

# Start hosting the tunnel
Write-Host "" 
Write-Host "🚀 Starting dev tunnel..." -ForegroundColor Cyan

# Start the devtunnel host process
$process = Start-Process -FilePath "devtunnel" -ArgumentList "host", $tunnelId -NoNewWindow -PassThru

# Wait briefly for the tunnel to start
Start-Sleep -Seconds 5

# Query devtunnel show for the public URL
$tunnelUrl = $null
$showOutput = devtunnel show $tunnelId 2>&1 | Out-String

# Look for the port line with HTTPS URL (e.g., "  3000  auto  https://21d15xnd-3000.use.devtunnels.ms/  0 client connections")
if ($showOutput -match "https://[^\s]+") {
    $tunnelUrl = $matches[0].TrimEnd('/')
    Write-Host "✅ Tunnel URL: $tunnelUrl" -ForegroundColor Green

    # Update .env.local with the new redirect URI
    $envFile = ".env.local"
    if (Test-Path $envFile) {
        $envContent = Get-Content $envFile -Raw
        $redirectUri = "$tunnelUrl/api/auth/callback"

        # Replace or add SCHWAB_REDIRECT_URI
        if ($envContent -match "SCHWAB_REDIRECT_URI=") {
            $envContent = $envContent -replace "SCHWAB_REDIRECT_URI=.*", "SCHWAB_REDIRECT_URI=$redirectUri"
        } else {
            $envContent += "`nSCHWAB_REDIRECT_URI=$redirectUri"
        }

        Set-Content -Path $envFile -Value $envContent -NoNewline
        Write-Host "✅ Updated .env.local with redirect URI" -ForegroundColor Green
    }
} else {
    Write-Host "⚠️  Could not extract tunnel URL from devtunnel show output" -ForegroundColor Yellow
    Write-Host "Output: $showOutput" -ForegroundColor Gray
}

Write-Host "" 
Write-Host "Tunnel is now running. Press Ctrl+C to stop." -ForegroundColor Cyan
Write-Host "" 

# Wait for the process to finish (keep the tunnel alive)
$process.WaitForExit()
