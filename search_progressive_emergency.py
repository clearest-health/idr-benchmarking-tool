#!/usr/bin/env python3
"""
Progressive Emergency Physicians Search Tool
Federal IDR Data Analysis

This script searches for Progressive Emergency Physicians (and similar variations)
in the Federal IDR dispute data and provides detailed analysis.

Usage: python search_progressive_emergency.py
"""

import pandas as pd
import sys
from pathlib import Path


def search_progressive_emergency(excel_file_path):
    """
    Search for Progressive Emergency Physicians in Federal IDR data

    Args:
        excel_file_path (str): Path to the Excel file containing IDR data

    Returns:
        pd.DataFrame: Filtered data containing matches
    """

    print("🔍 PROGRESSIVE EMERGENCY PHYSICIANS SEARCH TOOL")
    print("=" * 60)
    print(f"Loading data from: {excel_file_path}")

    try:
        # Load the main dispute data
        df_main = pd.read_excel(
            excel_file_path, sheet_name="OON Emergency and Non-Emergency"
        )
        print(f"✅ Loaded {len(df_main):,} total disputes")

    except Exception as e:
        print(f"❌ Error loading file: {e}")
        return None

    # Search patterns for Progressive Emergency Physicians
    search_patterns = [
        "Progressive Emergency Physicians",
        "Progressive Emergency",
        "Progressive.*Emergency",
        "Emergency.*Progressive",
        "Progressive.*Physicians",
        "Physicians.*Progressive",
        "Progressive",
        "Emergency Physicians",
    ]

    print(f"\n🔍 Searching with {len(search_patterns)} different patterns...")

    all_matches = pd.DataFrame()

    for i, pattern in enumerate(search_patterns, 1):
        print(f"\n{i}. Searching for pattern: '{pattern}'")

        # Search in both provider/facility name and group name
        provider_matches = df_main[
            df_main["Provider/Facility Name"].str.contains(
                pattern, case=False, na=False, regex=True
            )
        ]
        group_matches = df_main[
            df_main["Provider/Facility Group Name"].str.contains(
                pattern, case=False, na=False, regex=True
            )
        ]

        print(f"   Provider/Facility Name matches: {len(provider_matches):,}")
        print(f"   Provider/Facility Group Name matches: {len(group_matches):,}")

        # Combine and remove duplicates for this pattern
        pattern_matches = pd.concat([provider_matches, group_matches]).drop_duplicates()

        if len(pattern_matches) > 0:
            print(f"   ✅ Total unique matches: {len(pattern_matches):,}")

            # Show sample matches
            unique_provider_names = (
                pattern_matches["Provider/Facility Name"].dropna().unique()[:3]
            )
            unique_group_names = (
                pattern_matches["Provider/Facility Group Name"].dropna().unique()[:3]
            )

            if len(unique_provider_names) > 0:
                print(f"   Sample provider names:")
                for name in unique_provider_names:
                    print(f"     - {name}")

            if len(unique_group_names) > 0:
                print(f"   Sample group names:")
                for name in unique_group_names:
                    print(f"     - {name}")

            # Add to overall matches
            all_matches = pd.concat([all_matches, pattern_matches]).drop_duplicates()
        else:
            print(f"   ❌ No matches found")

    return all_matches


def analyze_progressive_emergency(matches_df):
    """
    Provide detailed analysis of Progressive Emergency Physicians data

    Args:
        matches_df (pd.DataFrame): DataFrame containing matched disputes
    """

    if len(matches_df) == 0:
        print("\n❌ No Progressive Emergency Physicians data found to analyze")
        return

    print(f"\n📊 DETAILED ANALYSIS OF PROGRESSIVE EMERGENCY PHYSICIANS")
    print("=" * 65)
    print(f"Total disputes found: {len(matches_df):,}")

    # Get all unique provider and group names
    print(f"\n🏥 ALL MATCHING ORGANIZATIONS:")
    print("-" * 40)

    provider_names = matches_df["Provider/Facility Name"].value_counts()
    group_names = matches_df["Provider/Facility Group Name"].value_counts()

    print(f"Provider/Facility Names ({len(provider_names)} unique):")
    for name, count in provider_names.items():
        if pd.notna(name):
            print(f"  {count:>4,} disputes: {name}")

    print(f"\nProvider/Facility Group Names ({len(group_names)} unique):")
    for name, count in group_names.items():
        if pd.notna(name):
            print(f"  {count:>4,} disputes: {name}")

    # Focus on the organization with the most disputes
    if len(provider_names) > 0:
        top_provider = provider_names.index[0]
        top_provider_disputes = matches_df[
            matches_df["Provider/Facility Name"] == top_provider
        ]

        print(f"\n🎯 DETAILED ANALYSIS: {top_provider}")
        print("=" * 60)
        print(f"Total disputes: {len(top_provider_disputes):,}")

        # Dispute outcomes
        print(f"\n📈 DISPUTE OUTCOMES:")
        outcomes = top_provider_disputes["Payment Determination Outcome"].value_counts()
        for outcome, count in outcomes.items():
            pct = (count / len(top_provider_disputes)) * 100
            print(f"  {outcome}: {count:,} ({pct:.1f}%)")

        # Calculate success rate
        provider_wins = len(
            top_provider_disputes[
                top_provider_disputes["Payment Determination Outcome"]
                == "In Favor of Provider/Facility/AA Provider"
            ]
        )
        success_rate = (provider_wins / len(top_provider_disputes)) * 100
        print(f"\n🏆 Provider success rate: {success_rate:.1f}%")

        # Geographic distribution
        print(f"\n📍 GEOGRAPHIC DISTRIBUTION:")
        locations = top_provider_disputes["Location of Service"].value_counts().head(10)
        for location, count in locations.items():
            pct = (count / len(top_provider_disputes)) * 100
            print(f"  {location}: {count:,} ({pct:.1f}%)")

        # Health plans they dispute with most
        print(f"\n🏥 TOP HEALTH PLANS DISPUTED WITH:")
        health_plans = (
            top_provider_disputes["Health Plan/Issuer Name"].value_counts().head(10)
        )
        for plan, count in health_plans.items():
            pct = (count / len(top_provider_disputes)) * 100
            print(f"  {plan}: {count:,} ({pct:.1f}%)")

        # Practice characteristics
        print(f"\n🏢 PRACTICE CHARACTERISTICS:")
        practice_size = top_provider_disputes["Practice/Facility Size"].value_counts()
        for size, count in practice_size.items():
            pct = (count / len(top_provider_disputes)) * 100
            print(f"  {size}: {count:,} ({pct:.1f}%)")

        # Dispute types
        print(f"\n⚖️ DISPUTE TYPES:")
        dispute_types = top_provider_disputes["Type of Dispute"].value_counts()
        for disp_type, count in dispute_types.items():
            pct = (count / len(top_provider_disputes)) * 100
            print(f"  {disp_type}: {count:,} ({pct:.1f}%)")

        # Top services provided
        print(f"\n💊 TOP 10 SERVICES PROVIDED:")
        service_codes = top_provider_disputes["Service Code"].value_counts().head(10)
        for code, count in service_codes.items():
            # Get description for this service code
            try:
                description = top_provider_disputes[
                    top_provider_disputes["Service Code"] == code
                ]["Item or Service Description"].iloc[0]
                short_desc = (
                    description[:60] + "..." if len(description) > 60 else description
                )
            except:
                short_desc = "Description not available"

            pct = (count / len(top_provider_disputes)) * 100
            print(f"  {code}: {count:,} ({pct:.1f}%) - {short_desc}")

        # Payment analysis if available
        if "Provider/Facility Offer as % of QPA" in top_provider_disputes.columns:
            print(f"\n💰 PAYMENT ANALYSIS:")

            # Clean and convert percentage data
            def clean_percentage(pct_str):
                if pd.isna(pct_str):
                    return None
                try:
                    return float(str(pct_str).replace("%", "").replace(",", ""))
                except:
                    return None

            top_provider_disputes_copy = top_provider_disputes.copy()
            top_provider_disputes_copy["Provider_Offer_Numeric"] = (
                top_provider_disputes_copy["Provider/Facility Offer as % of QPA"].apply(
                    clean_percentage
                )
            )

            valid_offers = top_provider_disputes_copy["Provider_Offer_Numeric"].dropna()
            if len(valid_offers) > 0:
                print(f"  Average provider offer: {valid_offers.mean():.0f}% of QPA")
                print(f"  Median provider offer: {valid_offers.median():.0f}% of QPA")
                print(f"  Highest offer: {valid_offers.max():.0f}% of QPA")
                print(f"  Lowest offer: {valid_offers.min():.0f}% of QPA")


def search_emergency_medicine_broadly(df_main):
    """
    If Progressive Emergency Physicians not found, search broadly for emergency medicine providers
    """
    print(f"\n🔍 BROADER EMERGENCY MEDICINE SEARCH")
    print("=" * 45)

    # Emergency medicine specialty search
    emergency_specialty = df_main[
        df_main["Practice/Facility Specialty or Type"].str.contains(
            "Emergency", case=False, na=False
        )
    ]
    print(f"Total Emergency Medicine disputes: {len(emergency_specialty):,}")

    # Look for any Progressive providers in emergency medicine
    progressive_emergency = emergency_specialty[
        (
            emergency_specialty["Provider/Facility Name"].str.contains(
                "Progressive", case=False, na=False
            )
        )
        | (
            emergency_specialty["Provider/Facility Group Name"].str.contains(
                "Progressive", case=False, na=False
            )
        )
    ]

    if len(progressive_emergency) > 0:
        print(
            f"\n🎯 PROGRESSIVE + EMERGENCY MEDICINE MATCHES: {len(progressive_emergency):,}"
        )

        prog_em_providers = (
            progressive_emergency["Provider/Facility Name"].value_counts().head(10)
        )
        prog_em_groups = (
            progressive_emergency["Provider/Facility Group Name"]
            .value_counts()
            .head(10)
        )

        print(f"\nProgressive Emergency Medicine Providers:")
        for name, count in prog_em_providers.items():
            if pd.notna(name):
                print(f"  {count:>4,}: {name}")

        print(f"\nProgressive Emergency Medicine Groups:")
        for name, count in prog_em_groups.items():
            if pd.notna(name):
                print(f"  {count:>4,}: {name}")

        return progressive_emergency
    else:
        print("❌ No Progressive providers found in Emergency Medicine specialty")

        # Show top emergency medicine providers for reference
        print(f"\n📋 TOP 15 EMERGENCY MEDICINE PROVIDERS (for reference):")
        top_em_providers = (
            emergency_specialty["Provider/Facility Name"].value_counts().head(15)
        )
        for name, count in top_em_providers.items():
            if pd.notna(name):
                print(f"  {count:>4,}: {name}")

        return pd.DataFrame()


def main():
    """
    Main function to run the Progressive Emergency Physicians search
    """
    print("Progressive Emergency Physicians Federal IDR Search Tool")
    print("=" * 60)

    # Look for Excel files in current directory
    excel_files = list(Path("./files/").glob("*.xlsx"))
    if not excel_files:
        print("❌ No Excel files found in current directory.")
        print(
            "Please ensure Federal IDR Excel files are in the same directory as this script."
        )
        sys.exit(1)

    # Use the largest file (likely the main dispute data)
    excel_file = max(excel_files, key=lambda x: x.stat().st_size)
    print(f"Using file: {excel_file.name}")

    # Search for Progressive Emergency Physicians
    matches = search_progressive_emergency(str(excel_file))

    if matches is not None and len(matches) > 0:
        # Analyze the matches
        analyze_progressive_emergency(matches)

        # Export results
        output_file = "progressive_emergency_physicians_results.csv"
        matches.to_csv(output_file, index=False)
        print(f"\n💾 Results exported to: {output_file}")

    else:
        print("\n❌ Progressive Emergency Physicians not found with exact name.")
        print("Attempting broader emergency medicine search...")

        # Load data for broader search
        try:
            df_main = pd.read_excel(
                str(excel_file), sheet_name="OON Emergency and Non-Emergency"
            )
            broader_matches = search_emergency_medicine_broadly(df_main)

            if len(broader_matches) > 0:
                output_file = "progressive_emergency_broader_results.csv"
                broader_matches.to_csv(output_file, index=False)
                print(f"\n💾 Broader results exported to: {output_file}")

        except Exception as e:
            print(f"❌ Error in broader search: {e}")

    print(f"\n✅ Search completed!")


if __name__ == "__main__":
    main()
