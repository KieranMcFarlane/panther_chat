/**
 * Test Script for Keyword Mines System
 * 
 * This script tests the complete workflow:
 * 1. Initializes mines
 * 2. Sends sample webhook data
 * 3. Checks for detections
 * 4. Verifies notifications
 */

const API_BASE = 'http://localhost:3005';

async function testKeywordMines() {
  console.log('🚀 Testing Keyword Mines System...\n');

  try {
    // Step 1: Check system status
    console.log('📊 Checking system status...');
    const reasoningStatus = await fetch(`${API_BASE}/api/reasoning/service`);
    const statusData = await reasoningStatus.json();
    console.log('Reasoning Service:', statusData.service?.is_running ? '✅ Running' : '❌ Stopped');

    // Step 2: Initialize mines if needed
    console.log('\n🎯 Initializing keyword mines...');
    const minesResponse = await fetch(`${API_BASE}/api/mines/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'initialize_all' })
    });
    const minesData = await minesResponse.json();
    console.log('Mines Result:', minesData.status || minesData.error);

    // Step 3: Start reasoning service
    console.log('\n🧠 Starting AI reasoning service...');
    const reasoningStart = await fetch(`${API_BASE}/api/reasoning/service`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start' })
    });
    const startData = await reasoningStart.json();
    console.log('Reasoning Start:', startData.status || startData.error);

    // Step 4: Send sample webhook data
    console.log('\n📡 Sending sample webhook data...');
    const sampleWebhooks = [
      {
        source: 'linkedin',
        content: 'Premier League seeking digital transformation partner for fan engagement platform modernization and data analytics integration',
        url: 'https://linkedin.com/news/premier-league-digital',
        keywords: ['premier league', 'digital transformation', 'fan engagement', 'data analytics'],
        timestamp: new Date().toISOString()
      },
      {
        source: 'news',
        content: 'Chelsea FC announces major CRM system upgrade, looking for technology vendors with sports industry experience',
        url: 'https://news.com/chelsea-crm-upgrade',
        keywords: ['chelsea', 'crm system', 'technology vendors', 'sports industry'],
        timestamp: new Date().toISOString()
      },
      {
        source: 'procurement',
        content: 'Manchester United tender: Mobile app development for ticketing and fan loyalty program with integrated payment processing',
        url: 'https://procurement.com/manutd-tender',
        keywords: ['manchester united', 'mobile app', 'ticketing', 'fan loyalty', 'payment processing'],
        timestamp: new Date().toISOString()
      }
    ];

    for (const webhook of sampleWebhooks) {
      const webhookResponse = await fetch(`${API_BASE}/api/mines/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhook)
      });
      const webhookResult = await webhookResponse.json();
      console.log(`Webhook (${webhook.source}):`, webhookResult.status || webhookResult.error);
      
      // Wait a moment between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Step 5: Wait for processing
    console.log('\n⏳ Waiting for AI processing...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 6: Check for detections
    console.log('\n🔍 Checking for detections...');
    const detectionsResponse = await fetch(`${API_BASE}/api/mines/detections?limit=10&hours=1`);
    const detectionsData = await detectionsResponse.json();
    console.log(`Found ${detectionsData.detections?.length || 0} recent detections:`);
    
    if (detectionsData.detections?.length > 0) {
      detectionsData.detections.forEach((detection, index) => {
        console.log(`  ${index + 1}. ${detection.entity_name} (${detection.confidence_score}/100) - ${detection.detection_type}`);
      });
    }

    // Step 7: Check activity feed
    console.log('\n📋 Checking activity feed...');
    const activityResponse = await fetch(`${API_BASE}/api/logs/activity?limit=10&hours=1`);
    const activityData = await activityResponse.json();
    console.log(`Found ${activityData.activities?.length || 0} recent activities:`);
    
    if (activityData.activities?.length > 0) {
      activityData.activities.forEach((activity, index) => {
        console.log(`  ${index + 1}. [${activity.type.toUpperCase()}] ${activity.title}`);
      });
    }

    // Step 8: Check PWA notifications
    console.log('\n🔔 Checking PWA notifications...');
    const notificationsResponse = await fetch(`${API_BASE}/api/notifications/send?limit=10`);
    const notificationsData = await notificationsResponse.json();
    console.log(`Found ${notificationsData.notifications?.length || 0} notifications`);

    console.log('\n✅ Test completed! Check your dashboard at http://localhost:3005/rfp-intelligence');
    console.log('💡 You should now see real data in the Live Activity and Recent Detections tabs.\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure your Next.js app is running on port 3005');
    console.log('2. Check that environment variables are configured');
    console.log('3. Verify Supabase schema has been created');
    console.log('4. Check browser console for detailed error messages');
  }
}

// Run the test
testKeywordMines();