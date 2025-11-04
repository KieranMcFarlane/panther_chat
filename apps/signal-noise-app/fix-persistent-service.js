// Fix for Persistent RFP Service - Set correct entity count
// Run this in browser console on http://localhost:3005/persistent-rfp-intelligence

console.log('🔧 Fixing Persistent RFP Service...');

// Clear corrupted session data
localStorage.removeItem('rfp-intelligence-session');

// Set the correct entity count manually
const correctData = {
  progress: {
    sessionId: '',
    totalEntities: 1478, // Actual count from Neo4j
    processedEntities: 0,
    status: 'idle',
    lastActivity: Date.now(),
    entities: [],
    results: [],
    errors: []
  },
  connectionState: {
    eventSource: null,
    retryCount: 0,
    lastReconnectAttempt: 0,
    isManualPause: false
  }
};

localStorage.setItem('rfp-intelligence-session', JSON.stringify(correctData));

console.log('✅ Fixed session data with 1,478 entities');
console.log('📊 Now refresh the page to see correct entity count');

// After refresh, you should see:
// Total Entities: 1478
// Processed: 0
// Progress: 0%
// Processing Rate: 0 entities/min

// Then click "🚀 Start" to begin real processing