/**
 * Simple Test Script - Initialize a few mines and test the system
 */

const API_BASE = 'http://localhost:3005';

async function simpleTest() {
  console.log('🚀 Simple Keyword Mines Test...\n');

  try {
    // Step 1: Check if we have any existing mines
    console.log('📊 Checking existing mines...');
    
    // Step 2: Send test webhook data to see what happens
    console.log('\n📡 Sending test webhook data...');
    const testWebhook = {
      source: 'linkedin',
      content: 'Premier League seeking digital transformation partner for fan engagement platform modernization and data analytics integration',
      url: 'https://linkedin.com/news/premier-league-digital',
      keywords: ['premier league', 'digital transformation', 'fan engagement', 'data analytics'],
      timestamp: new Date().toISOString()
    };

    const webhookResponse = await fetch(`${API_BASE}/api/mines/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testWebhook)
    });
    const webhookResult = await webhookResponse.json();
    console.log('Webhook Result:', webhookResult);

    // Step 3: Check system status
    console.log('\n🧠 Checking AI reasoning service...');
    const reasoningResponse = await fetch(`${API_BASE}/api/reasoning/service`);
    const reasoningData = await reasoningResponse.json();
    console.log('Reasoning Status:', reasoningData.service?.is_running ? '✅ Running' : '❌ Stopped');

    // Step 4: Create a manual notification to test the system
    console.log('\n🔔 Creating test notification...');
    const testNotification = {
      message: {
        title: '🚨 Test Alert: Premier League Digital Transformation',
        body: 'Detection triggered for Premier League seeking digital transformation partner',
        data: {
          entity_id: 'premier_league',
          entity_name: 'Premier League',
          urgency: 'high',
          source_url: 'https://linkedin.com/news/premier-league-digital'
        }
      },
      target_preferences: [{
        channels: [{
          type: 'pwa',
          enabled: true,
          config: { priority: 'realtime' }
        }]
      }],
      metadata: {
        entity_name: 'Premier League',
        urgency_level: 'high',
        source_type: 'linkedin',
        confidence_score: 85
      }
    };

    const notificationResponse = await fetch(`${API_BASE}/api/notifications/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testNotification)
    });
    const notificationResult = await notificationResponse.json();
    console.log('Notification Result:', notificationResult.status || notificationResult.error);

    // Step 5: Add activity manually
    console.log('\n📋 Adding test activity...');
    const testActivity = {
      type: 'detection',
      title: '🎯 Detection: Premier League',
      description: 'Digital transformation opportunity detected for Premier League',
      entity_name: 'Premier League',
      urgency: 'high',
      details: {
        source: 'linkedin',
        keywords: ['digital transformation', 'fan engagement'],
        confidence_score: 85
      },
      actions: [{
        label: 'View Details',
        action: 'view_detection',
        url: '/rfp-intelligence?entity=premier_league'
      }]
    };

    const activityResponse = await fetch(`${API_BASE}/api/logs/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testActivity)
    });
    const activityResult = await activityResponse.json();
    console.log('Activity Result:', activityResult.status || activityResult.error);

    // Step 6: Check results
    console.log('\n🔍 Checking results...');
    
    // Check activity feed
    const activityFeedResponse = await fetch(`${API_BASE}/api/logs/activity?limit=5&hours=1`);
    const activityFeed = await activityFeedResponse.json();
    console.log(`Found ${activityFeed.activities?.length || 0} activities:`);
    if (activityFeed.activities?.length > 0) {
      activityFeed.activities.forEach((activity, index) => {
        console.log(`  ${index + 1}. [${activity.type}] ${activity.title}`);
      });
    }

    // Check notifications
    const notificationsResponse = await fetch(`${API_BASE}/api/notifications/send?limit=5`);
    const notifications = await notificationsResponse.json();
    console.log(`Found ${notifications.notifications?.length || 0} notifications:`);
    if (notifications.notifications?.length > 0) {
      notifications.notifications.forEach((notif, index) => {
        console.log(`  ${index + 1}. ${notif.title}`);
      });
    }

    console.log('\n✅ Simple test completed!');
    console.log('📊 Check your dashboard at http://localhost:3005/rfp-intelligence');
    console.log('💡 You should now see test data in the Live Activity and other tabs!\n');

  } catch (error) {
    console.error('❌ Simple test failed:', error.message);
    console.log('\n🔧 Make sure your app is running on port 3005');
  }
}

// Run the test
simpleTest();