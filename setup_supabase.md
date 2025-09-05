# Supabase Setup Instructions

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Fill in:
   - **Project name**: `idr-benchmarking`
   - **Database password**: Generate a strong password (SAVE THIS!)
   - **Region**: `US East (N. Virginia)`
4. Click "Create new project" (wait ~2 minutes)

## Step 2: Get Connection Details

Once your project is ready:

### Get API Details
1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL**: `https://PROJECT_ID.supabase.co`
   - **anon public key**: `eyJ0eXAiOiJKV1Q...` (long string)

### Get Database Connection String  
1. Go to **Settings** → **Database**
2. Scroll down to "Connection string"
3. Copy the **URI** format connection string
4. Replace `[YOUR-PASSWORD]` with your actual database password

## Step 3: Set Up Database Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Click "New query"
3. Copy the entire contents of `database_schema.sql` from this project
4. Paste into the SQL Editor
5. Click "Run" to execute
6. Verify tables are created in the **Table Editor**

## Step 4: Configure Local Environment

Create a `.env.local` file in the `idr-benchmarking-app` directory:

```bash
# Replace with your actual values
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

## Step 5: Test Connection

1. Restart your local dev server: `npm run dev`
2. Visit `http://localhost:3000`
3. Try the API endpoints:
   - `curl http://localhost:3000/api/filters`
   - Should return empty arrays instead of errors

## Step 6: Migrate Data (Optional for Testing)

If you want to load the actual IDR data:

```bash
python migrate_data_to_postgres.py \
  --connection-string "your_connection_string_here" \
  --create-schema \
  --quarter "2024-Q4"
```

## Step 7: Deploy to Production

1. Go to [Vercel Dashboard](https://vercel.com/clearesthealth/idr-benchmarking-app)
2. Go to **Settings** → **Environment Variables**
3. Add the same environment variables as Step 4
4. Redeploy the application

---

**Let me know when you've completed Step 1-2 and I'll help with the rest!**
