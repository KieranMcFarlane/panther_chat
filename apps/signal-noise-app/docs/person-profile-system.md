# Person of Interest Profile System with AI Email Agents

## Overview

This system provides comprehensive person profiles with intelligent AI email agents, conversation threading, and automated email processing. It's designed to help manage relationships with persons of interest in sports intelligence and business development contexts.

## 🚀 Key Features

### 1. **Advanced Person Profiles**
- Complete contact information and professional details
- Relationship scoring and opportunity assessment
- Communication preferences and timezone handling
- Expertise tracking and interest mapping
- Priority classification and status tracking

### 2. **AI-Powered Email Agents**
- Intelligent email classification and routing
- Context-aware auto-reply generation
- Custom response templates and prompts
- Working hours and escalation rules
- Real-time email processing with Inbound SDK

### 3. **Conversation Management**
- Threaded email conversations with full history
- AI-generated responses with customizable styles
- Email analytics and engagement metrics
- Sentiment analysis and response tracking
- Attachment handling and search functionality

### 4. **Automation & Intelligence**
- Custom classification rules for incoming emails
- Automated response generation with CopilotKit
- Escalation rules for urgent communications
- Performance analytics and optimization insights
- Learning from interaction patterns

## 📁 File Structure

```
src/
├── app/
│   ├── person/
│   │   └── [personId]/
│   │       ├── page.tsx              # Person profile page wrapper
│   │       └── client-page.tsx       # Main person profile component
│   ├── api/
│   │   ├── person/
│   │   │   └── [personId]/
│   │   │       └── route.ts          # Person profile API endpoints
│   │   └── ai-agent/
│   │       ├── config/
│   │       │   └── route.ts          # AI agent configuration API
│   │       ├── process/
│   │       │   └── route.ts          # Email processing API
│   │       └── test/
│   │           └── route.ts          # AI agent testing API
└── components/
    └── email/
        ├── AIEmailAgent.tsx          # AI agent configuration interface
        ├── EmailConversationThread.tsx # Conversation management
        └── EmailAssistant.tsx        # AI-powered email composition
```

## 🔧 Configuration

### Environment Variables

```bash
# Inbound Email SDK
INBOUND_API_KEY=your_inbound_api_key_here

# Existing configurations
OPENAI_API_KEY=your_openai_api_key
NEO4J_URI=your_neo4j_uri
NEO4J_USERNAME=your_neo4j_username
NEO4J_PASSWORD=your_neo4j_password
```

### AI Agent Configuration

The AI agent can be configured with:

- **Response Styles**: Professional, Friendly, Formal, Casual
- **Working Hours**: Custom time ranges and timezone handling
- **Classification Rules**: Keyword-based email categorization
- **Custom Prompts**: Personalized response templates
- **Escalation Rules**: Automated handling for special cases

## 🎯 Core Components

### 1. PersonProfileClient (`client-page.tsx`)

Main profile interface featuring:
- **Profile Header**: Contact info, scores, metrics
- **Tabbed Interface**: Overview, Communication, AI Agent, Analytics, Settings
- **Real-time Data**: Live updates and status indicators
- **Interactive Actions**: Compose email, toggle AI agent, view analytics

```typescript
interface PersonProfile {
  id: string;
  properties: {
    name: string;
    role?: string;
    affiliation?: string;
    email?: string;
    phone?: string;
    location?: string;
    bio?: string;
    expertise?: string[];
    interests?: string[];
    relationshipScore?: number;
    opportunityScore?: number;
    aiAgentConfig?: AIAgentConfig;
  };
}
```

### 2. AIEmailAgent Component

Advanced AI configuration interface with:
- **Status Monitoring**: Real-time agent status and performance
- **Rule Management**: Create and manage classification rules
- **Template Editor**: Custom response templates with variables
- **Testing Tools**: Test agent responses before deployment
- **Analytics Dashboard**: Performance metrics and insights

```typescript
interface AIAgentConfig {
  enabled: boolean;
  autoReply: boolean;
  responseStyle: 'professional' | 'friendly' | 'formal' | 'casual';
  responseDelay: number;
  classificationRules: ClassificationRule[];
  customPrompts: CustomPrompt[];
  workingHours: WorkingHours;
  escalationRules: EscalationRule[];
}
```

### 3. EmailConversationThread Component

Conversation management with:
- **Threaded View**: Grouped emails by conversation
- **Search & Filter**: Find specific emails quickly
- **Reply Interface**: Inline reply with AI assistance
- **Status Tracking**: Email delivery and read status
- **Classification Labels**: Visual indicators for email types

## 🔀 API Endpoints

### Person Profile API

```http
GET /api/person/[personId]
POST /api/person/[personId]
```

### AI Agent Configuration

```http
GET /api/ai-agent/config?entityId=[id]
POST /api/ai-agent/config
```

### Email Processing

```http
POST /api/ai-agent/process
```

### AI Agent Testing

```http
POST /api/ai-agent/test
```

## 🤖 AI Agent Features

### Email Classification

The AI agent automatically classifies incoming emails based on:

- **Keywords**: Customizable keyword matching
- **Context**: Email content and sender analysis
- **Priority**: Scoring system for importance
- **Actions**: Automated responses or flags

### Response Generation

AI responses are generated using:

- **Context Awareness**: Sender information and conversation history
- **Style Adaptation**: Configurable response styles
- **Template Integration**: Custom templates with variables
- **CopilotKit Integration**: Advanced AI generation capabilities

### Working Hours & Scheduling

- **Timezone Support**: Automatic timezone conversion
- **Working Hours**: Configurable availability windows
- **Delay Configuration**: Response timing control
- **Weekend Handling**: Optional weekend coverage

## 📊 Analytics & Metrics

### Email Analytics

- **Response Rates**: Track engagement effectiveness
- **Classification Accuracy**: Monitor AI performance
- **Response Times**: Measure speed and efficiency
- **AI vs Human**: Compare AI-generated vs manual responses

### Relationship Scoring

- **Interaction History**: Track communication patterns
- **Engagement Levels**: Measure relationship strength
- **Opportunity Assessment**: Evaluate business potential
- **Priority Classification**: Automatic prioritization

## 🎨 UI Components

### Profile Header

- **Avatar & Badges**: Visual identity and status
- **Key Metrics**: Relationship score, opportunity score, response rate
- **Contact Actions**: Quick email and phone access
- **AI Agent Toggle**: Enable/disable automation

### Tabbed Interface

1. **Overview**: Profile information, bio, expertise
2. **Communication**: Email threads and conversations
3. **AI Agent**: Configuration and testing
4. **Analytics**: Performance metrics and insights
5. **Settings**: Preferences and configuration

### Conversation Thread

- **Grouped Emails**: Threaded conversation view
- **Status Indicators**: Delivery, read, reply status
- **AI Labels**: AI-generated content markers
- **Quick Actions**: Reply, forward, archive

## 🔧 Customization

### Adding Custom Classification Rules

```typescript
const customRule: ClassificationRule = {
  id: 'custom_rule_001',
  type: 'partnership_inquiry',
  keywords: ['partnership', 'collaborate', 'opportunity'],
  action: 'auto_reply',
  responseTemplate: 'Thank you for your partnership interest...',
  priority: 8,
  enabled: true
};
```

### Custom Response Templates

```typescript
const customTemplate: CustomPrompt = {
  id: 'template_001',
  name: 'Partnership Response',
  trigger: 'partnership_inquiry',
  template: 'Dear {name}, Thank you for your interest in {affiliation}...',
  variables: ['name', 'affiliation', 'opportunity'],
  enabled: true
};
```

## 🚀 Getting Started

### 1. Install Dependencies

```bash
npm install @inboundemail/sdk
```

### 2. Configure Environment

```bash
# Add to .env.local
INBOUND_API_KEY=your_api_key_here
```

### 3. Access Person Profile

Navigate to `/person/[personId]` to view profiles.

### 4. Configure AI Agent

- Enable AI agent in the profile
- Set up classification rules
- Create custom templates
- Test agent responses

## 📈 Performance Optimization

### AI Response Caching

- Cache frequently used responses
- Optimize prompt templates
- Monitor API usage

### Email Processing

- Batch processing for bulk operations
- Queue system for delayed responses
- Error handling and retry logic

### Database Optimization

- Index email threads for quick retrieval
- Cache profile data
- Optimize query patterns

## 🛡️ Security Considerations

- **API Key Management**: Secure storage of email API keys
- **Email Content**: Protect sensitive email information
- **Access Control**: Role-based access to profiles
- **Data Privacy**: Compliance with email privacy regulations

## 🔄 Integration Points

### Existing Systems

- **Neo4j Database**: Person and relationship data
- **CopilotKit**: AI response generation
- **Inbound SDK**: Email sending and receiving
- **Existing Contact System**: Sync with current contacts

### Future Enhancements

- **Calendar Integration**: Schedule meetings from conversations
- **CRM Integration**: Sync with external CRM systems
- **Advanced Analytics**: Predictive relationship scoring
- **Multi-language Support**: International communication

## 📚 Usage Examples

### Basic Profile View

```typescript
// Navigate to person profile
const profileUrl = `/person/${personId}`;

// View AI agent status
const aiStatus = await fetch(`/api/ai-agent/config?entityId=${personId}`);
```

### AI Agent Configuration

```typescript
// Update AI agent config
const config = {
  enabled: true,
  autoReply: true,
  responseStyle: 'professional',
  classificationRules: [/* rules */],
  customPrompts: [/* prompts */]
};

await fetch('/api/ai-agent/config', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ entityId: personId, config })
});
```

### Email Processing

```typescript
// Process incoming email
const result = await fetch('/api/ai-agent/process', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    entityId: personId,
    config: aiConfig,
    incomingEmail: {
      from: 'sender@example.com',
      to: 'recipient@example.com',
      subject: 'Partnership Inquiry',
      body: 'Interested in discussing opportunities...'
    }
  })
});
```

## 🎯 Best Practices

### AI Agent Configuration

- Start with conservative response delays
- Use clear, specific classification keywords
- Regularly review and update templates
- Monitor classification accuracy

### Email Communication

- Personalize AI responses with recipient information
- Use appropriate tone for different relationship levels
- Include clear calls to action in responses
- Track response effectiveness

### Relationship Management

- Regularly update relationship scores
- Monitor engagement patterns
- Adjust communication strategies based on data
- Use insights for strategic planning

## 📞 Support

For questions or issues with the person profile system:

1. Check the documentation
2. Review API responses for error details
3. Monitor AI agent performance metrics
4. Test configuration changes before deployment

---

This comprehensive person profile system provides advanced relationship management capabilities with intelligent automation, making it easier to maintain meaningful connections while leveraging AI for efficient communication.