# Quick Start Guide

## 🚀 Get Started in 5 Minutes

### 1. Setup Supabase (2 min)

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New Project**
3. Fill in project details and wait for setup to complete
4. Go to **SQL Editor** (left sidebar)
5. Copy and paste the entire contents of `supabase.sql`
6. Click **Run** to create all tables

### 2. Get Your API Keys (1 min)

1. In Supabase, go to **Project Settings** (gear icon)
2. Click **API** in the left menu
3. Copy these two values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **service_role key** (starts with `eyJ...` - click to reveal)

### 3. Configure Environment (1 min)

Create a file named `.env.local` in the project root:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJxxx...your-actual-key
```

### 4. Run the App (1 min)

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 🎯 Try It Out

### Register Your First Device

1. Click **Register Device**
2. **IMPORTANT**: Copy the secret that appears - you'll never see it again!
3. Your device now appears in the devices table with trust score 50

### Test Authentication Flow

1. Click **Simulate Good Device**
2. Enter your device ID
3. Watch trust score increase to ~100
4. Check blockchain ledger - you'll see 10 AUTH_SUCCESS events

### Test Security Features

1. Click **Simulate Attacker**
2. Enter the same device ID
3. Watch trust score drop dramatically
4. See AUTH_FAIL events in the ledger

### Verify Blockchain Integrity

1. Click **Verify Chain** - should show ✅ all valid
2. Click **Tamper Block** and enter block `1`
3. Click **Verify Chain** again - now shows ❌ broken at block 1

## 📊 Understanding Trust Scores

| Color | Range | Token Lifetime | Status |
|-------|-------|---------------|---------|
| 🟢 Green | 70-100 | 30 minutes | High trust |
| 🟡 Yellow | 40-69 | 5 minutes | Medium trust |
| 🔴 Red | 0-39 | 1 minute | Low trust |
| 🚫 Revoked | - | No tokens | Blocked |

## 🔑 API Quick Reference

### Register Device
```bash
curl -X POST http://localhost:3000/api/register
```

### Authenticate (requires HMAC calculation)
```bash
curl -X POST http://localhost:3000/api/auth \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "your-device-id",
    "timestamp": "1234567890000",
    "nonce": "random-nonce",
    "hmac": "computed-hmac-signature"
  }'
```

### List Devices
```bash
curl http://localhost:3000/api/devices
```

### Get Blockchain
```bash
curl http://localhost:3000/api/ledger
```

### Verify Chain
```bash
curl http://localhost:3000/api/integrity
```

## 🚢 Deploy to Vercel

1. Push your code to GitHub (already done!)
2. Go to [vercel.com](https://vercel.com)
3. Click **Import Project**
4. Select your GitHub repository
5. Add environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
6. Click **Deploy**
7. Your app is live! 🎉

## 🐛 Troubleshooting

### "Cannot connect to Supabase"
- Check your `.env.local` file exists
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are correct
- Make sure you're using the **service_role key**, not the anon key

### "Device not found"
- Make sure you registered the device first
- Check the device_id is spelled correctly

### "npm install" fails
- Make sure you have Node.js 18+ installed
- Try deleting `node_modules` and `package-lock.json`, then run `npm install` again

### Port 3000 already in use
```bash
# Use a different port
npm run dev -- -p 3001
```

## 📖 Next Steps

- Read `README.md` for full documentation
- Check `requirements.md` for feature details
- Review `design.md` for architecture
- Follow `tasks.md` to understand implementation

## 🎓 Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Node.js Crypto Module](https://nodejs.org/api/crypto.html)

## 💡 Pro Tips

1. **Save device secrets**: They're shown only once during registration
2. **Monitor trust scores**: Low scores indicate suspicious behavior
3. **Check the ledger**: Every action is logged for audit
4. **Test tampering**: Use the tamper feature to see integrity checks in action
5. **Simulate behaviors**: Test different scenarios without real devices

---

**Need help?** Check the full README.md or open an issue on GitHub.
