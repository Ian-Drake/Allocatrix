#!/usr/bin/env node

/**
 * Schwab OAuth 2.0 Automated Setup
 * 
 * This script automates the OAuth 2.0 authorization flow for Schwab API.
 * It:
 * 1. Opens the authorization URL in your default browser
 * 2. Starts a local server to capture the authorization code
 * 3. Exchanges the code for access and refresh tokens
 * 4. Saves tokens to http-client.private.env.json
 * 
 * Usage:
 *   node oauth-setup.js
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const url = require('url');

// Configuration
const ENV_FILE = path.join(__dirname, '../docs/SchwabApiSpecs/.env');
const OAUTH_URL = 'https://api.schwabapi.com/v1/oauth';
const LISTEN_PORT = 3000;
const REDIRECT_URI = `https://127.0.0.1:${LISTEN_PORT}/api/auth/callback`;

// Load credentials from environment file
function loadEnv() {
  if (!fs.existsSync(ENV_FILE)) {
    console.error(`Error: ${ENV_FILE} not found`);
    process.exit(1);
  }

  // Parse .env file format (KEY=VALUE)
  const envContent = fs.readFileSync(ENV_FILE, 'utf8');
  const env = {};
  
  envContent.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const match = trimmedLine.match(/^([^=]+)=(.*)$/);
      if (match) {
        env[match[1].trim()] = match[2].trim();
      }
    }
  });

  if (!env.clientId || env.clientId.includes('YOUR_')) {
    console.error('Error: clientId not set in .env file');
    console.error('Parsed env keys:', Object.keys(env));
    process.exit(1);
  }

  if (!env.clientSecret || env.clientSecret.includes('YOUR_')) {
    console.error('Error: clientSecret not set in .env file');
    process.exit(1);
  }

  return env;
}

// Save tokens to environment file
function saveTokens(env, accessToken, refreshToken) {
  let envContent = fs.readFileSync(ENV_FILE, 'utf8');
  
  // Compute base64 encoded credentials
  const base64Credentials = Buffer.from(`${env.clientId}:${env.clientSecret}`).toString('base64');
  
  // Update or add tokens
  if (envContent.includes('accessToken=')) {
    envContent = envContent.replace(/accessToken=.*/g, `accessToken=${accessToken}`);
  } else {
    envContent += `\naccessToken=${accessToken}`;
  }
  
  if (envContent.includes('refreshToken=')) {
    envContent = envContent.replace(/refreshToken=.*/g, `refreshToken=${refreshToken}`);
  } else {
    envContent += `\nrefreshToken=${refreshToken}`;
  }
  
  if (envContent.includes('authorizationCode=')) {
    envContent = envContent.replace(/authorizationCode=.*/g, `authorizationCode=OBTAINED_VIA_OAUTH_FLOW`);
  } else {
    envContent += `\nauthorizationCode=OBTAINED_VIA_OAUTH_FLOW`;
  }
  
  if (envContent.includes('base64Credentials=')) {
    envContent = envContent.replace(/base64Credentials=.*/g, `base64Credentials=${base64Credentials}`);
  } else {
    envContent += `\nbase64Credentials=${base64Credentials}`;
  }

  fs.writeFileSync(ENV_FILE, envContent);
  console.log(`✓ Tokens saved to ${ENV_FILE}`);
}

// Exchange authorization code for tokens
function exchangeCodeForToken(code, clientId, clientSecret) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const postData = `grant_type=authorization_code&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

    const options = {
      hostname: 'api.schwabapi.com',
      path: '/v1/oauth/token',
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    console.log('\n⏳ Exchanging authorization code for tokens...');

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          const response = JSON.parse(data);
          resolve(response);
        } else {
          reject(new Error(`Token exchange failed: ${res.statusCode} ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Start local server and wait for authorization code
function startServerAndWaitForCode() {
  return new Promise((resolve, reject) => {
    // Try to create HTTPS server with self-signed cert
    const certFile = path.join(__dirname, 'certs', 'localhost.crt');
    const keyFile = path.join(__dirname, 'certs', 'localhost.key');
    let server;
    let timeoutHandle;
    const TIMEOUT_MINUTES = 1;

    const requestHandler = (req, res) => {
      const parsedUrl = url.parse(req.url, true);
      const query = parsedUrl.query;

      if (query.code) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Schwab OAuth Success</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 50px; }
              .success { color: green; font-size: 18px; }
              .info { margin-top: 20px; color: #333; }
            </style>
          </head>
          <body>
            <div class="success">✓ Authorization successful!</div>
            <div class="info">
              <p>You can close this window and return to your terminal.</p>
              <p>Your tokens have been saved to http-client.private.env.json</p>
            </div>
          </body>
          </html>
        `);

        clearTimeout(timeoutHandle);
        server.close();
        resolve(query.code);
      } else if (query.error) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Schwab OAuth Error</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 50px; }
              .error { color: red; font-size: 18px; }
            </style>
          </head>
          <body>
            <div class="error">✗ Authorization failed</div>
            <p>Error: ${query.error}</p>
            <p>Description: ${query.error_description || 'No additional details'}</p>
          </body>
          </html>
        `);

        clearTimeout(timeoutHandle);
        server.close();
        reject(new Error(`OAuth error: ${query.error}`));
      }
    };

    if (fs.existsSync(certFile) && fs.existsSync(keyFile)) {
      try {
        const options = {
          key: fs.readFileSync(keyFile),
          cert: fs.readFileSync(certFile),
        };
        server = https.createServer(options, requestHandler);
      } catch (err) {
        console.warn('⚠ Could not load HTTPS certificates, falling back to HTTP');
        server = http.createServer(requestHandler);
      }
    } else {
      server = http.createServer(requestHandler);
    }

    server.listen(LISTEN_PORT, '127.0.0.1', () => {
      const protocol = server instanceof https.Server ? 'https' : 'http';
      console.log(`✓ Local server listening on ${protocol}://127.0.0.1:${LISTEN_PORT}`);

      // Set timeout for waiting on authorization code
      timeoutHandle = setTimeout(() => {
        console.error(`\n✗ Timeout: No authorization received within ${TIMEOUT_MINUTES} minutes`);
        console.error('\nPossible reasons:');
        console.error('  • Browser did not open');
        console.error('  • Browser window was closed without completing OAuth');
        console.error('  • Authorization was denied\n');
        server.close();
        reject(new Error(`Authorization timeout after ${TIMEOUT_MINUTES} minutes. Please run npm run schwab:oauth again.`));
      }, TIMEOUT_MINUTES * 60 * 1000);
    });

    server.on('error', (err) => {
      clearTimeout(timeoutHandle);
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${LISTEN_PORT} is already in use. Stop your Next.js dev server (npm run dev) and try again.`));
      } else {
        reject(err);
      }
    });
  });
}

// Open browser
function openBrowser(authUrl) {
  console.log('\n⏳ Opening browser for authorization...');
  console.log(`\nAuthorization URL: ${authUrl}\n`);

  const isWindows = process.platform === 'win32';
  const isLinux = process.platform === 'linux';

  return new Promise((resolve) => {
    let command;

    if (isWindows) {
      command = `start "" "${authUrl}"`;
    } else if (isLinux) {
      command = `xdg-open ${authUrl}`;
    } else {
      command = `open ${authUrl}`;
    }

    exec(command, (err) => {
      if (err) {
        console.warn('⚠ Could not open browser automatically.  ' + err);
        console.log(`Please visit: ${authUrl}\n`);
      } else {
        console.log('✓ Browser opened');
      }
      resolve();
    });
  });
}

// Main flow
async function main() {
  try {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║    Schwab OAuth 2.0 Automated Authorization Flow         ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    // Load credentials
    const env = loadEnv();
    console.log('✓ Credentials loaded from .env');

    // Check if port 3000 is available
    const portAvailable = await new Promise((resolve) => {
      const server = http.createServer();
      server.listen(LISTEN_PORT, '127.0.0.1', () => {
        server.close(() => {
          resolve(true);
        });
      });
      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          resolve(false);
        } else {
          throw err;
        }
      });
    });

    if (!portAvailable) {
      console.error(`\n✗ Error: Port ${LISTEN_PORT} is already in use`);
      console.error('\nThis usually means your Next.js dev server is running.');
      console.error('Please stop it before running oauth setup:');
      console.error('\n  1. Stop the dev server (Ctrl+C)');
      console.error('  2. Run: npm run schwab:oauth');
      console.error('\nOr if you have the dev server in another terminal, kill the process:');
      console.error('\n  Windows:  netstat -ano | findstr :3000');
      console.error('  macOS:    lsof -i :3000 | grep LISTEN');
      console.error('  Linux:    lsof -i :3000 | grep LISTEN\n');
      process.exit(1);
    }

    // Start server and wait for authorization code
    // Don't call startServer() separately - startServerAndWaitForCode does it all
    const authUrl = `${OAUTH_URL}/authorize?client_id=${encodeURIComponent(env.clientId)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

    // Open browser
    await openBrowser(authUrl);

    // Wait for authorization code (server is started inside this function)
    console.log('⏳ Waiting for authorization...');
    const code = await startServerAndWaitForCode();

    console.log('✓ Authorization code received');

    // Exchange code for token
    const tokenResponse = await exchangeCodeForToken(code, env.clientId, env.clientSecret);
    console.log('✓ Tokens received from Schwab API');

    // Save tokens
    saveTokens(env, tokenResponse.access_token, tokenResponse.refresh_token);

    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║             OAuth Setup Complete! ✓                      ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    console.log('ℹ Token Details:');
    console.log(`  • Access Token: ${tokenResponse.access_token.substring(0, 20)}...`);
    console.log(`  • Refresh Token: ${tokenResponse.refresh_token.substring(0, 20)}...`);
    console.log(`  • Expires In: ${tokenResponse.expires_in} seconds (~${Math.round(tokenResponse.expires_in / 60)} minutes)`);
    console.log('\nYou can now use the REST Client to make API requests!');
    console.log('When your access token expires, use the "Refresh Access Token" request.\n');
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    process.exit(1);
  }
}

main();
