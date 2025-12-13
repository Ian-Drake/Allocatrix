#!/usr/bin/env node

/**
 * Generate Self-Signed Certificate for HTTPS Development
 * 
 * This script creates a self-signed certificate for localhost
 * to enable HTTPS on your local development machine.
 * 
 * The certificate is valid for 365 days.
 * 
 * Usage:
 *   node generate-cert.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const CERT_DIR = path.join(__dirname, 'certs');
const CERT_FILE = path.join(CERT_DIR, 'localhost.crt');
const KEY_FILE = path.join(CERT_DIR, 'localhost.key');
const ENV_FILE = path.join(__dirname, '../docs/SchwabApiSpecs/.env');

// Ensure certs directory exists
if (!fs.existsSync(CERT_DIR)) {
  fs.mkdirSync(CERT_DIR, { recursive: true });
}

// Check if certificates already exist
if (fs.existsSync(CERT_FILE) && fs.existsSync(KEY_FILE)) {
  console.log('✓ Self-signed certificates already exist');
  console.log(`  Certificate: ${CERT_FILE}`);
  console.log(`  Key: ${KEY_FILE}`);
  process.exit(0);
}

console.log('🔐 Generating self-signed certificate for localhost...\n');

try {
  // Check if openssl is available
  execSync('openssl version', { stdio: 'pipe' });
} catch {
  console.error('✗ OpenSSL is not installed or not in PATH');
  console.error('Please install OpenSSL:');
  console.error('  Windows: choco install openssl (or download from https://slproweb.com/products/Win32OpenSSL.html)');
  console.error('  macOS: brew install openssl');
  console.error('  Linux: sudo apt-get install openssl');
  process.exit(1);
}

try {
  // Generate private key and self-signed certificate
  execSync(
    `openssl req -x509 -newkey rsa:2048 -keyout "${KEY_FILE}" -out "${CERT_FILE}" -days 365 -nodes -subj "/CN=localhost"`,
    { stdio: 'inherit' }
  );

  console.log('\n✓ Certificate generated successfully!');
  console.log(`\n📁 Certificate Location:`);
  console.log(`  Certificate: ${CERT_FILE}`);
  console.log(`  Key: ${KEY_FILE}`);
  console.log('\n⚠️  Browser Warning:');
  console.log('   Your browser will show a security warning when accessing https://localhost');
  console.log('   This is normal for self-signed certificates.');
  console.log('   Click "Advanced" and "Proceed" to continue.\n');
  
  // Update .env file with cert paths
  if (fs.existsSync(ENV_FILE)) {
    let envContent = fs.readFileSync(ENV_FILE, 'utf8');
    
    // Use forward slashes for consistency
    const certPath = CERT_FILE.replace(/\\/g, '/');
    const keyPath = KEY_FILE.replace(/\\/g, '/');
    
    // Update or add cert paths
    if (envContent.includes('certPath=')) {
      envContent = envContent.replace(/certPath=.*/g, `certPath=${certPath}`);
    } else {
      envContent += `\ncertPath=${certPath}`;
    }
    
    if (envContent.includes('keyPath=')) {
      envContent = envContent.replace(/keyPath=.*/g, `keyPath=${keyPath}`);
    } else {
      envContent += `\nkeyPath=${keyPath}`;
    }
    
    fs.writeFileSync(ENV_FILE, envContent);
    console.log(`✓ Updated ${ENV_FILE} with certificate paths\n`);
  }
  
  console.log('You can now run: npm run schwab:oauth\n');
} catch (error) {
  console.error('✗ Failed to generate certificate:');
  console.error(error.message);
  process.exit(1);
}
