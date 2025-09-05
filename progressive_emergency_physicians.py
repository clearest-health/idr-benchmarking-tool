# Search for Progressive Emergency Physicians with various spellings
print("🔍 SEARCHING FOR PROGRESSIVE EMERGENCY PHYSICIANS")
print("=" * 60)

# Try different search patterns
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

print("Searching through provider names with different patterns...")

all_matches = pd.DataFrame()

for pattern in search_patterns:
    print(f"\nSearching for pattern: '{pattern}'")

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

    print(f"  Provider/Facility Name matches: {len(provider_matches):,}")
    print(f"  Provider/Facility Group Name matches: {len(group_matches):,}")

    # Combine and remove duplicates
    pattern_matches = pd.concat([provider_matches, group_matches]).drop_duplicates()

    if len(pattern_matches) > 0:
        print(f"  Total unique matches for '{pattern}': {len(pattern_matches):,}")

        # Show sample matches
        unique_provider_names = pattern_matches["Provider/Facility Name"].unique()[:5]
        unique_group_names = pattern_matches["Provider/Facility Group Name"].unique()[
            :5
        ]

        print(f"  Sample provider names:")
        for name in unique_provider_names:
            if pd.notna(name):
                print(f"    - {name}")

        print(f"  Sample group names:")
        for name in unique_group_names:
            if pd.notna(name):
                print(f"    - {name}")

        # Add to overall matches
        all_matches = pd.concat([all_matches, pattern_matches]).drop_duplicates()

print(f"\n📊 TOTAL COMBINED RESULTS")
print("=" * 35)
print(f"Total unique disputes found: {len(all_matches):,}")
