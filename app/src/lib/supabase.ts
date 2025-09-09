import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key'

// Use service role key for all operations (no rate limits, full access)
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'x-client-info': 'idr-benchmarking-app'
    }
  }
})

// Alias for backward compatibility
export const supabaseAdmin = supabase

// Types for our database schema
export interface IDRDispute {
  id: string
  dispute_number: string
  dli_number?: string
  payment_determination_outcome: string
  default_decision?: boolean
  prevailing_party_offer_pct_qpa?: number
  type_of_dispute?: string
  dispute_line_item_type?: string
  provider_facility_group_name?: string
  provider_facility_name?: string
  provider_email_domain?: string
  provider_facility_npi?: string
  practice_facility_size?: string
  practice_facility_specialty?: string
  health_plan_issuer_name?: string
  health_plan_email_domain?: string
  health_plan_type?: string
  service_code?: string
  type_of_service_code?: string
  place_of_service_code?: string
  item_service_description?: string
  location_of_service?: string
  provider_offer_pct_qpa?: number
  health_plan_offer_pct_qpa?: number
  qpa_pct_median_qpa?: number
  provider_offer_pct_median?: number
  health_plan_offer_pct_median?: number
  prevailing_offer_pct_median?: number
  length_determination_days?: number
  idre_compensation?: number
  offer_selected_from?: string
  initiating_party?: string
  data_quarter: string
  created_at: string
  updated_at: string
}

export interface BenchmarkMetrics {
  total_disputes: number
  provider_win_rate: number
  avg_provider_offer_pct: number
  avg_winning_offer_pct: number
  median_resolution_days: number
  avg_idre_compensation: number
  // Additional fields for law firms and provider groups
  total_practices?: number
  total_facilities?: number
  specialties_represented?: number
  states_represented?: number
}

export interface BenchmarkFilters {
  specialty?: string
  state?: string
  practice_size?: string
  quarter?: string
  practice_name?: string
  user_type?: 'individual_provider' | 'provider_group' | 'law_firm'
  email_domain?: string
  facility_group?: string
}
