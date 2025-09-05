# IDR Benchmarking Tool

A Next.js application that allows healthcare providers to benchmark their IDR (Independent Dispute Resolution) performance against peers using Federal IDR PUF data.

## Features

- **Provider Benchmarking**: Compare win rates, offer amounts, and resolution times
- **Peer Group Analysis**: Benchmark against similar providers by specialty, geography, and practice size
- **Interactive Dashboard**: Modern, responsive interface with charts and insights
- **Real-time Analytics**: Fast queries powered by PostgreSQL and Supabase
- **Actionable Insights**: AI-generated recommendations based on performance data

## Value Propositions

- "We've been studying IDR outcomes and can show how your group compares"
- "Identify patterns in why some groups lose or waste money in arbitration" 
- "Make data-driven decisions about which claims are worth pursuing"
- "Understand what works for high-performing peers"

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL), Next.js API Routes
- **Charts**: Recharts
- **Icons**: Heroicons
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+ 
- Supabase account
- Vercel account (for deployment)

### Environment Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env.local` file with:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   DATABASE_URL=your_postgresql_connection_string
   ```

### Database Setup

1. **Create Supabase Project**: 
   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Note the URL and anon key

2. **Run Database Schema**:
   ```bash
   # In the SQL editor of your Supabase dashboard, run:
   # ../database_schema.sql
   ```

3. **Migrate Data**:
   ```bash
   # From the parent directory
   python migrate_data_to_postgres.py \
     --connection-string "postgresql://postgres:password@host:port/database" \
     --create-schema \
     --quarter "2024-Q4"
   ```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

### Deployment

#### Deploy to Vercel

1. Push your code to GitHub
2. Connect your GitHub repo to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy!

#### Manual Deployment

```bash
npm run build
npm start
```

## Project Structure

```
src/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   ├── benchmark/     # Benchmarking endpoints
│   │   └── filters/       # Filter options endpoint
│   └── page.tsx           # Main page
├── components/            # React components
│   └── BenchmarkingDashboard.tsx
└── lib/                   # Utility libraries
    ├── supabase.ts        # Supabase client & types
    └── benchmarking.ts    # Benchmarking service
```

## Key Components

### BenchmarkingDashboard
Main dashboard component with:
- Practice profile filters
- Performance metrics display
- Comparison charts
- Actionable insights
- Analysis parameters

### BenchmarkingService
Service class handling:
- Provider benchmark queries
- Peer group comparisons
- Filter option loading
- Market overview statistics
- Insight generation

## Database Schema

The application uses a PostgreSQL schema optimized for benchmarking queries:

- **idr_disputes**: Main table with dispute data
- **Lookup tables**: specialties, states, practice_sizes, service_codes
- **Materialized views**: Pre-aggregated performance summaries
- **Functions**: Optimized benchmark calculation functions

## API Endpoints

- `POST /api/benchmark`: Get benchmark metrics
- `GET /api/filters`: Get available filter options
- `GET /api/benchmark?type=overview`: Get market overview

## Performance Considerations

- Materialized views for fast aggregations
- Indexed queries on common filter combinations
- Cached filter options
- Optimized SQL functions for benchmarking calculations

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

Private - Clearest Health

## Support

For questions or issues, contact the development team.