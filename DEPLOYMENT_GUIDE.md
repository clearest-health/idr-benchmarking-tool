# IDR Benchmarking Tool - Deployment Guide

This guide walks you through deploying the IDR Benchmarking Tool using Supabase and Vercel.

## Overview

- **Database**: Supabase (PostgreSQL)
- **Frontend**: Next.js on Vercel
- **Data**: Federal IDR PUF files migrated to PostgreSQL

## Step 1: Set Up Supabase Database

### 1.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up/login and create a new project
3. Choose a project name: `idr-benchmarking`
4. Set a database password (save this!)
5. Choose a region close to your users
6. Wait for project creation (~2 minutes)

### 1.2 Configure Database Schema

1. Go to your Supabase dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `database_schema.sql`
4. Click **Run** to execute the schema

This will create:
- Main `idr_disputes` table
- Lookup tables for specialties, states, etc.
- Indexes for fast querying
- Materialized views for performance
- Stored procedures for benchmarking

### 1.3 Get Connection Details

1. Go to **Settings** → **Database**
2. Copy the connection string (URI format)
3. Go to **Settings** → **API**
4. Copy:
   - Project URL
   - `anon` public key
   - `service_role` secret key (for data migration)

## Step 2: Migrate Data to Supabase

### 2.1 Install Dependencies

```bash
# In the main project directory (not the Next.js app)
pip install pandas psycopg2-binary openpyxl tqdm
```

### 2.2 Run Data Migration

```bash
# Replace with your actual Supabase connection string
python migrate_data_to_postgres.py \
  --connection-string "postgresql://postgres.PROJECT_ID:PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres" \
  --create-schema \
  --quarter "2024-Q4" \
  --excel-file "files/federal-idr-puf-for-2024-q4-as-of-may-28-2025.xlsx"
```

Expected output:
```
✅ Connected to PostgreSQL database
🏗️ Creating database schema...
✅ Database schema created successfully
🚀 Starting migration for quarter 2024-Q4
📊 Loading data from files/federal-idr-puf-for-2024-q4-as-of-may-28-2025.xlsx for quarter 2024-Q4
📁 Loaded 947,215 rows from Excel
🧹 Cleaning data...
✅ Data cleaned. Shape: (947215, 32)
Inserting records: 100%|████████| 947215/947215 [05:23<00:00, 2928.45it/s]
✅ Successfully inserted 947,215 rows for quarter 2024-Q4
📋 Populating lookup tables...
✅ Lookup tables populated
🔄 Refreshing materialized views...
✅ Materialized views refreshed
📈 MIGRATION COMPLETE!
==================================================
Total Disputes: 947,215
Provider Win Rate: 86.2%
```

### 2.3 Verify Data Migration

1. Go to Supabase **Table Editor**
2. Check that `idr_disputes` table has ~947K rows
3. Run a test query:
   ```sql
   SELECT COUNT(*) FROM idr_disputes;
   SELECT * FROM get_provider_benchmark('Emergency Medicine', 'NY', NULL, NULL, '2024-Q4');
   ```

## Step 3: Deploy Frontend to Vercel

### 3.1 Prepare Next.js App

```bash
cd idr-benchmarking-app
npm install
npm run build  # Test local build
```

### 3.2 Deploy to Vercel

#### Option A: GitHub Integration (Recommended)

1. Push code to GitHub repository
2. Go to [vercel.com](https://vercel.com)
3. Sign up/login with GitHub
4. Click **New Project**
5. Import your GitHub repository
6. Configure project:
   - Framework Preset: **Next.js**
   - Root Directory: `idr-benchmarking-app`
   - Build Command: `npm run build`
   - Output Directory: `.next`

#### Option B: Vercel CLI

```bash
npm install -g vercel
vercel --cwd idr-benchmarking-app
```

### 3.3 Set Environment Variables

In Vercel dashboard:

1. Go to **Settings** → **Environment Variables**
2. Add the following variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

### 3.4 Deploy

1. Click **Deploy** in Vercel
2. Wait for deployment (~2-3 minutes)
3. Test the deployed application

## Step 4: Configure Row Level Security (Optional)

For production, you may want to add RLS policies:

```sql
-- Enable RLS
ALTER TABLE idr_disputes ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
CREATE POLICY "Allow read access to disputes" ON idr_disputes
  FOR SELECT USING (true);

-- Allow read access to lookup tables
CREATE POLICY "Allow read access to specialties" ON specialties
  FOR SELECT USING (true);

CREATE POLICY "Allow read access to states" ON states
  FOR SELECT USING (true);
```

## Step 5: Performance Optimization

### 5.1 Database Optimization

```sql
-- Refresh materialized views regularly (can be automated)
SELECT refresh_performance_summaries();

-- Monitor query performance
EXPLAIN ANALYZE SELECT * FROM get_provider_benchmark('Emergency Medicine', NULL, NULL, NULL, '2024-Q4');
```

### 5.2 Frontend Optimization

- Enable Vercel Analytics
- Monitor Core Web Vitals
- Consider adding caching headers for API routes

## Step 6: Testing

### 6.1 Test Benchmarking Flow

1. Visit your deployed app
2. Select a specialty (e.g., "Emergency Medicine")
3. Choose a state (e.g., "NY")
4. Select practice size (e.g., "101-500 Employees")
5. Click "Run Benchmarking Analysis"
6. Verify results appear correctly

### 6.2 Test API Endpoints

```bash
# Test filter endpoint
curl https://your-app.vercel.app/api/filters

# Test benchmark endpoint
curl -X POST https://your-app.vercel.app/api/benchmark \
  -H "Content-Type: application/json" \
  -d '{"filters":{"specialty":"Emergency Medicine","state":"NY"}}'
```

## Troubleshooting

### Common Issues

1. **Database Connection Issues**
   - Verify connection string format
   - Check Supabase project is active
   - Ensure database password is correct

2. **Data Migration Fails**
   - Check Excel file path
   - Verify Python dependencies installed
   - Look for data type conversion errors

3. **Frontend Build Errors**
   - Run `npm run type-check`
   - Check environment variables are set
   - Verify all dependencies installed

4. **API Errors**
   - Check Supabase URL and keys
   - Verify RLS policies allow access
   - Check browser network tab for errors

### Performance Issues

1. **Slow Queries**
   ```sql
   -- Check if materialized views need refresh
   SELECT refresh_performance_summaries();
   
   -- Add additional indexes if needed
   CREATE INDEX idx_custom ON idr_disputes (your_column);
   ```

2. **High Memory Usage**
   - Limit result sets in API endpoints
   - Use pagination for large datasets
   - Consider query optimization

## Monitoring

### Database Monitoring
- Use Supabase dashboard to monitor query performance
- Set up alerts for high resource usage
- Monitor table sizes and growth

### Application Monitoring
- Enable Vercel Analytics
- Monitor API response times
- Set up error tracking (Sentry, etc.)

## Security Checklist

- [ ] Environment variables set correctly
- [ ] Database credentials secured
- [ ] RLS policies configured (if needed)
- [ ] API rate limiting considered
- [ ] CORS policies reviewed
- [ ] SSL/HTTPS enabled

## Scaling Considerations

1. **Database Scaling**
   - Supabase automatically handles most scaling
   - Consider read replicas for high traffic
   - Monitor connection pool usage

2. **Frontend Scaling**
   - Vercel handles auto-scaling
   - Consider CDN for static assets
   - Implement caching strategies

3. **Data Growth**
   - Plan for quarterly data updates
   - Consider data archiving strategy
   - Monitor storage costs

## Support

For deployment issues:
1. Check Supabase documentation
2. Review Vercel deployment logs
3. Contact development team with specific error messages
