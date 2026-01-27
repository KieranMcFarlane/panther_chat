/**
 * 🔄 Ralph Loop Client for Node.js
 *
 * Client for submitting raw signals to Ralph Loop validation from Node.js scrapers
 *
 * Usage:
 *   const { validateSignalViaRalphLoop, convertBrightDataToSignal } = require('./src/lib/ralph-loop-node-client');
 *
 *   const rawSignal = convertBrightDataToSignal(brightDataResult, entityName);
 *   const result = await validateSignalViaRalphLoop(rawSignal);
 *   console.log(`Validated: ${result.validated_signals}, Rejected: ${result.rejected_signals}`);
 */

const RALPH_LOOP_API = process.env.RALPH_LOOP_API_URL || 'http://localhost:8001';

/**
 * Validate raw signal through Ralph Loop
 * @param {Object} rawSignal - Raw signal from BrightData scraper
 * @returns {Promise<Object>} - Validation result from Ralph Loop
 */
async function validateSignalViaRalphLoop(rawSignal) {
  const response = await fetch(`${RALPH_LOOP_API}/api/signals/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([rawSignal])
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ralph Loop validation failed: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  return result;
}

/**
 * Convert BrightData RFP result to Ralph Loop signal format
 * @param {Object} brightDataResult - RFP detection result from BrightData
 * @param {string} entityName - Entity name
 * @returns {Object} - Raw signal in Ralph Loop format
 */
function convertBrightDataToSignal(brightDataResult, entityName) {
  return {
    entity_id: entityName.toLowerCase().replace(/\s+/g, '-'),
    signal_type: 'RFP_DETECTED',
    confidence: brightDataResult.confidence || 0.85,
    evidence: [
      {
        source: 'BrightData',
        credibility_score: 0.8,
        url: brightDataResult.url,
        extracted_text: brightDataResult.description,
        date: new Date().toISOString()
      },
      {
        source: 'BrightData Search',
        credibility_score: 0.7,
        metadata: { search_query: brightDataResult.searchQuery }
      },
      {
        source: 'URL Validation',
        credibility_score: 0.9,
        metadata: { url_valid: brightDataResult.urlValid }
      }
    ],
    metadata: {
      rfp_type: brightDataResult.rfpType,
      fit_score: brightDataResult.fitScore,
      detection_strategy: 'brightdata',
      first_seen: new Date().toISOString(),
      title: brightDataResult.title,
      source_link: brightDataResult.url
    }
  };
}

module.exports = {
  validateSignalViaRalphLoop,
  convertBrightDataToSignal
};
