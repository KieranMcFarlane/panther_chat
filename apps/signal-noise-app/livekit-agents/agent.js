#!/usr/bin/env node

require('dotenv').config();
const {
  Agent,
  AutoSubscribe,
  calculateAudioHash,
  generateAudioHash,
  setGlobalLogger,
  utils,
} = require('@livekit/agents');
const { OpenAIPlugin } = require('@livekit/agents-plugin-openai');
const WebSocket = require('ws');
const fetch = require('node-fetch');

// Configuration
const {
  LIVEKIT_URL = 'wss://yellow-panther-8i644ma6.livekit.cloud',
  LIVEKIT_API_KEY = 'APIioqpEJhEjDsE',
  LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET,
  OPENAI_API_KEY = process.env.OPENAI_API_KEY,
  CLAUDE_AGENT_URL = 'http://localhost:3005/api/claude-agent/activity',
} = process.env;

class YellowPantherVoiceAgent extends Agent {
  constructor(roomName, participantName) {
    super(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
    
    this.roomName = roomName;
    this.participantName = participantName;
    this.openaiPlugin = null;
    this.sessionId = `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Set up logging
    setGlobalLogger(utils.DefaultLogger);
    
    this.setupOpenAIPlugin();
  }

  setupOpenAIPlugin() {
    try {
      this.openaiPlugin = new OpenAIPlugin({
        model: 'gpt-4o',
        voice: 'alloy',
        temperature: 0.7,
        systemPrompt: `You are a sports intelligence assistant for Yellow Panther. You help users analyze:

- Sports entities and business opportunities
- RFP (Request for Proposal) analysis
- Market intelligence using knowledge graphs
- Entity relationships and data insights

Key guidelines:
- Be conversational and natural in speech
- Keep responses concise for voice delivery (under 150 words)
- Focus on actionable sports business intelligence
- Use data from Neo4j knowledge graph when available
- Leverage BrightData and Perplexity for market insights

You have access to powerful tools through Claude Agent MCP servers:
- Neo4j knowledge graph for entity relationships
- BrightData for web research and scraping
- Perplexity for market intelligence

Always be helpful, accurate, and focused on sports business intelligence.`,
      });
      
      this.plugins.push(this.openaiPlugin);
      console.log('✅ OpenAI plugin initialized');
    } catch (error) {
      console.error('❌ Failed to initialize OpenAI plugin:', error);
    }
  }

  async prewarm() {
    console.log('🔥 Prewarming agent...');
    await this.openaiPlugin?.prewarm();
    console.log('✅ Agent prewarmed and ready');
  }

  async entry(room) {
    console.log(`🚀 Entering room: ${this.roomName}`);
    
    // Set up participant metadata
    await room.localParticipant.setMetadata({
      agentType: 'yellow-panther-voice',
      sessionId: this.sessionId,
      capabilities: JSON.stringify(['voice', 'claude-integration', 'sports-intelligence']),
    });

    // Auto-subscribe to audio tracks
    const autoSubscribe = new AutoSubscribe({
      subscribe: utils.TrackSource.Microphone,
    });
    this.plugins.push(autoSubscribe);

    // Listen for track subscriptions
    room.on(utils.Event.TrackSubscribed, this.handleTrackSubscribed.bind(this));
    room.on(utils.Event.TrackUnsubscribed, this.handleTrackUnsubscribed.bind(this));
    
    // Set up conversation state
    this.conversationHistory = [];
    this.isProcessing = false;
    
    console.log('✅ Agent ready in room');
  }

  async handleTrackSubscribed(track, publication, participant) {
    if (track.kind !== utils.TrackKind.Audio) {
      return;
    }

    console.log(`🎤 Subscribed to audio track from ${participant.identity}`);
    
    // Process audio through OpenAI plugin
    try {
      if (!this.openaiPlugin) {
        console.error('❌ OpenAI plugin not available');
        return;
      }

      // Set up conversation context for this user
      this.openaiPlugin.conversationContext = {
        sessionId: this.sessionId,
        userId: participant.identity,
        roomName: this.roomName,
      };

      // Handle audio processing through OpenAI plugin
      track.on(utils.Event.AudioReceived, async (frame) => {
        if (this.isProcessing) return;
        
        try {
          this.isProcessing = true;
          
          // Let OpenAI plugin handle the audio (transcription + response generation)
          const response = await this.processWithClaudeAgent(frame);
          
          if (response && response.trim()) {
            await this.speak(response);
          }
          
        } catch (error) {
          console.error('❌ Error processing audio:', error);
          await this.speak("I apologize, but I encountered an error processing your request. Please try again.");
        } finally {
          this.isProcessing = false;
        }
      });

    } catch (error) {
      console.error('❌ Error setting up audio processing:', error);
    }
  }

  handleTrackUnsubscribed(track, publication, participant) {
    console.log(`🔇 Unsubscribed from audio track from ${participant.identity}`);
  }

  async processWithClaudeAgent(audioFrame) {
    try {
      // First, get transcription from OpenAI
      const transcription = await this.transcribeAudio(audioFrame);
      
      if (!transcription || transcription.trim().length < 2) {
        return null;
      }

      console.log(`📝 User said: "${transcription}"`);

      // Process with Claude Agent for intelligence
      const claudeResponse = await this.callClaudeAgent(transcription);
      
      if (claudeResponse) {
        // Add to conversation history
        this.conversationHistory.push({
          user: transcription,
          assistant: claudeResponse,
          timestamp: new Date().toISOString(),
        });

        console.log(`🤖 Claude response: "${claudeResponse.substring(0, 100)}..."`);
        return claudeResponse;
      }

      // Fallback to OpenAI for basic response
      return await this.openaiPlugin?.chat([
        {
          role: 'system',
          content: 'You are a helpful sports intelligence assistant. Provide concise, helpful responses about sports business and RFP opportunities.',
        },
        {
          role: 'user',
          content: transcription,
        },
      ]);

    } catch (error) {
      console.error('❌ Error in processWithClaudeAgent:', error);
      return null;
    }
  }

  async transcribeAudio(audioFrame) {
    try {
      // This would use OpenAI's transcription capabilities
      // For now, return a placeholder - the actual implementation would depend on how the audio frame is structured
      return "[User speech transcription placeholder]";
    } catch (error) {
      console.error('❌ Transcription error:', error);
      return null;
    }
  }

  async callClaudeAgent(userMessage) {
    try {
      console.log('🧠 Calling Claude Agent for intelligence...');
      
      const response = await fetch(CLAUDE_AGENT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          sessionId: this.sessionId,
          context: 'voice_conversation',
          userId: this.participantName,
        }),
      });

      if (!response.ok) {
        throw new Error(`Claude Agent error: ${response.status} ${response.statusText}`);
      }

      const responseText = await response.text();
      
      // Extract the actual response content from the Claude Agent response
      const claudeContent = this.extractClaudeResponse(responseText);
      
      console.log('✅ Claude Agent processed successfully');
      return claudeContent;

    } catch (error) {
      console.error('❌ Error calling Claude Agent:', error);
      
      // Fallback to OpenAI if Claude is unavailable
      try {
        console.log('🔄 Falling back to OpenAI...');
        return await this.openaiPlugin?.chat([
          {
            role: 'system',
            content: 'You are a helpful sports intelligence assistant. Provide concise, helpful responses about sports business, RFP opportunities, and entity analysis.',
          },
          {
            role: 'user',
            content: userMessage,
          },
        ]);
      } catch (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError);
        return null;
      }
    }
  }

  extractClaudeResponse(responseText) {
    try {
      // Try to parse if it's JSON
      const parsed = JSON.parse(responseText);
      return parsed.message || parsed.response || parsed.content || responseText;
    } catch {
      // If not JSON, extract meaningful content
      const lines = responseText.split('\n');
      const meaningfulLines = lines.filter(line => 
        line.trim() && 
        !line.includes('Claude Agent SDK') && 
        !line.includes('Session:') &&
        !line.includes('Status:') &&
        !line.includes('Tools:')
      );
      
      return meaningfulLines.join(' ').trim() || responseText;
    }
  }

  async speak(text) {
    try {
      console.log(`🔊 Speaking: "${text.substring(0, 100)}..."`);
      
      if (this.openaiPlugin) {
        // Use OpenAI's TTS capabilities
        await this.openaiPlugin.say(text);
      } else {
        console.warn('⚠️ OpenAI plugin not available for speech synthesis');
      }
    } catch (error) {
      console.error('❌ Error speaking:', error);
    }
  }

  async onLeave() {
    console.log(`👋 Leaving room: ${this.roomName}`);
    
    // Store conversation history if needed
    if (this.conversationHistory.length > 0) {
      await this.storeConversationHistory();
    }
  }

  async storeConversationHistory() {
    try {
      // Store conversation in your existing system
      console.log(`💾 Storing ${this.conversationHistory.length} conversation turns`);
      
      // This would integrate with your Supabase storage
      const conversationData = {
        sessionId: this.sessionId,
        roomName: this.roomName,
        participantName: this.participantName,
        conversation: this.conversationHistory,
        timestamp: new Date().toISOString(),
      };

      // Implementation would depend on your storage API
      // await this.saveToSupabase(conversationData);
      
    } catch (error) {
      console.error('❌ Error storing conversation history:', error);
    }
  }
}

// Agent main function
async function main() {
  console.log('🚀 Starting Yellow Panther Voice Agent...');
  
  // Get command line arguments
  const args = process.argv.slice(2);
  const roomName = args[0] || 'yellow-panther-voice-room';
  const participantName = args[1] || 'claude-agent';

  try {
    const agent = new YellowPantherVoiceAgent(roomName, participantName);
    
    console.log(`✅ Agent created for room: ${roomName}`);
    console.log(`👤 Agent participant name: ${participantName}`);
    
    // Start the agent
    await agent.start(roomName, participantName);
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down agent...');
      await agent.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start agent:', error);
    process.exit(1);
  }
}

// Start the agent
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { YellowPantherVoiceAgent };