-- IDR Benchmarking Tool - PostgreSQL Database Schema
-- =================================================
-- 
-- This schema stores Federal IDR PUF data for benchmarking analysis
-- Optimized for fast queries by specialty, geography, and practice size

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text matching

-- Main disputes table containing all IDR dispute data
CREATE TABLE idr_disputes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Core dispute identifiers
    dispute_number VARCHAR(50) NOT NULL UNIQUE,
    dli_number VARCHAR(50),
    
    -- Outcome information
    payment_determination_outcome VARCHAR(100) NOT NULL,
    default_decision BOOLEAN,
    prevailing_party_offer_pct_qpa DECIMAL(8,2),
    
    -- Dispute classification
    type_of_dispute VARCHAR(50),
    dispute_line_item_type VARCHAR(100),
    
    -- Provider/Facility information
    provider_facility_group_name VARCHAR(500),
    provider_facility_name VARCHAR(500),
    provider_email_domain VARCHAR(200),
    provider_facility_npi VARCHAR(50),
    practice_facility_size VARCHAR(50),
    practice_facility_specialty VARCHAR(500),
    
    -- Health Plan information
    health_plan_issuer_name VARCHAR(500),
    health_plan_email_domain VARCHAR(200),
    health_plan_type VARCHAR(100),
    
    -- Service information
    service_code VARCHAR(50),
    type_of_service_code VARCHAR(50),
    place_of_service_code VARCHAR(20),
    item_service_description TEXT,
    
    -- Geographic information
    location_of_service VARCHAR(5), -- State code
    
    -- Financial information
    provider_offer_pct_qpa DECIMAL(8,2),
    health_plan_offer_pct_qpa DECIMAL(8,2),
    qpa_pct_median_qpa DECIMAL(8,2),
    provider_offer_pct_median DECIMAL(8,2),
    health_plan_offer_pct_median DECIMAL(8,2),
    prevailing_offer_pct_median DECIMAL(8,2),
    
    -- Process information
    length_determination_days INTEGER,
    idre_compensation DECIMAL(10,2),
    offer_selected_from VARCHAR(50),
    initiating_party VARCHAR(50),
    
    -- Metadata
    data_quarter VARCHAR(10) NOT NULL, -- e.g., "2024-Q4"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast querying
CREATE INDEX idx_idr_disputes_specialty ON idr_disputes (practice_facility_specialty);
CREATE INDEX idx_idr_disputes_location ON idr_disputes (location_of_service);
CREATE INDEX idx_idr_disputes_practice_size ON idr_disputes (practice_facility_size);
CREATE INDEX idx_idr_disputes_service_code ON idr_disputes (service_code);
CREATE INDEX idx_idr_disputes_outcome ON idr_disputes (payment_determination_outcome);
CREATE INDEX idx_idr_disputes_quarter ON idr_disputes (data_quarter);
CREATE INDEX idx_idr_disputes_provider_name ON idr_disputes USING gin (provider_facility_name gin_trgm_ops);

-- Composite indexes for common query patterns
CREATE INDEX idx_idr_disputes_specialty_location ON idr_disputes (practice_facility_specialty, location_of_service);
CREATE INDEX idx_idr_disputes_specialty_size ON idr_disputes (practice_facility_specialty, practice_facility_size);
CREATE INDEX idx_idr_disputes_location_size ON idr_disputes (location_of_service, practice_facility_size);

-- Lookup tables for standardized values
CREATE TABLE specialties (
    id SERIAL PRIMARY KEY,
    name VARCHAR(500) UNIQUE NOT NULL,
    standardized_name VARCHAR(200),
    category VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE states (
    code VARCHAR(5) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    region VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE practice_sizes (
    id SERIAL PRIMARY KEY,
    size_range VARCHAR(50) UNIQUE NOT NULL,
    min_employees INTEGER,
    max_employees INTEGER,
    sort_order INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE service_codes (
    code VARCHAR(20) PRIMARY KEY,
    description TEXT,
    category VARCHAR(100),
    specialty VARCHAR(200),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Populate lookup tables
INSERT INTO states (code, name, region) VALUES
    ('AL', 'Alabama', 'South'),
    ('AK', 'Alaska', 'West'),
    ('AZ', 'Arizona', 'West'),
    ('AR', 'Arkansas', 'South'),
    ('CA', 'California', 'West'),
    ('CO', 'Colorado', 'West'),
    ('CT', 'Connecticut', 'Northeast'),
    ('DE', 'Delaware', 'Northeast'),
    ('DC', 'District of Columbia', 'Northeast'),
    ('FL', 'Florida', 'South'),
    ('GA', 'Georgia', 'South'),
    ('HI', 'Hawaii', 'West'),
    ('ID', 'Idaho', 'West'),
    ('IL', 'Illinois', 'Midwest'),
    ('IN', 'Indiana', 'Midwest'),
    ('IA', 'Iowa', 'Midwest'),
    ('KS', 'Kansas', 'Midwest'),
    ('KY', 'Kentucky', 'South'),
    ('LA', 'Louisiana', 'South'),
    ('ME', 'Maine', 'Northeast'),
    ('MD', 'Maryland', 'Northeast'),
    ('MA', 'Massachusetts', 'Northeast'),
    ('MI', 'Michigan', 'Midwest'),
    ('MN', 'Minnesota', 'Midwest'),
    ('MS', 'Mississippi', 'South'),
    ('MO', 'Missouri', 'Midwest'),
    ('MT', 'Montana', 'West'),
    ('NE', 'Nebraska', 'Midwest'),
    ('NV', 'Nevada', 'West'),
    ('NH', 'New Hampshire', 'Northeast'),
    ('NJ', 'New Jersey', 'Northeast'),
    ('NM', 'New Mexico', 'West'),
    ('NY', 'New York', 'Northeast'),
    ('NC', 'North Carolina', 'South'),
    ('ND', 'North Dakota', 'Midwest'),
    ('OH', 'Ohio', 'Midwest'),
    ('OK', 'Oklahoma', 'South'),
    ('OR', 'Oregon', 'West'),
    ('PA', 'Pennsylvania', 'Northeast'),
    ('RI', 'Rhode Island', 'Northeast'),
    ('SC', 'South Carolina', 'South'),
    ('SD', 'South Dakota', 'Midwest'),
    ('TN', 'Tennessee', 'South'),
    ('TX', 'Texas', 'South'),
    ('UT', 'Utah', 'West'),
    ('VT', 'Vermont', 'Northeast'),
    ('VA', 'Virginia', 'South'),
    ('WA', 'Washington', 'West'),
    ('WV', 'West Virginia', 'South'),
    ('WI', 'Wisconsin', 'Midwest'),
    ('WY', 'Wyoming', 'West');

INSERT INTO practice_sizes (size_range, min_employees, max_employees, sort_order) VALUES
    ('Fewer than 20 Employees', 1, 19, 1),
    ('20-50 Employees', 20, 50, 2),
    ('51-100 Employees', 51, 100, 3),
    ('101-500 Employees', 101, 500, 4),
    ('Over 500 Employees', 501, 999999, 5),
    ('N/R', NULL, NULL, 6);

-- Materialized views for fast aggregations
CREATE MATERIALIZED VIEW specialty_performance_summary AS
SELECT 
    practice_facility_specialty,
    location_of_service,
    practice_facility_size,
    data_quarter,
    COUNT(*) as total_disputes,
    COUNT(*) FILTER (WHERE payment_determination_outcome = 'In Favor of Provider/Facility/AA Provider') as provider_wins,
    ROUND(
        (COUNT(*) FILTER (WHERE payment_determination_outcome = 'In Favor of Provider/Facility/AA Provider') * 100.0 / COUNT(*)), 
        2
    ) as provider_win_rate,
    AVG(provider_offer_pct_qpa) as avg_provider_offer_pct,
    AVG(prevailing_party_offer_pct_qpa) as avg_winning_offer_pct,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY length_determination_days) as median_resolution_days,
    AVG(idre_compensation) as avg_idre_compensation
FROM idr_disputes
WHERE practice_facility_specialty IS NOT NULL
GROUP BY practice_facility_specialty, location_of_service, practice_facility_size, data_quarter;

CREATE INDEX idx_specialty_performance_specialty ON specialty_performance_summary (practice_facility_specialty);
CREATE INDEX idx_specialty_performance_location ON specialty_performance_summary (location_of_service);
CREATE INDEX idx_specialty_performance_size ON specialty_performance_summary (practice_facility_size);

-- Service code performance summary
CREATE MATERIALIZED VIEW service_code_performance_summary AS
SELECT 
    service_code,
    practice_facility_specialty,
    location_of_service,
    data_quarter,
    COUNT(*) as total_disputes,
    COUNT(*) FILTER (WHERE payment_determination_outcome = 'In Favor of Provider/Facility/AA Provider') as provider_wins,
    ROUND(
        (COUNT(*) FILTER (WHERE payment_determination_outcome = 'In Favor of Provider/Facility/AA Provider') * 100.0 / COUNT(*)), 
        2
    ) as provider_win_rate,
    AVG(provider_offer_pct_qpa) as avg_provider_offer_pct,
    AVG(prevailing_party_offer_pct_qpa) as avg_winning_offer_pct
FROM idr_disputes
WHERE service_code IS NOT NULL
GROUP BY service_code, practice_facility_specialty, location_of_service, data_quarter;

CREATE INDEX idx_service_code_performance_code ON service_code_performance_summary (service_code);
CREATE INDEX idx_service_code_performance_specialty ON service_code_performance_summary (practice_facility_specialty);

-- Functions for benchmarking analysis
CREATE OR REPLACE FUNCTION get_provider_benchmark(
    p_specialty VARCHAR DEFAULT NULL,
    p_state VARCHAR DEFAULT NULL,
    p_practice_size VARCHAR DEFAULT NULL,
    p_service_codes VARCHAR[] DEFAULT NULL,
    p_quarter VARCHAR DEFAULT '2024-Q4',
    p_practice_name VARCHAR DEFAULT NULL
) RETURNS TABLE (
    total_disputes BIGINT,
    provider_win_rate NUMERIC,
    avg_provider_offer_pct NUMERIC,
    avg_winning_offer_pct NUMERIC,
    median_resolution_days NUMERIC,
    avg_idre_compensation NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_disputes,
        ROUND(
            (COUNT(*) FILTER (WHERE payment_determination_outcome = 'In Favor of Provider/Facility/AA Provider') * 100.0 / COUNT(*)), 
            2
        ) as provider_win_rate,
        ROUND(AVG(d.provider_offer_pct_qpa)::numeric, 2) as avg_provider_offer_pct,
        ROUND(AVG(d.prevailing_party_offer_pct_qpa)::numeric, 2) as avg_winning_offer_pct,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY d.length_determination_days)::numeric, 0) as median_resolution_days,
        ROUND(AVG(d.idre_compensation)::numeric, 2) as avg_idre_compensation
    FROM idr_disputes d
    WHERE 
        d.data_quarter = p_quarter
        AND (p_specialty IS NULL OR d.practice_facility_specialty = p_specialty)
        AND (p_state IS NULL OR d.location_of_service = p_state)
        AND (p_practice_size IS NULL OR d.practice_facility_size = p_practice_size)
        AND (p_service_codes IS NULL OR d.service_code = ANY(p_service_codes))
        AND (p_practice_name IS NULL OR d.provider_facility_name ILIKE '%' || p_practice_name || '%');
END;
$$ LANGUAGE plpgsql;

-- Function to get top service codes by volume
CREATE OR REPLACE FUNCTION get_top_service_codes(
    p_specialty VARCHAR DEFAULT NULL,
    p_state VARCHAR DEFAULT NULL,
    p_limit INTEGER DEFAULT 20
) RETURNS TABLE (
    service_code VARCHAR,
    description TEXT,
    dispute_count BIGINT,
    provider_win_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.service_code,
        sc.description,
        COUNT(*)::BIGINT as dispute_count,
        ROUND(
            (COUNT(*) FILTER (WHERE d.payment_determination_outcome = 'In Favor of Provider/Facility/AA Provider') * 100.0 / COUNT(*)), 
            2
        ) as provider_win_rate
    FROM idr_disputes d
    LEFT JOIN service_codes sc ON d.service_code = sc.code
    WHERE 
        d.service_code IS NOT NULL
        AND (p_specialty IS NULL OR d.practice_facility_specialty = p_specialty)
        AND (p_state IS NULL OR d.location_of_service = p_state)
    GROUP BY d.service_code, sc.description
    ORDER BY COUNT(*) DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- RLS (Row Level Security) policies for multi-tenant access if needed
ALTER TABLE idr_disputes ENABLE ROW LEVEL SECURITY;

-- Grant permissions for Supabase
-- Note: Adjust these based on your Supabase setup
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;

-- Refresh materialized views function
CREATE OR REPLACE FUNCTION refresh_performance_summaries()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW specialty_performance_summary;
    REFRESH MATERIALIZED VIEW service_code_performance_summary;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE idr_disputes IS 'Main table containing Federal IDR PUF dispute data for benchmarking analysis';
COMMENT ON COLUMN idr_disputes.payment_determination_outcome IS 'Final arbitration decision outcome';
COMMENT ON COLUMN idr_disputes.provider_offer_pct_qpa IS 'Provider offer as percentage of Qualifying Payment Amount';
COMMENT ON COLUMN idr_disputes.practice_facility_specialty IS 'Provider specialty for benchmarking comparisons';
COMMENT ON FUNCTION get_provider_benchmark IS 'Returns benchmark metrics filtered by practice characteristics';
