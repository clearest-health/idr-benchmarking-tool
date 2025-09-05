#!/usr/bin/env python3
"""
IDR Benchmarking Tool - MVP Version
===================================

A simple benchmarking tool that allows providers to compare their IDR performance
against peers by specialty, geographic location, and practice size.

Key Features:
- Load and analyze Federal IDR PUF data
- Filter by specialty, geography, and practice size
- Calculate key benchmarking metrics
- Provide comparative insights

Value Propositions Addressed:
- Show providers how their outcomes compare to other NY providers
- Identify patterns in IDR outcomes
- Help determine which claims are worth pursuing
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple
import matplotlib.pyplot as plt
import seaborn as sns
from dataclasses import dataclass
from pathlib import Path


@dataclass
class BenchmarkFilters:
    """Filters for benchmarking analysis"""

    specialty: Optional[str] = None
    state: Optional[str] = None
    practice_size: Optional[str] = None
    service_codes: Optional[List[str]] = None


@dataclass
class BenchmarkMetrics:
    """Key benchmarking metrics"""

    total_disputes: int
    provider_win_rate: float
    avg_provider_offer_pct: float
    avg_winning_offer_pct: float
    median_time_to_resolution: float
    top_service_codes: Dict[str, int]
    avg_idre_compensation: float


class IDRBenchmarkingTool:
    """Main benchmarking tool class"""

    def __init__(self, data_file_path: str):
        """Initialize the benchmarking tool with IDR data"""
        self.data_file_path = Path(data_file_path)
        self.df = None
        self.load_data()

    def load_data(self):
        """Load the Federal IDR PUF data"""
        print(f"Loading IDR data from {self.data_file_path}...")
        try:
            self.df = pd.read_excel(
                self.data_file_path, sheet_name="OON Emergency and Non-Emergency"
            )
            print(f"✅ Loaded {len(self.df):,} dispute records")
            self._clean_data()
        except Exception as e:
            print(f"❌ Error loading data: {e}")
            raise

    def _clean_data(self):
        """Basic data cleaning"""
        # Clean numeric columns
        numeric_cols = [
            "Provider/Facility Offer as % of QPA",
            "Health Plan/Issuer Offer as % of QPA",
            "Prevailing Party Offer as % of QPA",
            "Length of Time to Make Determination",
            "IDRE Compensation",
        ]

        for col in numeric_cols:
            if col in self.df.columns:
                # Handle '+' symbols and convert to numeric
                self.df[col] = pd.to_numeric(
                    self.df[col]
                    .astype(str)
                    .str.replace("+", "")
                    .str.replace(",", "")
                    .str.replace("%", ""),
                    errors="coerce",
                )
                # For percentage columns, ensure they're in the right format
                if "% of QPA" in col:
                    # If values seem to be in decimal form (0-1), convert to percentage
                    if self.df[col].max() <= 10 and self.df[col].max() > 0:
                        self.df[col] = self.df[col] * 100

        print(f"✅ Data cleaned. Shape: {self.df.shape}")

    def get_available_filters(self) -> Dict[str, List[str]]:
        """Get available filter options"""
        return {
            "specialties": sorted(
                self.df["Practice/Facility Specialty or Type"].dropna().unique()
            ),
            "states": sorted(self.df["Location of Service"].dropna().unique()),
            "practice_sizes": sorted(
                self.df["Practice/Facility Size"].dropna().unique()
            ),
            "top_service_codes": self.df["Service Code"]
            .value_counts()
            .head(20)
            .index.tolist(),
        }

    def filter_data(self, filters: BenchmarkFilters) -> pd.DataFrame:
        """Apply filters to the dataset"""
        filtered_df = self.df.copy()

        if filters.specialty:
            filtered_df = filtered_df[
                filtered_df["Practice/Facility Specialty or Type"] == filters.specialty
            ]

        if filters.state:
            filtered_df = filtered_df[
                filtered_df["Location of Service"] == filters.state
            ]

        if filters.practice_size:
            filtered_df = filtered_df[
                filtered_df["Practice/Facility Size"] == filters.practice_size
            ]

        if filters.service_codes:
            filtered_df = filtered_df[
                filtered_df["Service Code"].isin(filters.service_codes)
            ]

        return filtered_df

    def calculate_metrics(self, filtered_df: pd.DataFrame) -> BenchmarkMetrics:
        """Calculate key benchmarking metrics"""
        if len(filtered_df) == 0:
            return BenchmarkMetrics(0, 0, 0, 0, 0, {}, 0)

        # Provider win rate
        provider_wins = (
            filtered_df["Payment Determination Outcome"]
            == "In Favor of Provider/Facility/AA Provider"
        ).sum()
        win_rate = (provider_wins / len(filtered_df)) * 100

        # Average offers
        avg_provider_offer = filtered_df["Provider/Facility Offer as % of QPA"].mean()
        avg_winning_offer = filtered_df["Prevailing Party Offer as % of QPA"].mean()

        # Time to resolution
        median_time = filtered_df["Length of Time to Make Determination"].median()

        # Top service codes
        top_codes = filtered_df["Service Code"].value_counts().head(10).to_dict()

        # IDRE compensation
        avg_idre_comp = filtered_df["IDRE Compensation"].mean()

        return BenchmarkMetrics(
            total_disputes=len(filtered_df),
            provider_win_rate=win_rate,
            avg_provider_offer_pct=avg_provider_offer,
            avg_winning_offer_pct=avg_winning_offer,
            median_time_to_resolution=median_time,
            top_service_codes=top_codes,
            avg_idre_compensation=avg_idre_comp,
        )

    def benchmark_analysis(
        self,
        provider_filters: BenchmarkFilters,
        comparison_filters: Optional[BenchmarkFilters] = None,
    ) -> Dict[str, BenchmarkMetrics]:
        """
        Perform benchmarking analysis comparing provider to peer group

        Args:
            provider_filters: Filters defining the provider's profile
            comparison_filters: Optional broader filters for comparison group
        """
        # Get provider-specific data
        provider_data = self.filter_data(provider_filters)
        provider_metrics = self.calculate_metrics(provider_data)

        # Get comparison group (broader filters or overall market)
        if comparison_filters:
            comparison_data = self.filter_data(comparison_filters)
        else:
            # Use same specialty but broader geographic/size scope
            broad_filters = BenchmarkFilters(
                specialty=provider_filters.specialty,
                # Remove geographic and size restrictions for broader comparison
            )
            comparison_data = self.filter_data(broad_filters)

        comparison_metrics = self.calculate_metrics(comparison_data)

        return {"provider": provider_metrics, "peer_group": comparison_metrics}

    def generate_report(
        self,
        benchmark_results: Dict[str, BenchmarkMetrics],
        provider_name: str = "Your Practice",
    ) -> str:
        """Generate a benchmarking report"""
        provider_metrics = benchmark_results["provider"]
        peer_metrics = benchmark_results["peer_group"]

        report = f"""
🏥 IDR BENCHMARKING REPORT: {provider_name}
{'=' * 60}

📊 YOUR PERFORMANCE vs PEER GROUP
{'─' * 40}

Win Rate:
• Your Practice: {provider_metrics.provider_win_rate:.1f}%
• Peer Average: {peer_metrics.provider_win_rate:.1f}%
• Difference: {provider_metrics.provider_win_rate - peer_metrics.provider_win_rate:+.1f} percentage points

Average Provider Offer (% of QPA):
• Your Practice: {provider_metrics.avg_provider_offer_pct:.1f}%
• Peer Average: {peer_metrics.avg_provider_offer_pct:.1f}%
• Difference: {provider_metrics.avg_provider_offer_pct - peer_metrics.avg_provider_offer_pct:+.1f} percentage points

Resolution Time:
• Your Practice: {provider_metrics.median_time_to_resolution:.0f} days (median)
• Peer Average: {peer_metrics.median_time_to_resolution:.0f} days (median)

Total Disputes Analyzed:
• Your Practice: {provider_metrics.total_disputes:,}
• Peer Group: {peer_metrics.total_disputes:,}

💡 KEY INSIGHTS
{'─' * 20}
"""

        # Add insights based on performance
        win_rate_diff = (
            provider_metrics.provider_win_rate - peer_metrics.provider_win_rate
        )
        if win_rate_diff > 5:
            report += "✅ Your win rate is significantly above peer average!\n"
        elif win_rate_diff < -5:
            report += "⚠️  Your win rate is below peer average - opportunity for improvement.\n"
        else:
            report += "➡️  Your win rate is close to peer average.\n"

        offer_diff = (
            provider_metrics.avg_provider_offer_pct
            - peer_metrics.avg_provider_offer_pct
        )
        if offer_diff > 10:
            report += "💰 You're asking for significantly more than peers - ensure justification is strong.\n"
        elif offer_diff < -10:
            report += "💡 You may be leaving money on the table - peers ask for more.\n"

        return report

    def visualize_comparison(
        self,
        benchmark_results: Dict[str, BenchmarkMetrics],
        save_path: Optional[str] = None,
    ):
        """Create visualization of benchmarking results"""
        provider_metrics = benchmark_results["provider"]
        peer_metrics = benchmark_results["peer_group"]

        fig, axes = plt.subplots(2, 2, figsize=(15, 10))
        fig.suptitle("IDR Performance Benchmarking", fontsize=16, fontweight="bold")

        # Win Rate Comparison
        win_rates = [provider_metrics.provider_win_rate, peer_metrics.provider_win_rate]
        labels = ["Your Practice", "Peer Average"]
        colors = ["#2E8B57", "#4682B4"]

        axes[0, 0].bar(labels, win_rates, color=colors)
        axes[0, 0].set_title("Provider Win Rate Comparison")
        axes[0, 0].set_ylabel("Win Rate (%)")
        axes[0, 0].set_ylim(0, 100)

        # Add value labels
        for i, v in enumerate(win_rates):
            axes[0, 0].text(
                i, v + 1, f"{v:.1f}%", ha="center", va="bottom", fontweight="bold"
            )

        # Offer Amount Comparison
        offers = [
            provider_metrics.avg_provider_offer_pct,
            peer_metrics.avg_provider_offer_pct,
        ]
        axes[0, 1].bar(labels, offers, color=colors)
        axes[0, 1].set_title("Average Provider Offer (% of QPA)")
        axes[0, 1].set_ylabel("Offer Amount (% of QPA)")

        # Add value labels
        for i, v in enumerate(offers):
            if not np.isnan(v):
                axes[0, 1].text(
                    i,
                    v + max(offers) * 0.01,
                    f"{v:.0f}%",
                    ha="center",
                    va="bottom",
                    fontweight="bold",
                )

        # Resolution Time Comparison
        times = [
            provider_metrics.median_time_to_resolution,
            peer_metrics.median_time_to_resolution,
        ]
        axes[1, 0].bar(labels, times, color=colors)
        axes[1, 0].set_title("Median Resolution Time")
        axes[1, 0].set_ylabel("Days")

        # Add value labels
        for i, v in enumerate(times):
            if not np.isnan(v):
                axes[1, 0].text(
                    i,
                    v + max(times) * 0.01,
                    f"{v:.0f}",
                    ha="center",
                    va="bottom",
                    fontweight="bold",
                )

        # Volume Comparison
        volumes = [provider_metrics.total_disputes, peer_metrics.total_disputes]
        axes[1, 1].bar(labels, volumes, color=colors)
        axes[1, 1].set_title("Total Disputes Analyzed")
        axes[1, 1].set_ylabel("Number of Disputes")

        # Add value labels
        for i, v in enumerate(volumes):
            axes[1, 1].text(
                i,
                v + max(volumes) * 0.01,
                f"{v:,}",
                ha="center",
                va="bottom",
                fontweight="bold",
            )

        plt.tight_layout()

        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches="tight")

        plt.show()


def main():
    """Example usage of the benchmarking tool"""
    # Initialize the tool
    tool = IDRBenchmarkingTool(
        "files/federal-idr-puf-for-2024-q4-as-of-may-28-2025.xlsx"
    )

    # Get available filter options
    filters = tool.get_available_filters()
    print("\n📋 Available Filter Options:")
    print(f"Top 10 Specialties: {filters['specialties'][:10]}")
    print(f"States: {filters['states'][:10]}")
    print(f"Practice Sizes: {filters['practice_sizes']}")

    # Example: Benchmark an Emergency Medicine practice in NY
    provider_filters = BenchmarkFilters(
        specialty="Emergency Medicine", state="NY", practice_size="101-500 Employees"
    )

    # Run benchmarking analysis
    results = tool.benchmark_analysis(provider_filters)

    # Generate report
    report = tool.generate_report(results, "NY Emergency Medicine Group")
    print(report)

    # Create visualization
    tool.visualize_comparison(results, "benchmark_comparison.png")


if __name__ == "__main__":
    main()
