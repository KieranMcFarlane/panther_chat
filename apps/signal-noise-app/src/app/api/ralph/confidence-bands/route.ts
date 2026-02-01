/**
 * Confidence Bands API Endpoint
 *
 * Returns business-meaningful confidence band definitions with pricing.
 * Used by sales team and customers to understand entity classification.
 *
 * Bands:
 * - EXPLORATORY: <0.30 - Research phase, no charge
 * - INFORMED: 0.30-0.60 - Monitoring mode, $500/entity/month
 * - CONFIDENT: 0.60-0.80 - Sales engaged, $2,000/entity/month
 * - ACTIONABLE: >0.80 + gate - Immediate outreach, $5,000/entity/month
 */

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    return NextResponse.json({
      bands: {
        EXPLORATORY: {
          range: "<0.30",
          meaning: "Research phase - Entity discovered but insufficient evidence",
          price: 0,
          currency: "USD",
          billing: "monthly",
          sla: "Best effort",
          sales_action: "No action - continue monitoring"
        },
        INFORMED: {
          range: "0.30-0.60",
          meaning: "Monitoring mode - Digital capability detected, procurement intent unclear",
          price: 500,
          currency: "USD",
          billing: "per entity per month",
          sla: "Standard monitoring",
          sales_action: "Add to watchlist - monthly updates"
        },
        CONFIDENT: {
          range: "0.60-0.80",
          meaning: "Sales engaged - High confidence in capability, engage sales team",
          price: 2000,
          currency: "USD",
          billing: "per entity per month",
          sla: "Priority monitoring",
          sales_action: "Sales outreach - qualify opportunity"
        },
        ACTIONABLE: {
          range: ">0.80 + guardrail",
          meaning: "Immediate outreach - Strong procurement signals across multiple categories",
          price: 5000,
          currency: "USD",
          billing: "per entity per month",
          sla: "Real-time alerts",
          sales_action: "Immediate sales contact - high probability of procurement",
          guardrail: "Requires ≥2 ACCEPTs across ≥2 categories"
        }
      },
      metadata: {
        version: "1.0.0",
        last_updated: new Date().toISOString(),
        pricing_model: "subscription",
        billing_currency: "USD",
        notes: [
          "Prices are subject to change based on volume",
          "ACTIONABLE band requires passing the actionable gate (≥2 ACCEPTs across ≥2 categories)",
          "High confidence without meeting the actionable gate remains CONFIDENT",
          "Contact sales@signalnoise.ai for enterprise pricing"
        ]
      }
    });
  } catch (error) {
    console.error('Error in confidence-bands API:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve confidence bands' },
      { status: 500 }
    );
  }
}
