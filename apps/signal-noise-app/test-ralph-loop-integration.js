#!/usr/bin/env node

/**
 * Test Ralph Loop Integration
 * Verifies that BrightData signals are correctly validated through Ralph Loop
 */

const { validateSignalViaRalphLoop, convertBrightDataToSignal } = require('./src/lib/ralph-loop-node-client');

async function testRalphLoopIntegration() {
  console.log('🧪 Testing Ralph Loop Integration\n');
  console.log('═══════════════════════════════════════\n');

  // Test Case 1: Valid signal (should pass validation)
  console.log('📝 Test Case 1: Valid BrightData Signal');
  console.log('─────────────────────────────────────');

  const validBrightDataResult = {
    title: 'AC Milan - Digital Transformation RFP',
    description: 'Comprehensive request for proposal for digital transformation services including mobile application development, web platform modernization, and technology infrastructure solutions.',
    url: 'https://ac-milan.com/procurement/digital-transformation-rfp-2025.pdf',
    confidence: 0.85,
    rfpType: 'ACTIVE_RFP',
    fitScore: 85,
    searchQuery: 'AC Milan football digital transformation RFP',
    urlValid: true
  };

  const validSignal = convertBrightDataToSignal(validBrightDataResult, 'AC Milan');

  console.log('Signal converted to Ralph Loop format:');
  console.log(`  Entity ID: ${validSignal.entity_id}`);
  console.log(`  Signal Type: ${validSignal.signal_type}`);
  console.log(`  Confidence: ${validSignal.confidence}`);
  console.log(`  Evidence Items: ${validSignal.evidence.length}`);
  console.log(`  RFP Type: ${validSignal.metadata.rfp_type}`);
  console.log(`  Fit Score: ${validSignal.metadata.fit_score}\n`);

  try {
    console.log('Submitting to Ralph Loop for validation...');
    const validationResult = await validateSignalViaRalphLoop(validSignal);

    console.log('\n✅ Validation Result:');
    console.log(`  Validated Signals: ${validationResult.validated_signals}`);
    console.log(`  Rejected Signals: ${validationResult.rejected_signals}`);
    console.log(`  Validation Time: ${validationResult.validation_time_seconds.toFixed(2)}s`);

    if (validationResult.validated_signals > 0) {
      console.log('\n✅ SUCCESS: Signal passed all 3 validation passes and written to Graphiti');
      console.log(`   Validation Pass: ${validationResult.signals[0].validation_pass}/3`);
    } else {
      console.log('\n❌ FAILED: Signal was rejected by Ralph Loop');
    }
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
  }

  console.log('\n═══════════════════════════════════════\n');

  // Test Case 2: Low confidence signal (should fail validation)
  console.log('📝 Test Case 2: Low Confidence Signal (should fail)');
  console.log('─────────────────────────────────────');

  const lowConfidenceResult = {
    title: 'Some Club - Low Quality RFP',
    description: 'Poor quality RFP with insufficient details.',
    url: 'https://some-club.com/rfp.pdf',
    confidence: 0.5, // Below min_confidence=0.7 threshold
    rfpType: 'SIGNAL',
    fitScore: 30,
    searchQuery: 'some club RFP',
    urlValid: true
  };

  const lowConfidenceSignal = convertBrightDataToSignal(lowConfidenceResult, 'Some Club');

  console.log('Signal with low confidence:');
  console.log(`  Confidence: ${lowConfidenceSignal.confidence} (min required: 0.7)`);
  console.log(`  Evidence Items: ${lowConfidenceSignal.evidence.length}\n`);

  try {
    console.log('Submitting to Ralph Loop for validation...');
    const validationResult = await validateSignalViaRalphLoop(lowConfidenceSignal);

    console.log('\n✅ Validation Result:');
    console.log(`  Validated Signals: ${validationResult.validated_signals}`);
    console.log(`  Rejected Signals: ${validationResult.rejected_signals}`);

    if (validationResult.rejected_signals > 0) {
      console.log('\n✅ EXPECTED: Signal was correctly rejected (confidence < 0.7)');
    } else {
      console.log('\n⚠️  UNEXPECTED: Signal should have been rejected');
    }
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
  }

  console.log('\n═══════════════════════════════════════\n');
  console.log('✅ Integration test complete\n');
}

// Run the test
testRalphLoopIntegration().catch(console.error);
