# LiveKit Cloud Agent Deployment Guide

## 🚀 Quick Setup

### 1. Set Environment Variables

```bash
# Set your OpenAI API key for voice processing
export OPENAI_API_KEY=your_openai_api_key_here

# Set your LiveKit API secret (from your LiveKit Cloud dashboard)
export LIVEKIT_API_SECRET=your_livekit_api_secret_here
```

### 2. Deploy the Agent

You have two options to deploy the Yellow Panther Voice Agent:

#### Option A: Manual Deployment with LiveKit CLI
```bash
cd livekit-agents
npm install
./deploy.sh
```

#### Option B: Deploy via App Interface
1. Start your Signal Noise App: `npm run dev`
2. Visit: `http://localhost:3005/voice-intelligence-demo`
3. Click the "🤖 Agents" tab
4. Click "🚀 Deploy Agent" button

### 3. Test the Agent

1. Navigate to the "💬 Voice Chat" tab
2. Click "🎙️ Voice" mode
3. Click "🎤 Connect Voice Room" 
4. Hold the "🎙️ Hold to Talk" button to speak with Claude

## 🔧 Configuration

### LiveKit Cloud Details
- **WebSocket URL**: `wss://yellow-panther-8i644ma6.livekit.cloud`
- **API Key**: `APIioqpEJhEjDsE`
- **Region**: US Central
- **Agent Name**: `yellow-panther-voice-agent`

### Agent Capabilities
- **Voice Processing**: GPT-4o (Speech-to-text + Text-to-speech)
- **Intelligence**: Claude Agent with MCP tools
- **Knowledge Graph**: Neo4j integration
- **Research**: BrightData web scraping
- **Market Intelligence**: Perplexity search
- **Analytics**: Conversation logging and insights

## 📊 Monitoring

### Agent Management
- View agent status in the "🤖 Agents" tab
- Monitor active sessions and performance
- Deploy/stop agents as needed

### Conversation Analytics
- View conversation history in "📊 Analytics" tab
- Track session duration and engagement
- Export conversation logs for analysis

## 🛠️ Troubleshooting

### Common Issues

#### Agent Won't Connect
1. Check your environment variables are set correctly
2. Verify your LiveKit Cloud credentials
3. Ensure your Signal Noise App is running
4. Check network connectivity to LiveKit Cloud

#### Voice Not Working
1. Verify OpenAI API key is valid and has sufficient credits
2. Check browser microphone permissions
3. Ensure the agent is deployed and running
4. Test with a different browser if needed

#### Claude Agent Integration Issues
1. Ensure your Signal Noise App is running on port 3005
2. Verify Claude Agent API endpoints are accessible
3. Check MCP tool connections (Neo4j, BrightData, Perplexity)

### Logs and Debugging

#### Check Agent Logs
```bash
# If running locally
cd livekit-agents
node agent.js your-room-name your-agent-name

# Check LiveKit Cloud logs via dashboard
```

#### Browser Console
Open Developer Tools (F12) and check Console tab for:
- WebRTC connection status
- Audio stream errors
- API call responses

## 🔮 Advanced Configuration

### Custom Agent Behavior
Edit `livekit-agents/agent.js` to modify:
- System prompts and personality
- Claude Agent integration settings
- Voice synthesis parameters
- Response processing logic

### Scalability Settings
- Adjust `max_participants` in agent configuration
- Configure idle timeout settings
- Set up multiple agents for load balancing
- Monitor resource usage in LiveKit Cloud dashboard

### Integration Points
- Custom Claude Agent endpoints
- Additional MCP tools
- External analytics systems
- CRM or ticketing systems

## 📞 Support

For additional support:
1. Check LiveKit Cloud documentation
2. Review agent logs and error messages
3. Test with the local deployment script first
4. Verify all API keys and credentials are current

## 🎉 Success Indicators

When everything is working correctly:
- ✅ Agent shows "Running" status
- ✅ Voice rooms connect successfully
- ✅ Audio streams in both directions
- ✅ Claude responds with sports intelligence
- ✅ MCP tools integrate seamlessly
- ✅ Conversations are logged in Supabase