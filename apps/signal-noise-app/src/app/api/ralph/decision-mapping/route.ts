/**
 * Decision Mapping API Endpoint
 *
 * Explains the mapping between internal decision codes and
 * external customer-facing names.
 *
 * Rationale: Internal code names (like WEAK_ACCEPT) can sound negative
 * to customers. External names (like CAPABILITY_SIGNAL) accurately reflect
 * what the decision means without implying weakness.
 */

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    return NextResponse.json({
      mapping: {
        // Internal Code → External Display
        ACCEPT: {
          external_name: "PROCUREMENT_SIGNAL",
          display_name: "Procurement Signal",
          description: "Strong evidence of future procurement action detected",
          icon: "🎯",
          confidence_impact: "+0.06 raw delta",
          sales_readiness: "High - immediate sales engagement recommended",
          examples: [
            "Active RFP or tender participation",
            "Job postings for vendor evaluation roles",
            "Budget allocation for new technology",
            "Executive mentions of procurement plans"
          ]
        },
        WEAK_ACCEPT: {
          external_name: "CAPABILITY_SIGNAL",
          display_name: "Capability Signal",
          description: "Digital capability present but procurement intent unclear",
          icon: "💡",
          confidence_impact: "+0.02 raw delta (diminishing with repetition)",
          sales_readiness: "Medium - monitor for procurement signals",
          examples: [
            "Modern technology stack present",
            "Digital transformation initiatives",
            "Active social media presence",
            "Industry awards or recognition"
          ],
          note: "Repeated CAPABILITY_SIGNALS in same category have diminishing impact"
        },
        REJECT: {
          external_name: "NO_SIGNAL",
          display_name: "No Signal",
          description: "No evidence of procurement capability or contradicts hypothesis",
          icon: "❌",
          confidence_impact: "0.00 (no change)",
          sales_readiness: "None - entity not qualified",
          examples: [
            "No digital presence",
            "Outdated technology or infrastructure",
            "Evidence contradicting procurement hypothesis",
            "Recently renewed long-term contracts"
          ]
        },
        NO_PROGRESS: {
          external_name: "NO_SIGNAL",
          display_name: "No Signal",
          description: "Evidence exists but adds no new predictive information",
          icon: "➡️",
          confidence_impact: "0.00 (no change)",
          sales_readiness: "None - no new information",
          examples: [
            "Repeated CAPABILITY_SIGNAL without procurement intent",
            "Generic information already known",
            "Duplicate or redundant evidence"
          ]
        },
        SATURATED: {
          external_name: "SATURATED",
          display_name: "Saturated",
          description: "Category exhausted, no new information expected",
          icon: "🔄",
          confidence_impact: "0.00 (no change)",
          sales_readiness: "N/A - optimization signal",
          examples: [
            "Multiple iterations with same result",
            "Category saturation score >0.80",
            "No new evidence sources available"
          ],
          note: "This is an optimization signal, not a qualification signal"
        }
      },
      rationale: {
        why_rename: {
          title: "Why rename WEAK_ACCEPT to CAPABILITY_SIGNAL?",
          explanation: [
            "'Weak' sounds negative to customers and implies poor signal quality",
            "'Capability' accurately reflects that the entity has digital maturity",
            "The distinction is: CAPABILITY = has tech, PROCUREMENT_SIGNAL = buying tech",
            "Sales team needs to know: Capability ≠ Procurement Intent"
          ]
        },
        sales_impact: {
          title: "Impact on Sales Communication",
          points: [
            "Use 'Procurement Signal' for high-confidence opportunities",
            "Use 'Capability Signal' for monitoring/watchlist entities",
            "Avoid 'Weak' in customer communication - use 'Capability' instead",
            "Explain that high CONFIDENCE + ACTIONABLE gate = sales-ready"
          ]
        }
      },
      metadata: {
        version: "1.0.0",
        last_updated: new Date().toISOString(),
        note: "Internal code names (ACCEPT, WEAK_ACCEPT, etc.) remain unchanged in the codebase. Only external API responses and documentation use the renamed versions."
      }
    });
  } catch (error) {
    console.error('Error in decision-mapping API:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve decision mapping' },
      { status: 500 }
    );
  }
}
