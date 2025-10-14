# 🧪 RFP Intelligence System - Testing Guide

## 🎯 Overview
This guide shows how to test the RFP Intelligence system with both individual tests and batch scraping scenarios.

## 📋 Testing Methods

### 1. Manual Webhook Testing
Test individual webhook payloads to verify the reasoning and filtering logic:

```bash
# High-value Premier League opportunity
curl -X POST http://localhost:3005/api/mines/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "source": "linkedin",
    "content": "Manchester United announces £5M digital transformation partnership for AI-powered fan engagement platform and mobile app development - seeking technology vendor with expertise in gamification and e-commerce solutions",
    "url": "https://linkedin.com/posts/mu-digital-transformation",
    "keywords": ["digital transformation", "fan engagement", "mobile app", "AI", "gamification"],
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'",
    "confidence": 0.95,
    "metadata": {
      "author": "CTO",
      "company": "Manchester United"
    }
  }'

# Lower tier opportunity
curl -X POST http://localhost:3005/api/mines/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "source": "news",
    "content": "Local sports club looking for basic website updates",
    "url": "https://local-news.com/club-website",
    "keywords": ["website", "sports club"],
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'",
    "confidence": 0.3
  }'
```

### 2. Dashboard Testing
Access the real-time monitoring dashboard:
- **URL**: http://localhost:3005/rfp-intelligence
- **Features**: 
  - System health monitoring
  - Activity feed with filtering
  - Performance analytics
  - Top entities tracking

### 3. API Testing
Test various API endpoints:

```bash
# System status
curl "http://localhost:3005/api/rfp-monitoring?action=status"

# Activity logs
curl "http://localhost:3005/api/rfp-monitoring?action=logs&limit=20"

# Run detection test
curl "http://localhost:3005/api/rfp-monitoring?action=test"

# Export data (JSON/CSV)
curl "http://localhost:3005/api/rfp-monitoring?action=export&format=json"
```

## 🚀 Batch Testing Scenarios

### Test Data Sets
The system includes different tiers of sports entities to test the scoring and filtering:

**Tier 1 (90-100 score)**: Premier League, Formula 1, Major Olympic bodies
**Tier 2 (80-89 score)**: Championship, Major venues, International federations  
**Tier 3 (70-79 score)**: League One/Two, Regional entities
**Tier 4 (<70 score)**: Lower league and amateur organizations

### Opportunity Types Tested
- **Digital Platforms**: Website development, mobile apps, e-commerce
- **Fan Engagement**: Gamification, loyalty programs, digital experiences
- **AI Analytics**: Performance tracking, data insights, predictive analytics
- **Stadium Technology**: Digital signage, mobile ticketing, venue experiences

## 📊 Key Metrics to Monitor

### Performance Metrics
- **Processing Time**: Target <3 seconds per webhook
- **Success Rate**: Should be >95%
- **Detection Accuracy**: Confidence scores and relevance assessment

### Business Metrics
- **High-Value Detections**: Opportunities with 80%+ confidence
- **Entity Scoring**: Yellow Panther tier-based scoring
- **Opportunity Classification**: RFP types and urgency levels

### Error Monitoring
- **JSON Parsing Errors**: Fixed with markdown cleanup
- **Rate Limiting**: Claude API limits
- **Validation Errors**: Payload structure issues

## 🔧 Automated Test Suite

Run the comprehensive test suite:
```bash
# Execute all tests
./tests/test-rfp-monitoring.sh

# Test categories:
# - Webhook health and processing
# - RFP detection accuracy  
# - Activity logging functionality
# - Performance metrics
# - Error handling
# - Export functionality
# - Health monitoring
```

## 📈 Monitoring Results

### Expected Results
- **System Health**: 100% when working correctly
- **Activity Feed**: Real-time webhook processing logs
- **Analytics**: Hourly activity distribution and performance metrics
- **Top Entities**: Highest scored sports entities with detection counts

### Troubleshooting Common Issues

1. **JSON Parsing Errors**: Now fixed with markdown cleanup
2. **High Processing Times**: Check Claude API response times
3. **Missing Activity**: Verify webhook payload structure
4. **Entity Score Issues**: Check Yellow Panther scoring logic

## 🎯 Next Steps

### Production Testing
- Test with real LinkedIn monitoring data
- Validate against actual RFP opportunities
- Measure business value and detection accuracy

### Scale Testing  
- Batch processing of multiple webhooks
- Performance under load
- Memory and resource usage optimization

---

**System Architecture**: Webhook → RFP Detection → Activity Logging → Real-time Dashboard  
**Key Features**: Yellow Panther entity scoring, AI-powered reasoning, real-time monitoring