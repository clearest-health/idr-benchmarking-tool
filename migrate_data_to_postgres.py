#!/usr/bin/env python3
"""
IDR Data Migration Script
========================

Migrates Federal IDR PUF data from Excel files to PostgreSQL database.
Designed to work with Supabase or any PostgreSQL instance.

Usage:
    python migrate_data_to_postgres.py --connection-string "postgresql://..." --quarter "2024-Q4"
"""

import pandas as pd
import psycopg2
import psycopg2.extras
import argparse
import logging
from pathlib import Path
from typing import Optional, Dict, Any, List
import sys
from tqdm import tqdm
import numpy as np

# Set up logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class IDRDataMigrator:
    """Handles migration of IDR data from Excel to PostgreSQL"""

    def __init__(self, connection_string: str):
        """Initialize with database connection string"""
        self.connection_string = connection_string
        self.conn = None

    def connect(self):
        """Connect to PostgreSQL database"""
        try:
            self.conn = psycopg2.connect(self.connection_string)
            self.conn.autocommit = False
            logger.info("✅ Connected to PostgreSQL database")
        except Exception as e:
            logger.error(f"❌ Failed to connect to database: {e}")
            raise

    def disconnect(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()
            logger.info("🔌 Disconnected from database")

    def create_schema(self, schema_file: str = "database_schema.sql"):
        """Execute schema creation SQL"""
        try:
            with open(schema_file, "r") as f:
                schema_sql = f.read()

            with self.conn.cursor() as cursor:
                cursor.execute(schema_sql)
                self.conn.commit()

            logger.info("✅ Database schema created successfully")
        except Exception as e:
            logger.error(f"❌ Failed to create schema: {e}")
            self.conn.rollback()
            raise

    def clean_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """Clean and standardize the data"""
        logger.info("🧹 Cleaning data...")

        # Create a copy to avoid modifying original
        df_clean = df.copy()

        # Column name mapping from Excel to database
        column_mapping = {
            "Dispute Number": "dispute_number",
            "DLI Number": "dli_number",
            "Payment Determination Outcome": "payment_determination_outcome",
            "Default Decision": "default_decision",
            "Type of Dispute": "type_of_dispute",
            "Provider/Facility Group Name": "provider_facility_group_name",
            "Provider/Facility Name": "provider_facility_name",
            "Provider Email Domain": "provider_email_domain",
            "Provider/Facility NPI Number": "provider_facility_npi",
            "Practice/Facility Size": "practice_facility_size",
            "Health Plan/Issuer Name": "health_plan_issuer_name",
            "Health Plan/Issuer Email Domain": "health_plan_email_domain",
            "Health Plan Type": "health_plan_type",
            "Length of Time to Make Determination": "length_determination_days",
            "IDRE Compensation": "idre_compensation",
            "Dispute Line Item Type": "dispute_line_item_type",
            "Type of Service Code": "type_of_service_code",
            "Service Code": "service_code",
            "Place of Service Code": "place_of_service_code",
            "Item or Service Description": "item_service_description",
            "Location of Service": "location_of_service",
            "Practice/Facility Specialty or Type": "practice_facility_specialty",
            "Provider/Facility Offer as % of QPA": "provider_offer_pct_qpa",
            "Health Plan/Issuer Offer as % of QPA": "health_plan_offer_pct_qpa",
            "Offer Selected from Provider or Issuer": "offer_selected_from",
            "Prevailing Party Offer as % of QPA": "prevailing_party_offer_pct_qpa",
            "QPA as Percent of Median QPA": "qpa_pct_median_qpa",
            "Provider/Facility Offer as Percent of Median Provider/Facility Offer Amount": "provider_offer_pct_median",
            "Health Plan/Issuer Offer as Percent of Median Health Plan/Issuer Offer Amount": "health_plan_offer_pct_median",
            "Prevailing Offer as Percent of Median Prevailing Offer Amount": "prevailing_offer_pct_median",
            "Initiating Party": "initiating_party",
        }

        # Rename columns
        df_clean = df_clean.rename(columns=column_mapping)

        # Clean numeric columns
        numeric_columns = [
            "provider_offer_pct_qpa",
            "health_plan_offer_pct_qpa",
            "prevailing_party_offer_pct_qpa",
            "qpa_pct_median_qpa",
            "provider_offer_pct_median",
            "health_plan_offer_pct_median",
            "prevailing_offer_pct_median",
            "length_determination_days",
            "idre_compensation",
        ]

        for col in numeric_columns:
            if col in df_clean.columns:
                # Handle '+' symbols, commas, and percentage signs
                df_clean[col] = (
                    df_clean[col]
                    .astype(str)
                    .str.replace("+", "")
                    .str.replace(",", "")
                    .str.replace("%", "")
                )
                df_clean[col] = pd.to_numeric(df_clean[col], errors="coerce")

        # Clean boolean columns
        if "default_decision" in df_clean.columns:
            df_clean["default_decision"] = df_clean["default_decision"].map(
                {"Yes": True, "No": False, "Y": True, "N": False}
            )

        # Clean text columns - remove extra whitespace and handle nulls
        text_columns = [
            col for col in df_clean.columns if df_clean[col].dtype == "object"
        ]
        for col in text_columns:
            if col not in numeric_columns:
                df_clean[col] = df_clean[col].astype(str).str.strip()
                df_clean[col] = df_clean[col].replace("nan", None)
                df_clean[col] = df_clean[col].replace("", None)

        # Ensure required columns exist
        required_columns = [
            "dispute_number",
            "payment_determination_outcome",
            "practice_facility_specialty",
            "location_of_service",
            "practice_facility_size",
        ]

        missing_columns = [
            col for col in required_columns if col not in df_clean.columns
        ]
        if missing_columns:
            raise ValueError(f"Missing required columns: {missing_columns}")

        logger.info(f"✅ Data cleaned. Shape: {df_clean.shape}")
        return df_clean

    def load_quarter_data(self, excel_file: str, quarter: str) -> int:
        """Load data for a specific quarter"""
        logger.info(f"📊 Loading data from {excel_file} for quarter {quarter}")

        try:
            # Read the main dispute data
            df = pd.read_excel(excel_file, sheet_name="OON Emergency and Non-Emergency")
            logger.info(f"📁 Loaded {len(df):,} rows from Excel")

            # Clean the data
            df_clean = self.clean_data(df)

            # Add quarter column
            df_clean["data_quarter"] = quarter

            # Insert data in batches
            batch_size = 1000
            total_rows = len(df_clean)
            inserted_rows = 0

            with self.conn.cursor() as cursor:
                # Prepare the INSERT statement
                columns = list(df_clean.columns)
                placeholders = ", ".join(["%s"] * len(columns))
                insert_sql = f"""
                    INSERT INTO idr_disputes ({', '.join(columns)})
                    VALUES ({placeholders})
                    ON CONFLICT (dispute_number) DO UPDATE SET
                        updated_at = NOW()
                """

                # Insert in batches with progress bar
                with tqdm(total=total_rows, desc="Inserting records") as pbar:
                    for i in range(0, total_rows, batch_size):
                        batch = df_clean.iloc[i : i + batch_size]

                        # Convert DataFrame to list of tuples
                        batch_data = []
                        for _, row in batch.iterrows():
                            # Convert numpy types to Python types and handle NaN
                            row_data = []
                            for value in row:
                                if pd.isna(value):
                                    row_data.append(None)
                                elif isinstance(value, (np.integer, np.floating)):
                                    row_data.append(
                                        float(value) if np.isfinite(value) else None
                                    )
                                else:
                                    row_data.append(value)
                            batch_data.append(tuple(row_data))

                        # Execute batch insert
                        try:
                            cursor.executemany(insert_sql, batch_data)
                            inserted_rows += len(batch_data)
                            pbar.update(len(batch_data))
                        except Exception as e:
                            logger.error(
                                f"❌ Error inserting batch {i}-{i+len(batch_data)}: {e}"
                            )
                            # Try inserting rows individually to identify problematic rows
                            for j, row_data in enumerate(batch_data):
                                try:
                                    cursor.execute(insert_sql, row_data)
                                    inserted_rows += 1
                                    pbar.update(1)
                                except Exception as row_error:
                                    logger.warning(f"⚠️ Skipping row {i+j}: {row_error}")
                                    pbar.update(1)

                self.conn.commit()

            logger.info(
                f"✅ Successfully inserted {inserted_rows:,} rows for quarter {quarter}"
            )
            return inserted_rows

        except Exception as e:
            logger.error(f"❌ Failed to load quarter data: {e}")
            self.conn.rollback()
            raise

    def populate_lookup_tables(self):
        """Populate lookup tables with data from main table"""
        logger.info("📋 Populating lookup tables...")

        try:
            with self.conn.cursor() as cursor:
                # Populate specialties table
                cursor.execute(
                    """
                    INSERT INTO specialties (name, standardized_name)
                    SELECT DISTINCT 
                        practice_facility_specialty,
                        practice_facility_specialty
                    FROM idr_disputes 
                    WHERE practice_facility_specialty IS NOT NULL
                    ON CONFLICT (name) DO NOTHING
                """
                )

                # Populate service_codes table
                cursor.execute(
                    """
                    INSERT INTO service_codes (code, description)
                    SELECT DISTINCT 
                        service_code,
                        item_service_description
                    FROM idr_disputes 
                    WHERE service_code IS NOT NULL
                    ON CONFLICT (code) DO NOTHING
                """
                )

                self.conn.commit()
                logger.info("✅ Lookup tables populated")

        except Exception as e:
            logger.error(f"❌ Failed to populate lookup tables: {e}")
            self.conn.rollback()
            raise

    def refresh_materialized_views(self):
        """Refresh materialized views for performance"""
        logger.info("🔄 Refreshing materialized views...")

        try:
            with self.conn.cursor() as cursor:
                cursor.execute("SELECT refresh_performance_summaries()")
                self.conn.commit()

            logger.info("✅ Materialized views refreshed")

        except Exception as e:
            logger.error(f"❌ Failed to refresh materialized views: {e}")
            self.conn.rollback()
            raise

    def get_migration_stats(self) -> Dict[str, Any]:
        """Get statistics about the migrated data"""
        try:
            with self.conn.cursor(
                cursor_factory=psycopg2.extras.RealDictCursor
            ) as cursor:
                # Total disputes
                cursor.execute("SELECT COUNT(*) as total_disputes FROM idr_disputes")
                total_disputes = cursor.fetchone()["total_disputes"]

                # Disputes by quarter
                cursor.execute(
                    """
                    SELECT data_quarter, COUNT(*) as count 
                    FROM idr_disputes 
                    GROUP BY data_quarter 
                    ORDER BY data_quarter
                """
                )
                by_quarter = cursor.fetchall()

                # Top specialties
                cursor.execute(
                    """
                    SELECT practice_facility_specialty, COUNT(*) as count 
                    FROM idr_disputes 
                    WHERE practice_facility_specialty IS NOT NULL
                    GROUP BY practice_facility_specialty 
                    ORDER BY count DESC 
                    LIMIT 10
                """
                )
                top_specialties = cursor.fetchall()

                # Provider win rate
                cursor.execute(
                    """
                    SELECT 
                        COUNT(*) as total,
                        COUNT(*) FILTER (WHERE payment_determination_outcome = 'In Favor of Provider/Facility/AA Provider') as provider_wins,
                        ROUND(
                            (COUNT(*) FILTER (WHERE payment_determination_outcome = 'In Favor of Provider/Facility/AA Provider') * 100.0 / COUNT(*)), 
                            2
                        ) as provider_win_rate
                    FROM idr_disputes
                """
                )
                win_stats = cursor.fetchone()

                return {
                    "total_disputes": total_disputes,
                    "by_quarter": [dict(row) for row in by_quarter],
                    "top_specialties": [dict(row) for row in top_specialties],
                    "provider_win_rate": float(win_stats["provider_win_rate"]),
                    "provider_wins": win_stats["provider_wins"],
                    "total_analyzed": win_stats["total"],
                }

        except Exception as e:
            logger.error(f"❌ Failed to get migration stats: {e}")
            return {}


def main():
    """Main migration script"""
    parser = argparse.ArgumentParser(
        description="Migrate IDR data from Excel to PostgreSQL"
    )
    parser.add_argument(
        "--connection-string",
        required=True,
        help="PostgreSQL connection string (e.g., postgresql://user:pass@host:port/db)",
    )
    parser.add_argument(
        "--excel-file",
        default="files/federal-idr-puf-for-2024-q4-as-of-may-28-2025.xlsx",
        help="Path to Excel file with IDR data",
    )
    parser.add_argument(
        "--quarter", default="2024-Q4", help="Data quarter identifier (e.g., 2024-Q4)"
    )
    parser.add_argument(
        "--create-schema",
        action="store_true",
        help="Create database schema before migration",
    )
    parser.add_argument(
        "--schema-file", default="database_schema.sql", help="Path to SQL schema file"
    )

    args = parser.parse_args()

    # Validate files exist
    if not Path(args.excel_file).exists():
        logger.error(f"❌ Excel file not found: {args.excel_file}")
        sys.exit(1)

    if args.create_schema and not Path(args.schema_file).exists():
        logger.error(f"❌ Schema file not found: {args.schema_file}")
        sys.exit(1)

    # Initialize migrator
    migrator = IDRDataMigrator(args.connection_string)

    try:
        # Connect to database
        migrator.connect()

        # Create schema if requested
        if args.create_schema:
            logger.info("🏗️ Creating database schema...")
            migrator.create_schema(args.schema_file)

        # Load data
        logger.info(f"🚀 Starting migration for quarter {args.quarter}")
        inserted_rows = migrator.load_quarter_data(args.excel_file, args.quarter)

        # Populate lookup tables
        migrator.populate_lookup_tables()

        # Refresh materialized views
        migrator.refresh_materialized_views()

        # Get and display stats
        stats = migrator.get_migration_stats()

        logger.info("📈 MIGRATION COMPLETE!")
        logger.info("=" * 50)
        logger.info(f"Total Disputes: {stats.get('total_disputes', 0):,}")
        logger.info(f"Provider Win Rate: {stats.get('provider_win_rate', 0):.1f}%")
        logger.info(
            f"Quarters Available: {[q['data_quarter'] for q in stats.get('by_quarter', [])]}"
        )
        logger.info(
            f"Top Specialties: {[s['practice_facility_specialty'][:30] + '...' if len(s['practice_facility_specialty']) > 30 else s['practice_facility_specialty'] for s in stats.get('top_specialties', [])[:5]]}"
        )

    except Exception as e:
        logger.error(f"❌ Migration failed: {e}")
        sys.exit(1)

    finally:
        migrator.disconnect()


if __name__ == "__main__":
    main()
