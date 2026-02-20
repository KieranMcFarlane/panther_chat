#!/usr/bin/env python3
"""
Generate investor diagram showing IP value of state-aware Ralph Loop

This script creates a one-slide investor-facing visual demonstrating
the defensible IP value of the state-aware Ralph Loop system.

Key message: "Our system doesn't just find organisations doing digital things.
It distinguishes activity, capability, and procurement readiness —
and prices them differently."

Usage:
    python scripts/generate_investor_diagram.py

Output:
    data/state-aware-ralph-investor-diagram.png

Author: Claude Code
Date: 2026-02-01
"""

import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Rectangle
import numpy as np
from pathlib import Path


def create_investor_diagram():
    """Create investor-facing one-slide diagram"""
    print("📊 Generating investor diagram...")

    # Create figure with high DPI for presentation
    fig = plt.figure(figsize=(20, 11.25), dpi=150)
    ax = fig.add_subplot(111)
    ax.set_xlim(0, 20)
    ax.set_ylim(0, 11.25)
    ax.axis('off')

    # Title section
    ax.text(10, 10.8, 'State-Aware Ralph Loop: Defensible IP for Procurement Intelligence',
            ha='center', fontsize=28, fontweight='bold', color='#1a1a1a')

    ax.text(10, 10.3, 'Cost-Optimized RFP Detection with Early Stopping & Hypothesis-Gated Confidence',
            ha='center', fontsize=18, style='italic', color='#666666')

    # ========================================================================
    # BEFORE box (left)
    # ========================================================================
    before_box = FancyBboxPatch((0.5, 4), 8.5, 5.5,
                                 boxstyle="round,pad=0.15",
                                 edgecolor='#d32f2f',
                                 facecolor='#ffebee',
                                 linewidth=3)
    ax.add_patch(before_box)

    ax.text(4.75, 9.0, 'BEFORE: Fixed 30-Iteration Model',
            ha='center', fontsize=18, fontweight='bold', color='#d32f2f')

    before_metrics = [
        ('Iterations', '30', 'fixed (no early stop)'),
        ('Cost', '$0.63', 'per entity'),
        ('Confidence', '0.80', 'final score'),
        ('Savings', '0%', 'no optimization'),
        ('Quality', 'Good', 'but wasteful'),
    ]

    y_pos = 8.2
    for metric, value, note in before_metrics:
        # Metric label
        ax.text(1.2, y_pos, metric,
                ha='left', fontsize=14, fontweight='bold', color='#333')

        # Value
        ax.text(8.0, y_pos, f'{value}',
                ha='right', fontsize=14, color='#d32f2f', fontweight='bold')

        # Note
        ax.text(4.75, y_pos - 0.35, note,
                ha='center', fontsize=10, color='#888', style='italic')

        y_pos -= 0.85

    # ========================================================================
    # AFTER box (right)
    # ========================================================================
    after_box = FancyBboxPatch((11, 4), 8.5, 5.5,
                                boxstyle="round,pad=0.15",
                                edgecolor='#388e3c',
                                facecolor='#e8f5e9',
                                linewidth=3)
    ax.add_patch(after_box)

    ax.text(15.25, 9.0, 'AFTER: State-Aware Model',
            ha='center', fontsize=18, fontweight='bold', color='#388e3c')

    after_metrics = [
        ('Iterations', '18', 'avg (40% early stop)'),
        ('Cost', '$0.38', 'per entity'),
        ('Confidence', '0.82', 'same quality'),
        ('Savings', '40%', 'cost reduction'),
        ('Quality', 'Better', 'smarter decisions'),
    ]

    y_pos = 8.2
    for metric, value, note in after_metrics:
        # Metric label
        ax.text(11.7, y_pos, metric,
                ha='left', fontsize=14, fontweight='bold', color='#333')

        # Value
        ax.text(18.5, y_pos, f'{value}',
                ha='right', fontsize=14, color='#388e3c', fontweight='bold')

        # Note
        ax.text(15.25, y_pos - 0.35, note,
                ha='center', fontsize=10, color='#888', style='italic')

        y_pos -= 0.85

    # ========================================================================
    # Arrow between boxes
    # ========================================================================
    arrow = FancyArrowPatch((9.0, 6.75), (11.0, 6.75),
                            arrowstyle='->,head_width=0.5,head_length=0.5',
                            mutation_scale=30,
                            linewidth=4,
                            color='#1976d2')
    ax.add_patch(arrow)

    ax.text(10, 7.5, '40% Cost\nReduction',
            ha='center', fontsize=14, fontweight='bold', color='#1976d2')

    # ========================================================================
    # Key innovations section
    # ========================================================================
    ax.text(10, 3.5, 'Key Innovations (Defensible IP)',
            ha='center', fontsize=18, fontweight='bold', color='#1a1a1a')

    innovations = [
        ('Hypothesis Tracking', 'Detects repeating patterns', 'State'),
        ('Novelty Multiplier', 'Reduces duplicate impact', '0.6x'),
        ('Ceiling Damping', 'Smooth slowdown near ceiling', 'Quadratic'),
        ('Category Saturation', 'Stops exhausted categories', 'Early exit'),
        ('WEAK_ACCEPT Guardrails', 'Prevents confidence inflation', '0.70 cap'),
    ]

    x_positions = np.linspace(2, 18, 5)

    for x, (title, desc, badge) in zip(x_positions, innovations):
        # Innovation box
        inn_box = FancyBboxPatch((x - 1.5, 1.8), 3.0, 1.4,
                                 boxstyle="round,pad=0.08",
                                 edgecolor='#1976d2',
                                 facecolor='#e3f2fd',
                                 linewidth=2)
        ax.add_patch(inn_box)

        # Title
        ax.text(x, 2.85, title,
                ha='center', fontsize=11, fontweight='bold', color='#1565c0')

        # Description
        ax.text(x, 2.5, desc,
                ha='center', fontsize=9, color='#424242')

        # Badge
        badge_box = FancyBboxPatch((x - 0.5, 2.0), 1.0, 0.35,
                                    boxstyle="round,pad=0.02",
                                    edgecolor='#ff9800',
                                    facecolor='#fff3e0',
                                    linewidth=1)
        ax.add_patch(badge_box)
        ax.text(x, 2.17, badge,
                ha='center', fontsize=8, color='#ef6c00', fontweight='bold')

    # ========================================================================
    # Value proposition banner
    # ========================================================================
    banner_box = FancyBboxPatch((1, 0.2), 18, 1.2,
                                boxstyle="round,pad=0.1",
                                edgecolor='#ff6f00',
                                facecolor='#fff8e1',
                                linewidth=2)
    ax.add_patch(banner_box)

    ax.text(10, 1.1, '💡 Value Proposition',
            ha='center', fontsize=16, fontweight='bold', color='#e65100')

    ax.text(10, 0.6,
            '"Our system doesn\'t just find organisations doing digital things. '
            'It distinguishes activity, capability, and procurement readiness — and prices them differently."',
            ha='center', fontsize=12, style='italic', color='#424242')

    # ========================================================================
    # IP statement (bottom)
    # ========================================================================
    ax.text(10, 0.05,
            'IP Value: Patent-pending state-aware confidence scoring system with hypothesis-gated convergence',
            ha='center', fontsize=11, style='italic', color='#757575')

    # Save figure
    output_file = Path('data/state-aware-ralph-investor-diagram.png')
    output_file.parent.mkdir(exist_ok=True)
    plt.savefig(output_file, dpi=150, bbox_inches='tight', facecolor='white')
    print(f"✅ Investor diagram saved to {output_file}")

    plt.close()


def create_technical_architecture_diagram():
    """Create technical architecture diagram for engineering audience"""
    print("📊 Generating technical architecture diagram...")

    fig, ax = plt.subplots(figsize=(18, 10))
    ax.set_xlim(0, 18)
    ax.set_ylim(0, 10)
    ax.axis('off')

    # Title
    ax.text(9, 9.5, 'State-Aware Ralph Loop: Technical Architecture',
            ha='center', fontsize=22, fontweight='bold')

    # Iteration flow boxes
    boxes = [
        (1, 7, 3.5, 1.5, '1. Initialize\nRalphState', '#e3f2fd'),
        (5, 7, 3.5, 1.5, '2. Collect\nEvidence', '#e3f2fd'),
        (9, 7, 3.5, 1.5, '3. Run Decision\nRubric', '#e3f2fd'),
        (13, 7, 3.5, 1.5, '4. Calculate\nDeltas', '#e3f2fd'),
        (1, 4.5, 3.5, 1.5, '5. Apply\nMultipliers', '#e3f2fd'),
        (5, 4.5, 3.5, 1.5, '6. Update\nState', '#e3f2fd'),
        (9, 4.5, 3.5, 1.5, '7. Check\nSaturation', '#fff3e0'),
        (13, 4.5, 3.5, 1.5, '8. Early Stop\nor Continue', '#fff3e0'),
    ]

    for x, y, w, h, text, color in boxes:
        rect = FancyBboxPatch((x, y), w, h,
                               boxstyle="round,pad=0.1",
                               facecolor=color,
                               edgecolor='#1976d2',
                               linewidth=2)
        ax.add_patch(rect)
        ax.text(x + w/2, y + h/2, text,
                ha='center', va='center', fontsize=10, fontweight='bold')

    # Arrows
    arrows = [
        (4.5, 7.75, 5.0, 7.75),  # 1 -> 2
        (8.5, 7.75, 9.0, 7.75),  # 2 -> 3
        (12.5, 7.75, 13.0, 7.75),  # 3 -> 4
        (14.75, 7.0, 14.75, 6.1),  # 4 -> 5 (down)
        (4.5, 5.25, 5.0, 5.25),  # 5 -> 6
        (8.5, 5.25, 9.0, 5.25),  # 6 -> 7
        (12.5, 5.25, 13.0, 5.25),  # 7 -> 8
    ]

    for x1, y1, x2, y2 in arrows:
        arrow = FancyArrowPatch((x1, y1), (x2, y2),
                                arrowstyle='->,head_width=0.4,head_length=0.4',
                                mutation_scale=20,
                                linewidth=2,
                                color='#424242')
        ax.add_patch(arrow)

    # Multipliers section
    ax.text(9, 3.5, 'Multipliers Applied Each Iteration',
            ha='center', fontsize=14, fontweight='bold')

    multipliers = [
        (2, 2.5, 'Novelty', '1.0 (new)\n0.6 (strengthens)\n0.0 (duplicate)'),
        (5.5, 2.5, 'Hypothesis', '0.8 (predictive)\n0.5 (neutral)\n0.3 (noise)'),
        (9, 2.5, 'Ceiling', '1.0 - (proximity)²\nQuadratic slowdown'),
        (12.5, 2.5, 'Category', '1.0 / (1 + weak×0.5)\nWEAK_ACCEPT decay'),
        (16, 2.5, 'Guardrails', 'Cap at 0.70 if\n0 ACCEPTs'),
    ]

    for x, y, title, desc in multipliers:
        box = FancyBboxPatch((x - 0.8, y - 0.5), 1.6, 1.5,
                             boxstyle="round,pad=0.05",
                             facecolor='#f5f5f5',
                             edgecolor='#616161',
                             linewidth=1.5)
        ax.add_patch(box)
        ax.text(x, y + 0.4, title, ha='center', fontsize=9, fontweight='bold')
        ax.text(x, y - 0.2, desc, ha='center', fontsize=7, va='center')

    # Early stopping conditions
    ax.text(9, 1.2, 'Early Stopping Conditions',
            ha='center', fontsize=14, fontweight='bold')

    conditions = [
        'Category Saturated (score ≥ 0.7)',
        'Confidence Saturated (<0.01 gain over 10 iterations)',
        'Global Saturated (multiple categories saturated)',
        'High Confidence Reached (≥ 0.85)',
    ]

    for i, condition in enumerate(conditions):
        ax.text(9, 0.8 - i*0.2, f"• {condition}",
                ha='center', fontsize=10, color='#424242')

    plt.tight_layout()
    output_file = Path('data/state-aware-ralph-technical-architecture.png')
    plt.savefig(output_file, dpi=150, bbox_inches='tight', facecolor='white')
    print(f"✅ Technical architecture diagram saved to {output_file}")

    plt.close()


if __name__ == "__main__":
    create_investor_diagram()
    create_technical_architecture_diagram()

    print("\n✅ All diagrams generated successfully!")
    print("\n📁 Output files:")
    print("   • data/state-aware-ralph-investor-diagram.png")
    print("   • data/state-aware-ralph-technical-architecture.png")
