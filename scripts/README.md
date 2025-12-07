# Dev Tunnel Scripts

These scripts manage the development tunnel required for Schwab OAuth authentication during local development.

## Why is this needed?

Schwab's OAuth flow requires a publicly accessible redirect URI. During local development, your app runs on `localhost:3000`, which isn't accessible from the internet. The dev tunnel creates a secure public URL that forwards traffic to your local machine.

## Usage

### Windows (PowerShell)
```bash
npm run tunnel
```

### Linux/Mac (Bash)
```bash
npm run tunnel:sh
```

## What the script does

1. **Checks for devtunnel CLI** - Verifies the tool is installed
2. **Logs in** - Authenticates with Microsoft (one-time setup)
3. **Creates/reuses tunnel** - Sets up a persistent tunnel named `allocatrix-dev`
4. **Configures port 3000** - Maps the tunnel to your Next.js dev server
5. **Starts hosting** - Runs the tunnel and displays the public URL

## First-time setup

When you run the script for the first time:
1. It will prompt you to log in with Microsoft
2. A new tunnel will be created with the name `allocatrix-dev`
3. The public URL will be displayed (e.g., `https://xxxxxxxx-3000.use.devtunnels.ms`)

## Update Schwab Developer Portal

After running the tunnel for the first time:

1. Note the public URL from the terminal output
2. Go to [Schwab Developer Portal](https://developer.schwab.com/)
3. Navigate to your app settings
4. Update the **Redirect URI** to: `https://YOUR-TUNNEL-URL/api/auth/callback`
5. Update your `.env.local` file with the same URL:
   ```
   SCHWAB_REDIRECT_URI=https://YOUR-TUNNEL-URL/api/auth/callback
   ```

## Tunnel Persistence

- The tunnel is named `allocatrix-dev` and will be reused across sessions
- Tunnels expire after 30 days by default
- If the tunnel expires, the script will create a new one (and you'll need to update Schwab again)

## Running in parallel with dev server

You'll need two terminal windows:

**Terminal 1 - Dev Tunnel:**
```bash
npm run tunnel
```

**Terminal 2 - Next.js:**
```bash
npm run dev
```

## Troubleshooting

### "devtunnel not found"
Install the devtunnel CLI:
```bash
winget install Microsoft.devtunnel
```
Or download from: https://aka.ms/TunnelsCliDownload

### "Failed to login"
The script will prompt you to authenticate with Microsoft. Follow the instructions in the terminal.

### Tunnel URL changed
If you get a different tunnel URL, you must update:
1. Schwab Developer Portal redirect URI
2. `.env.local` file `SCHWAB_REDIRECT_URI` value

### Port already in use
Make sure only one instance of the tunnel script is running at a time.
