#!/usr/bin/env node

/**
 * Test script to verify the complete badge system workflow
 * Tests badge service functionality end-to-end
 */

const { badgeService } = require('./src/services/badge-service');

async function testBadgeWorkflow() {
  console.log('🏷️  Testing Badge System Workflow\n');

  // Test entities
  const testEntities = [
    { id: '139', name: 'Manchester United' },  // Has S3 badge
    { id: '126', name: 'Arsenal' },             // Just added S3 badge
    { id: '131', name: 'Chelsea' },             // Just added S3 badge
    { id: '137', name: 'Liverpool' },           // Just added S3 badge
    { id: '148', name: 'Sunderland' },          // No S3 badge (fallback test)
  ];

  console.log('📊 Testing Badge Service:\n');

  for (const entity of testEntities) {
    console.log(`\n🔍 Testing: ${entity.name} (ID: ${entity.id})`);
    
    try {
      // Get badge mapping
      const mapping = await badgeService.getBadgeForEntity(entity.id, entity.name);
      
      if (mapping) {
        console.log(`✅ Badge mapping found:`);
        console.log(`   Entity: ${mapping.entityName}`);
        console.log(`   Badge Path: ${mapping.badgePath}`);
        console.log(`   S3 URL: ${mapping.s3Url || 'None'}`);
        console.log(`   Source: ${mapping.source}`);
        
        // Get badge URL with fallback
        const badgeUrl = badgeService.getBadgeUrl(mapping);
        console.log(`   Final URL: ${badgeUrl}`);
        
        // Test URL accessibility
        try {
          const response = await fetch(badgeUrl, { method: 'HEAD' });
          console.log(`   Status: ${response.ok ? '✅ Accessible' : '❌ Not accessible'} (${response.status})`);
        } catch (error) {
          console.log(`   Status: ❌ Error accessing badge: ${error.message}`);
        }
      } else {
        console.log(`❌ No badge mapping found`);
      }
    } catch (error) {
      console.error(`❌ Error testing ${entity.name}:`, error.message);
    }
  }

  console.log('\n📈 Badge Service Statistics:');
  const allMappings = badgeService.getAllMappings();
  console.log(`   Total mappings: ${allMappings.length}`);
  
  const sourceCounts = {};
  allMappings.forEach(m => {
    sourceCounts[m.source] = (sourceCounts[m.source] || 0) + 1;
  });
  
  Object.entries(sourceCounts).forEach(([source, count]) => {
    console.log(`   ${source}: ${count} badges`);
  });

  console.log('\n🎉 Badge workflow test completed!');
}

// Run the test
testBadgeWorkflow().catch(console.error);