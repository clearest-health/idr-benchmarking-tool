# Deployment Configuration

## Supabase Setup Checklist

### 1. Supabase Project Details
- [ ] Project created at supabase.com
- [ ] Project name: `idr-benchmarking`
- [ ] Database password saved securely
- [ ] Region selected

### 2. Get Connection Details
From your Supabase dashboard:

#### Settings → Database
- [ ] Connection string copied (for data migration)
- Format: `postgresql://postgres.PROJECT_ID:PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres`

#### Settings → API  
- [ ] Project URL copied
- [ ] `anon` public key copied
- [ ] `service_role` secret key copied (optional, for admin operations)

### 3. Environment Variables
Create `.env.local` in the Next.js app with:
```
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

### 4. Database Schema
- [ ] Run `database_schema.sql` in Supabase SQL Editor
- [ ] Verify tables created successfully

### 5. Data Migration
- [ ] Run migration script with connection string
- [ ] Verify data loaded (should be ~947K rows)

### 6. Vercel Deployment
- [ ] Push code to GitHub
- [ ] Connect GitHub repo to Vercel
- [ ] Set environment variables in Vercel
- [ ] Deploy and test

## Commands to Run

### Test Next.js App Locally
```bash
cd idr-benchmarking-app
npm install
npm run dev
```

### Run Data Migration
```bash
cd .. # Back to main directory
python migrate_data_to_postgres.py \
  --connection-string "postgresql://postgres.PROJECT_ID:PASSWORD@HOST:PORT/postgres" \
  --create-schema \
  --quarter "2024-Q4"
```

### Deploy to Vercel
```bash
cd idr-benchmarking-app
npx vercel --prod
```
