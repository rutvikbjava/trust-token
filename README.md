# Blockchain IoT Authentication

Minimal Next.js 14 project implementing blockchain-based IoT device authentication with Supabase.

## Features

- Device registration with unique secrets
- HMAC-based authentication with nonce protection
- Blockchain storage of all authentication events
- Trust score system with automatic device revocation
- Chain integrity verification
- Browser-based dashboard for testing

## Deployment

### Prerequisites

- Node.js 18+
- Supabase project with SQL schema deployed

### Environment Variables

Create a `.env.local` file with these 4 variables:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
TOKEN_SECRET=your-long-random-secret-string
```

**Get these from Supabase:**
1. Go to Project Settings → API
2. Copy `Project URL` → use as `NEXT_PUBLIC_SUPABASE_URL`
3. Copy `anon public` key → use as `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Copy `service_role` key → use as `SUPABASE_SERVICE_KEY`
5. Generate random string → use as `TOKEN_SECRET`

### Deploy to Vercel

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Local Development

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` for the demo dashboard.

## Database Schema

Run `supabase.sql` in your Supabase SQL editor to create:
- `devices` - IoT device registry with secrets and trust scores
- `blockchain` - Immutable event log with SHA-256 chain
- `nonces` - Replay attack prevention

## API Endpoints

- `POST /api/register` - Register new device
- `POST /api/auth` - Authenticate with HMAC signature
- `GET /api/verify?device_id=xxx` - Check device status
- `POST /api/revoke` - Revoke device access
- `GET /api/chain` - View blockchain with integrity check
- `GET /api/devices` - List all devices

## Architecture

- **Frontend**: Next.js 14 App Router with React 18
- **Backend**: Next.js API routes with Supabase client
- **Database**: Supabase (PostgreSQL)
- **Crypto**: Node.js crypto (server), Web Crypto API (browser)
- **Blockchain**: SHA-256 hash chain with genesis block
