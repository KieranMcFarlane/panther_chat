# 🎯 LiveKit Voice Agent - Quick Usage Guide

## ✅ Problem Fixed!

The LiveKit context error has been resolved. The VoiceChatRoom component now properly wraps LiveKit hooks inside a `<LiveKitRoom>` context.

## 🚀 How to Use the Voice Agent

### Step 1: Start Your Application
```bash
npm run dev
```

### Step 2: Set Environment Variables
```bash
# Required for voice processing
export OPENAI_API_KEY=your_openai_api_key_here

# Required for LiveKit Cloud (get from your LiveKit dashboard)
export LIVEKIT_API_SECRET=your_livekit_api_secret_here
```

### Step 3: Access the Voice Demo
Navigate to: `http://localhost:3005/voice-intelligence-demo`

### Step 4: Deploy the Voice Agent
1. **Click the "🤖 Agents" tab** in the top navigation
2. **Click "🚀 Deploy Agent" button**
3. **Wait for deployment** - You'll see the agent status change to "Running"

### Step 5: Start Voice Conversation
1. **Switch to "💬 Voice Chat" tab**
2. **The voice room will automatically connect** (you'll see "Status: Connected")
3. **Hold the "🎙️ Hold to Talk" button** (big green button)
4. **Speak naturally** about sports intelligence:
   - *"Tell me about Arsenal FC"*
   - *"What RFP opportunities are available?"*
5. **Release the button** to hear Claude's response

## 🔧 What's Been Fixed

### Previous Error
```
Error: No room provided, make sure you are inside a Room context or pass the room explicitly
```

### Solution Implemented
- **Wrapped LiveKit hooks** inside `<LiveKitRoom>` component
- **Proper context management** for LiveKit components
- **Clean separation** between room setup and content rendering
- **Error handling** for microphone permissions and connection issues

## 📱 UI Features Now Working

### Voice Chat Interface
- ✅ **Automatic room connection** - No manual connection needed
- ✅ **Real-time status indicators** - Shows connection and recording state
- ✅ **Hold-to-talk button** - Large, intuitive voice interaction
- ✅ **Conversation history** - See your voice interactions
- ✅ **Audio playback** - Hear Claude's responses automatically

### Agent Management
- ✅ **One-click deployment** - Deploy agents to LiveKit Cloud
- ✅ **Real-time monitoring** - Track agent status and performance
- ✅ **Connection status** - See when users are connected

### Analytics Dashboard
- ✅ **Conversation logging** - All voice conversations stored
- ✅ **Session tracking** - Monitor usage patterns
- ✅ **Transcript viewing** - Browse conversation history

## 🎙️ Voice Commands to Try

### Sports Entity Intelligence
- *"Tell me about Manchester United's current business situation"*
- *"What expansion opportunities exist for Premier League clubs?"*
- *"Search for football clubs with digital transformation needs"*

### RFP Analysis
- *"What RFP opportunities are available in sports technology?"*
- *"Show me procurement signals from major European clubs"*
- *"Find sponsorship opportunities in motorsports"*

### Market Research
- *"What are the current trends in sports venue technology?"*
- *"Analyze the digital sponsorship landscape for 2024"*
- *"Which clubs are looking for analytics partnerships?"*

## 🛠️ Troubleshooting

### Microphone Issues
- **Allow microphone permissions** when prompted by browser
- **Use Chrome or Safari** for best WebRTC performance
- **Check browser settings** if microphone access is denied

### Connection Issues
- **Check your internet connection**
- **Ensure LIVEKIT_API_SECRET is set correctly**
- **Verify agent deployment status in Agents tab**

### Audio Not Playing
- **Check browser volume**
- **Ensure audio context is allowed** (may need user interaction)
- **Try refreshing the page**

## 🎉 Success Indicators

When everything is working correctly:
- ✅ **Green status indicators** show room connection
- ✅ **Voice button turns red** when recording
- ✅ **Conversation appears** in the chat window
- ✅ **Audio response plays** automatically after processing
- ✅ **Agent shows "Running"** in the management dashboard

The voice agent is now fully functional and ready for natural sports intelligence conversations!