# Vercel Deployment Guide

## Issues Fixed

### 1. **Module System Mismatch** ✅
- **Problem**: Mixed CommonJS (`require`) with ES modules (`export`)
- **Fix**: Converted all files to ES modules
  - Added `"type": "module"` to `package.json`
  - Changed `require()` → `import`
  - Changed `module.exports` → `export`

### 2. **Environment Variables** ✅
- **Problem**: Missing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Fix**: Added proper Next.js public env vars
  - Created `next.config.js`
  - Updated `.env.local` structure
  - Added fallback for `SUPABASE_URL`

### 3. **Dynamic API Routes** ✅
- **Added**: `export const dynamic = 'force-dynamic'` to API route
- **Why**: Vercel serverless requires explicit dynamic marking

## Pre-Deployment Steps

### Step 1: Get Your Supabase Keys

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **API**
4. Copy these values:

```
Project URL: https://your-project.supabase.co
anon public: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Step 2: Update Your .env.local

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_KEY=your_service_role_key_here
TOKEN_SECRET=generate-a-long-random-string
```

**To generate TOKEN_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 3: Run Supabase SQL

Make sure you've run the `supabase.sql` file in your Supabase SQL editor:
1. Go to **SQL Editor** in Supabase
2. Paste contents of `supabase.sql`
3. Click **Run**

### Step 4: Test Locally

```bash
npm run build
npm start
```

Visit `http://localhost:3000` and test the demo.

## Deploy to Vercel

### Option A: GitHub Integration (Recommended)

1. **Push to GitHub:**
```bash
git add -A
git commit -m "Fix Vercel deployment: ES modules, env vars, dynamic routes"
git push
```

2. **Import in Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click **Add New** → **Project**
   - Import your GitHub repository
   - Vercel auto-detects Next.js

3. **Configure Environment Variables:**
   - In Vercel project settings → **Environment Variables**
   - Add all 4 variables:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_KEY`
     - `TOKEN_SECRET`
   - Make sure they're available for **Production**, **Preview**, and **Development**

4. **Deploy:**
   - Click **Deploy**
   - Wait for build to complete
   - Visit your production URL

### Option B: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Follow prompts, then add environment variables via web UI
```

## Post-Deployment Checks

### Test Endpoints

Replace `your-app.vercel.app` with your actual domain:

```bash
# 1. Register a device
curl -X POST https://your-app.vercel.app/api/register

# 2. Check chain
curl https://your-app.vercel.app/api/chain

# 3. List devices
curl https://your-app.vercel.app/api/devices
```

### Browser Test

Visit your deployed URL and use the dashboard to:
1. Click **Register Device**
2. Click **Simulate Auth**
3. Check **Blockchain** section for integrity

## Troubleshooting

### Build Fails with "Cannot find module"
- Make sure all imports end with `.js` extension
- Check `package.json` has `"type": "module"`

### API Routes Return 500
- Check Vercel logs: Project → **Deployments** → Click deployment → **Functions** tab
- Verify all 4 environment variables are set
- Verify Supabase SQL schema is deployed

### "Invalid signature" errors
- Make sure `TOKEN_SECRET` is the same locally and in Vercel
- Check Supabase keys are correct (anon vs service_role)

### Database errors
- Run `supabase.sql` in your Supabase SQL editor
- Check Supabase project is not paused
- Verify RLS policies if you added any

## Files Changed

| File | Change |
|------|--------|
| `package.json` | Added `"type": "module"` |
| `lib/core.js` | CommonJS → ES modules |
| `app/api/[action]/route.js` | CommonJS → ES modules + dynamic export |
| `next.config.js` | Created for env config |
| `.env.local` | Added NEXT_PUBLIC_ prefixes |
| `.env.local.example` | Updated template |

## Success Indicators

✅ Local build succeeds: `npm run build`  
✅ Vercel build succeeds (check deployment log)  
✅ API routes respond (test /api/chain)  
✅ Dashboard loads without errors  
✅ Device registration works  
✅ Blockchain integrity validates  

---

**Your project is now ready for production! 🚀**
