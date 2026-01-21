#!/usr/bin/env node

// Simple test script to verify LiveKit integration
console.log('🧪 Testing LiveKit Voice Integration...');

// Test 1: Check if environment variables are set
const requiredEnvVars = [
  'NEXT_PUBLIC_LIVEKIT_HOST',
  'OPENAI_API_KEY'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.log('❌ Missing environment variables:');
  missingVars.forEach(varName => {
    console.log(`   - ${varName}`);
  });
  process.exit(1);
}

console.log('✅ Environment variables configured');

// Test 2: Check if LiveKit dependencies are installed
try {
  require('livekit-client');
  require('@livekit/components-react');
  require('@livekit/agents');
  console.log('✅ LiveKit dependencies installed');
} catch (error) {
  console.log('❌ LiveKit dependencies not installed');
  console.log('Run: npm install livekit-client @livekit/components-react @livekit/agents');
  process.exit(1);
}

// Test 3: Check if VoiceChatRoom component exists
const fs = require('fs');
const componentPath = './src/components/voice/VoiceChatRoom.tsx';

if (fs.existsSync(componentPath)) {
  console.log('✅ VoiceChatRoom component exists');
} else {
  console.log('❌ VoiceChatRoom component not found');
  process.exit(1);
}

// Test 4: Check if API endpoints exist
const apiEndpoints = [
  './src/app/api/livekit/rooms/route.ts',
  './src/app/api/livekit/voice-conversation/route.ts',
  './src/app/api/livekit/agents/route.ts'
];

const missingEndpoints = apiEndpoints.filter(endpoint => !fs.existsSync(endpoint));

if (missingEndpoints.length === 0) {
  console.log('✅ All LiveKit API endpoints exist');
} else {
  console.log('❌ Missing API endpoints:');
  missingEndpoints.forEach(endpoint => {
    console.log(`   - ${endpoint}`);
  });
}

// Test 5: Check if agent files exist
const agentFiles = [
  './livekit-agents/package.json',
  './livekit-agents/agent.js',
  './livekit-agents/deploy.sh'
];

const missingAgentFiles = agentFiles.filter(file => !fs.existsSync(file));

if (missingAgentFiles.length === 0) {
  console.log('✅ All LiveKit agent files exist');
} else {
  console.log('❌ Missing agent files:');
  missingAgentFiles.forEach(file => {
    console.log(`   - ${file}`);
  });
}

console.log('\n🎉 LiveKit Voice Integration Test Complete!');
console.log('\n📋 Next Steps:');
console.log('1. Set your OPENAI_API_KEY environment variable');
console.log('2. Set your LIVEKIT_API_SECRET environment variable');
console.log('3. Start your app: npm run dev');
console.log('4. Visit: http://localhost:3005/voice-intelligence-demo');
console.log('5. Deploy the voice agent from the Agents tab');