#!/usr/bin/env python3
"""
IDR Benchmarking Tool - Streamlit Web Interface
==============================================

A simple web interface for the IDR benchmarking tool that allows providers
to compare their performance against peers.

Key Features:
- Interactive filters for specialty, geography, and practice size
- Real-time benchmarking calculations
- Visual comparisons and insights
- Downloadable reports

Value Propositions:
- "We've been studying IDR outcomes and can show how your group compares"
- "Identify patterns in why some groups lose or waste money in arbitration"
- "Show which claims are worth fighting and which aren't"
"""

import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from idr_benchmarking_tool import IDRBenchmarkingTool, BenchmarkFilters
import numpy as np
from pathlib import Path

# Page config
st.set_page_config(
    page_title="IDR Benchmarking Tool",
    page_icon="🏥",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Custom CSS
st.markdown(
    """
<style>
    .main-header {
        font-size: 2.5rem;
        font-weight: bold;
        color: #2E8B57;
        text-align: center;
        margin-bottom: 2rem;
    }
    .metric-card {
        background-color: #f0f2f6;
        padding: 1rem;
        border-radius: 0.5rem;
        border-left: 4px solid #2E8B57;
    }
    .insight-box {
        background-color: #e8f4fd;
        padding: 1rem;
        border-radius: 0.5rem;
        border-left: 4px solid #4682B4;
        margin: 1rem 0;
    }
    .warning-box {
        background-color: #fff3cd;
        padding: 1rem;
        border-radius: 0.5rem;
        border-left: 4px solid #ffc107;
        margin: 1rem 0;
    }
    .success-box {
        background-color: #d4edda;
        padding: 1rem;
        border-radius: 0.5rem;
        border-left: 4px solid #28a745;
        margin: 1rem 0;
    }
</style>
""",
    unsafe_allow_html=True,
)


@st.cache_data
def load_benchmarking_tool():
    """Load the benchmarking tool with caching"""
    data_path = "files/federal-idr-puf-for-2024-q4-as-of-may-28-2025.xlsx"
    if not Path(data_path).exists():
        st.error(f"Data file not found: {data_path}")
        st.stop()

    try:
        tool = IDRBenchmarkingTool(data_path)
        return tool
    except Exception as e:
        st.error(f"Error loading data: {e}")
        st.stop()


def create_comparison_chart(provider_metrics, peer_metrics):
    """Create interactive comparison charts"""

    # Create subplots
    fig = make_subplots(
        rows=2,
        cols=2,
        subplot_titles=(
            "Win Rate Comparison",
            "Average Provider Offer (% QPA)",
            "Resolution Time (Days)",
            "Total Disputes",
        ),
        specs=[[{"type": "bar"}, {"type": "bar"}], [{"type": "bar"}, {"type": "bar"}]],
    )

    categories = ["Your Practice", "Peer Average"]
    colors = ["#2E8B57", "#4682B4"]

    # Win Rate
    win_rates = [provider_metrics.provider_win_rate, peer_metrics.provider_win_rate]
    fig.add_trace(
        go.Bar(
            x=categories,
            y=win_rates,
            name="Win Rate",
            marker_color=colors,
            showlegend=False,
            text=[f"{rate:.1f}%" for rate in win_rates],
            textposition="outside",
        ),
        row=1,
        col=1,
    )

    # Provider Offers
    offers = [
        provider_metrics.avg_provider_offer_pct,
        peer_metrics.avg_provider_offer_pct,
    ]
    # Handle NaN values
    offers = [offer if not np.isnan(offer) else 0 for offer in offers]
    fig.add_trace(
        go.Bar(
            x=categories,
            y=offers,
            name="Avg Offer",
            marker_color=colors,
            showlegend=False,
            text=[f"{offer:.0f}%" if offer > 0 else "N/A" for offer in offers],
            textposition="outside",
        ),
        row=1,
        col=2,
    )

    # Resolution Time
    times = [
        provider_metrics.median_time_to_resolution,
        peer_metrics.median_time_to_resolution,
    ]
    times = [time if not np.isnan(time) else 0 for time in times]
    fig.add_trace(
        go.Bar(
            x=categories,
            y=times,
            name="Resolution Time",
            marker_color=colors,
            showlegend=False,
            text=[f"{time:.0f}" if time > 0 else "N/A" for time in times],
            textposition="outside",
        ),
        row=2,
        col=1,
    )

    # Total Disputes
    volumes = [provider_metrics.total_disputes, peer_metrics.total_disputes]
    fig.add_trace(
        go.Bar(
            x=categories,
            y=volumes,
            name="Total Disputes",
            marker_color=colors,
            showlegend=False,
            text=[f"{vol:,}" for vol in volumes],
            textposition="outside",
        ),
        row=2,
        col=2,
    )

    fig.update_layout(height=600, title_text="Performance Benchmarking Dashboard")
    return fig


def generate_insights(provider_metrics, peer_metrics):
    """Generate actionable insights based on comparison"""
    insights = []

    # Win rate insights
    win_rate_diff = provider_metrics.provider_win_rate - peer_metrics.provider_win_rate
    if win_rate_diff > 5:
        insights.append(
            {
                "type": "success",
                "title": "🎯 Excellent Win Rate Performance",
                "message": f"Your win rate of {provider_metrics.provider_win_rate:.1f}% is {win_rate_diff:.1f} percentage points above the peer average. This suggests strong case selection and preparation.",
            }
        )
    elif win_rate_diff < -5:
        insights.append(
            {
                "type": "warning",
                "title": "⚠️ Win Rate Below Peers",
                "message": f"Your win rate of {provider_metrics.provider_win_rate:.1f}% is {abs(win_rate_diff):.1f} percentage points below peers. Consider reviewing case selection criteria and documentation quality.",
            }
        )
    else:
        insights.append(
            {
                "type": "info",
                "title": "📊 Win Rate In Line with Peers",
                "message": f"Your win rate of {provider_metrics.provider_win_rate:.1f}% is close to the peer average, indicating consistent performance.",
            }
        )

    # Offer amount insights
    if not np.isnan(provider_metrics.avg_provider_offer_pct) and not np.isnan(
        peer_metrics.avg_provider_offer_pct
    ):
        offer_diff = (
            provider_metrics.avg_provider_offer_pct
            - peer_metrics.avg_provider_offer_pct
        )
        if offer_diff > 20:
            insights.append(
                {
                    "type": "warning",
                    "title": "💰 High Offer Strategy",
                    "message": f"Your average offer of {provider_metrics.avg_provider_offer_pct:.0f}% QPA is {offer_diff:.0f} points above peers. Ensure strong justification for higher amounts.",
                }
            )
        elif offer_diff < -20:
            insights.append(
                {
                    "type": "info",
                    "title": "💡 Conservative Offer Strategy",
                    "message": f"Your offers are {abs(offer_diff):.0f} points below peers. You may have opportunities to request higher amounts with proper documentation.",
                }
            )

    # Volume insights
    if provider_metrics.total_disputes < 50:
        insights.append(
            {
                "type": "info",
                "title": "📈 Limited Sample Size",
                "message": f"With {provider_metrics.total_disputes} disputes, consider accumulating more data for robust benchmarking. Results may vary with larger samples.",
            }
        )

    return insights


def main():
    """Main Streamlit application"""

    # Header
    st.markdown(
        '<div class="main-header">🏥 IDR Benchmarking Tool</div>',
        unsafe_allow_html=True,
    )
    st.markdown("### Compare your IDR performance against peer providers")

    # Load the benchmarking tool
    with st.spinner("Loading IDR data..."):
        tool = load_benchmarking_tool()

    # Get available filters
    filters = tool.get_available_filters()

    # Sidebar for filters
    st.sidebar.header("🎯 Define Your Practice Profile")

    # Specialty filter
    specialty_options = ["All"] + filters["specialties"]
    selected_specialty = st.sidebar.selectbox(
        "Practice Specialty",
        specialty_options,
        help="Select your primary specialty for comparison",
    )

    # State filter
    state_options = ["All"] + filters["states"]
    selected_state = st.sidebar.selectbox(
        "Geographic Location (State)",
        state_options,
        help="Select your state for geographic comparison",
    )

    # Practice size filter
    size_options = ["All"] + filters["practice_sizes"]
    selected_size = st.sidebar.selectbox(
        "Practice Size", size_options, help="Select your practice size category"
    )

    # Service codes filter (optional)
    st.sidebar.subheader("🔍 Focus on Specific Procedures (Optional)")
    top_codes = filters["top_service_codes"][:10]  # Top 10 most common
    selected_codes = st.sidebar.multiselect(
        "Service Codes to Analyze",
        top_codes,
        help="Leave empty to analyze all procedures",
    )

    # Practice name
    practice_name = st.sidebar.text_input(
        "Practice Name (Optional)",
        value="Your Practice",
        help="Enter your practice name for the report",
    )

    # Run Analysis button
    if st.sidebar.button("🚀 Run Benchmarking Analysis", type="primary"):

        # Create filters
        provider_filters = BenchmarkFilters(
            specialty=selected_specialty if selected_specialty != "All" else None,
            state=selected_state if selected_state != "All" else None,
            practice_size=selected_size if selected_size != "All" else None,
            service_codes=selected_codes if selected_codes else None,
        )

        # Run analysis
        with st.spinner("Analyzing your performance against peers..."):
            try:
                results = tool.benchmark_analysis(provider_filters)
                provider_metrics = results["provider"]
                peer_metrics = results["peer_group"]

                # Check if we have data
                if provider_metrics.total_disputes == 0:
                    st.error(
                        "No data found matching your criteria. Please adjust your filters."
                    )
                    return

                # Store results in session state
                st.session_state.results = results
                st.session_state.practice_name = practice_name
                st.session_state.filters_applied = {
                    "specialty": selected_specialty,
                    "state": selected_state,
                    "size": selected_size,
                    "codes": selected_codes,
                }

            except Exception as e:
                st.error(f"Error running analysis: {e}")
                return

    # Display results if available
    if "results" in st.session_state:
        results = st.session_state.results
        provider_metrics = results["provider"]
        peer_metrics = results["peer_group"]
        practice_name = st.session_state.practice_name
        filters_applied = st.session_state.filters_applied

        # Summary metrics
        st.subheader("📊 Performance Summary")

        col1, col2, col3, col4 = st.columns(4)

        with col1:
            st.metric(
                "Your Win Rate",
                f"{provider_metrics.provider_win_rate:.1f}%",
                f"{provider_metrics.provider_win_rate - peer_metrics.provider_win_rate:+.1f}pp vs peers",
            )

        with col2:
            if not np.isnan(provider_metrics.avg_provider_offer_pct):
                st.metric(
                    "Avg Provider Offer",
                    f"{provider_metrics.avg_provider_offer_pct:.0f}% QPA",
                    (
                        f"{provider_metrics.avg_provider_offer_pct - peer_metrics.avg_provider_offer_pct:+.0f}pp vs peers"
                        if not np.isnan(peer_metrics.avg_provider_offer_pct)
                        else None
                    ),
                )
            else:
                st.metric("Avg Provider Offer", "N/A", "Data not available")

        with col3:
            if not np.isnan(provider_metrics.median_time_to_resolution):
                st.metric(
                    "Resolution Time",
                    f"{provider_metrics.median_time_to_resolution:.0f} days",
                    (
                        f"{provider_metrics.median_time_to_resolution - peer_metrics.median_time_to_resolution:+.0f} days vs peers"
                        if not np.isnan(peer_metrics.median_time_to_resolution)
                        else None
                    ),
                )
            else:
                st.metric("Resolution Time", "N/A", "Data not available")

        with col4:
            st.metric(
                "Total Disputes",
                f"{provider_metrics.total_disputes:,}",
                f"vs {peer_metrics.total_disputes:,} peer total",
            )

        # Visualization
        st.subheader("📈 Performance Comparison")
        fig = create_comparison_chart(provider_metrics, peer_metrics)
        st.plotly_chart(fig, use_container_width=True)

        # Insights
        st.subheader("💡 Key Insights & Recommendations")
        insights = generate_insights(provider_metrics, peer_metrics)

        for insight in insights:
            if insight["type"] == "success":
                st.markdown(
                    f"""
                <div class="success-box">
                    <strong>{insight['title']}</strong><br>
                    {insight['message']}
                </div>
                """,
                    unsafe_allow_html=True,
                )
            elif insight["type"] == "warning":
                st.markdown(
                    f"""
                <div class="warning-box">
                    <strong>{insight['title']}</strong><br>
                    {insight['message']}
                </div>
                """,
                    unsafe_allow_html=True,
                )
            else:
                st.markdown(
                    f"""
                <div class="insight-box">
                    <strong>{insight['title']}</strong><br>
                    {insight['message']}
                </div>
                """,
                    unsafe_allow_html=True,
                )

        # Detailed Report
        with st.expander("📋 Detailed Benchmarking Report"):
            report = tool.generate_report(results, practice_name)
            st.text(report)

        # Applied Filters Summary
        st.subheader("🎯 Analysis Parameters")
        col1, col2 = st.columns(2)

        with col1:
            st.write("**Your Practice Profile:**")
            st.write(f"• Specialty: {filters_applied['specialty']}")
            st.write(f"• Location: {filters_applied['state']}")
            st.write(f"• Size: {filters_applied['size']}")
            if filters_applied["codes"]:
                st.write(
                    f"• Service Codes: {', '.join(filters_applied['codes'][:5])}{' ...' if len(filters_applied['codes']) > 5 else ''}"
                )

        with col2:
            st.write("**Peer Comparison Group:**")
            st.write(f"• Same specialty: {filters_applied['specialty']}")
            st.write(f"• All locations (broader scope)")
            st.write(f"• All practice sizes")
            st.write(f"• Total peer disputes: {peer_metrics.total_disputes:,}")

    else:
        # Initial state - show value proposition
        st.info(
            """
        **👋 Welcome to the IDR Benchmarking Tool**
        
        We've been studying IDR outcomes and have identified patterns in why some groups lose or waste money in arbitration. 
        This tool helps you:
        
        • **Compare your win rates** against similar providers in your specialty and region
        • **Identify opportunities** where you may be leaving money on the table  
        • **Optimize your strategy** by understanding what works for high-performing peers
        • **Make data-driven decisions** about which claims are worth pursuing
        
        **Get started by selecting your practice profile in the sidebar →**
        """
        )

        # Show some high-level statistics
        st.subheader("📊 Q4 2024 IDR Market Overview")

        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric("Total Disputes", "947,215")
        with col2:
            st.metric("Provider Win Rate", "86.2%")
        with col3:
            st.metric("Top Specialty", "Radiology (26.5%)")


if __name__ == "__main__":
    main()
