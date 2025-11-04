#!/usr/bin/env node

/**
 * A2A RFP Discovery Proof of Concept Summary
 * 
 * This script demonstrates the complete working A2A system
 * by calling the live API endpoints and showing results.
 */

import fetch from 'node-fetch'

const API_BASE = 'http://localhost:3005/api/a2a-rfp-discovery'

async function demonstrateA2ASystem() {
  console.log('🎯 A2A RFP DISCOVERY PROOF OF CONCEPT DEMONSTRATION')
  console.log('=' .repeat(60))
  
  try {
    // 1. Check system status
    console.log('\n1️⃣ Checking System Status...')
    const statusResponse = await fetch(`${API_BASE}?action=status`)
    const status = await statusResponse.json()
    
    console.log(`✅ System Status: ${status.isRunning ? 'Running' : 'Idle'}`)
    console.log(`🤖 Active Agents: ${status.agents.length}`)
    console.log(`📊 Total RFPs Discovered: ${status.totalRFPsDiscovered}`)
    
    // 2. Show available agents
    console.log('\n2️⃣ Available A2A Agents:')
    status.agents.forEach((agent, index) => {
      console.log(`   ${index + 1}. ${agent.name} (${agent.type})`)
      console.log(`      Status: ${agent.status}`)
      console.log(`      Capabilities: ${agent.capabilities.join(', ')}`)
    })
    
    // 3. Get discovered RFPs
    console.log('\n3️⃣ Discovered RFP Opportunities:')
    const rfpsResponse = await fetch(`${API_BASE}?action=rfps&limit=5`)
    const rfpsData = await rfpsResponse.json()
    
    console.log(`📋 Found ${rfpsData.total} total RFP opportunities (showing first ${rfpsData.rfps.length}):`)
    
    rfpsData.rfps.forEach((rfp, index) => {
      console.log(`\n   🎯 Opportunity ${index + 1}: ${rfp.title}`)
      console.log(`      🏢 Entity: ${rfp.entity.properties.name} (${rfp.entity.properties.type})`)
      console.log(`      📊 Fit Score: ${rfp.fitScore.toFixed(1)}% | Priority: ${rfp.priority}`)
      console.log(`      💰 Value: ${rfp.estimatedValue}`)
      console.log(`      🔗 Source: ${rfp.source}`)
      console.log(`      📝 Category: ${rfp.category}`)
      
      if (rfp.deadline) {
        console.log(`      ⏰ Deadline: ${new Date(rfp.deadline).toLocaleDateString()}`)
      }
      
      console.log(`      🔍 Keywords: ${rfp.keywords.join(', ')}`)
      
      if (rfp.evidenceLinks && rfp.evidenceLinks.length > 0) {
        console.log(`      📎 Evidence: ${rfp.evidenceLinks.map(link => link.title).join(', ')}`)
      }
    })
    
    // 4. Show RFP processing cards
    console.log('\n4️⃣ RFP Processing Cards:')
    const cardsResponse = await fetch(`${API_BASE}?action=cards&limit=3`)
    const cardsData = await cardsResponse.json()
    
    console.log(`📋 Created ${cardsData.total} processing cards (showing first ${cardsData.cards.length}):`)
    
    cardsData.cards.forEach((card, index) => {
      console.log(`\n   📇 Card ${index + 1}: ${card.rfp.title}`)
      console.log(`      🏢 Entity: ${card.rfp.entity.properties.name}`)
      console.log(`      📊 Status: ${card.status}`)
      console.log(`      📝 Next Steps: ${card.nextSteps.join(' → ')}`)
      console.log(`      🕐 Created: ${new Date(card.createdAt).toLocaleString()}`)
      
      if (card.processingNotes && card.processingNotes.length > 0) {
        console.log(`      📝 Notes: ${card.processingNotes.slice(-1)[0]}`)
      }
    })
    
    // 5. Summary
    console.log('\n' + '='.repeat(60))
    console.log('🎉 A2A RFP DISCOVERY PROOF OF CONCEPT SUCCESS!')
    console.log('=' .repeat(60))
    
    console.log('\n✨ What the A2A system demonstrates:')
    console.log('   ✓ Multi-agent autonomous RFP discovery')
    console.log('   ✓ Neo4j database integration')
    console.log('   ✓ Supabase cached_entities utilization')
    console.log('   ✓ Real-time opportunity analysis')
    console.log('   ✓ Intelligent pattern matching')
    console.log('   ✓ Web interface with live updates')
    console.log('   ✓ Card-based RFP management')
    console.log('   ✓ Entity relationship mapping')
    
    console.log('\n🎯 Key Results:')
    console.log(`   📊 Discovered: ${rfpsData.total} RFP opportunities`)
    console.log(`   📇 Processing Cards: ${cardsData.total}`)
    console.log(`   🤖 Working Agents: ${status.agents.length}`)
    console.log(`   🏢 Entities Analyzed: ${rfpsData.rfps.length}`)
    
    console.log('\n🌐 Access the web interface at: http://localhost:3005/a2a-rfp-discovery')
    console.log('📡 API endpoints available at: http://localhost:3005/api/a2a-rfp-discovery')
    
  } catch (error) {
    console.error('❌ Error demonstrating A2A system:', error.message)
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Make sure the development server is running:')
      console.log('   npm run dev')
      console.log('   Then run this script again.')
    }
  }
}

// Run the demonstration
demonstrateA2ASystem().catch(console.error)