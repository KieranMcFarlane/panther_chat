# 🎯 Complete Voice Agent Testing Guide

## 🧠 AI Architecture Clarification

### **What You Actually Have:**
```
Your Voice → GPT-4o (Voice Processing) → Claude Agent SDK (Your Existing System) → GPT-4o (Voice Output)
```

- **GPT-4o**: Only for voice-to-text and text-to-speech
- **Claude Agent SDK**: Your existing reasoning engine with all MCP tools
- **No Claude Code**: Uses your Claude Agent SDK (better for this use case)

## 🚀 Step-by-Step Testing

### **Step 1: Verify Everything is Running**
```bash
# Start your main app
npm run dev

# In a separate terminal, you can also start the LiveKit agent
cd livekit-agents && npm run dev
```

### **Step 2: Access the Voice Interface**
```
http://localhost:3005/voice-intelligence-demo
```

### **Step 3: Test the Voice Pipeline**

#### **Test 1: Basic Voice Recognition**
1. Hold the green "🎙️ Hold to Talk" button
2. Say: *"Hello, can you hear me?"*
3. Release
4. ✅ **Expected**: You should see the text in the conversation bubble

#### **Test 2: Claude Agent Integration**
1. Hold the talk button
2. Say: *"What sports entities are in your knowledge graph?"*
3. Release
4. ✅ **Expected**: Claude should query Neo4j and respond

#### **Test 3: MCP Tools Integration**
1. Hold the talk button
2. Say: *"Search for football clubs in London"*  
3. Release
4. ✅ **Expected**: Claude should use Neo4j MCP tools

#### **Test 4: BrightData Integration**
1. Hold the talk button
2. Say: *"What are the latest sports technology trends?"*
3. Release  
4. ✅ **Expected**: Claude should use BrightData or Perplexity

## 📊 How to Verify the Full Pipeline

### **Check Browser Console (F12)**
```javascript
// Look for these logs:
console.log('🎤 Recording started');
console.log('⚡ Processing audio...');
console.log('✅ Audio processed successfully');
```

### **Check Server Logs**
```bash
# You should see Claude Agent processing logs:
[VOICE INPUT] What sports entities are in your knowledge graph?
🧠 Processing your request...
🔗 Connecting to Claude Agent SDK...
```

### **Check Conversation Storage**
1. Go to "📊 Analytics" tab
2. You should see conversation history
3. Verify Claude Agent responses are being stored

## 🔍 Advanced Testing Scenarios

### **Test Complex Sports Intelligence**
```bash
# Try these voice commands:
"Tell me about Arsenal FC's current business model and expansion opportunities"
"What RFP signals are you detecting from Premier League clubs right now?"
"Compare the digital presence of Manchester United vs Liverpool FC"
"Search for sports venues that need technology upgrades"
```

### **Test MCP Tool Chain**
```bash
# These should trigger multiple tools:
"Analyze the sponsorship landscape in European football using web research"
"Find contact information for decision makers at Chelsea FC"
"Research recent funding rounds in sports technology startups"
```

## 🛠️ Troubleshooting Common Issues

### **Voice Not Working**
- **Check microphone permissions** in browser settings
- **Check OpenAI API key** is valid (test with curl)
- **Check browser console** for WebRTC errors

### **Claude Agent Not Responding**
- **Check Claude Agent SDK** is running (see server logs)
- **Check MCP tools** are connected (Neo4j, BrightData, Perplexity)
- **Check network connectivity** to your endpoints

### **Audio Not Playing**
- **Check browser volume** settings
- **Check audio context** (click page first)
- **Try different browser** (Chrome works best)

## 🎯 Success Indicators

When everything is working, you should see:

### **UI Indicators**
- ✅ **Green status** showing room connection
- ✅ **Red button** when recording voice
- ✅ **Conversation bubbles** appearing in real-time
- ✅ **Audio playing** automatically after processing

### **Technical Indicators**
- ✅ **GPT-4o transcribing** your speech accurately
- ✅ **Claude Agent SDK processing** requests
- ✅ **MCP tools being called** (check server logs)
- ✅ **Responses stored** in Supabase
- ✅ **Audio synthesis** working properly

### **Business Intelligence**
- ✅ **Sports entity queries** working via Neo4j
- ✅ **Web research** working via BrightData/Perplexity
- ✅ **RFP intelligence** being analyzed
- ✅ **Natural conversation** about sports business

## 🔧 Debug Mode

### **Enable Detailed Logging**
Add this to your `.env`:
```bash
LOG_LEVEL=DEBUG
DEBUG=livekit:*
```

### **Monitor All API Calls**
In browser console:
```javascript
// Monitor network requests
fetch('/api/livekit/voice-conversation').then(r => r.json()).then(console.log)
```

Your voice agent is **fully integrated** with Claude Agent SDK and all your MCP tools! 🎙️✨