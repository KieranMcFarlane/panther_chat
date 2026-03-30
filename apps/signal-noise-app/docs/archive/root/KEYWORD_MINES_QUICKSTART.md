# Quick Start Guide - Keyword Mines System

## 🚀 Get Your System Working in 5 Minutes

### Step 1: Set Up Database Schema
Run this SQL in your Supabase SQL Editor:

```sql
-- Create the keyword mines schema
-- Copy the contents of KEYWORD_MINES_SCHEMA.sql and run it in Supabase
```

### Step 2: Initialize Keyword Mines
Click the **"Initialize Keyword Mines"** button in your dashboard at http://localhost:3005/rfp-intelligence

### Step 3: Start AI Reasoning
Click the **"Start AI Reasoning"** button

### Step 4: Test with Sample Data
Use curl to test the webhook:

```bash
curl -X POST http://localhost:3005/api/mines/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "source": "linkedin",
    "content": "Manchester United is looking for digital transformation partner to enhance fan engagement platform",
    "url": "https://example.com/news1",
    "keywords": ["manchester united", "digital transformation", "fan engagement"],
    "timestamp": "2025-01-05T16:30:00Z"
  }'
```

### Expected Results:
- ✅ You should see detections appear in the "Recent Detections" tab
- ✅ Activity feed will show real-time events  
- ✅ PWA notifications will be created
- ✅ System metrics will update

## 🔧 If You See Issues:

### "No recent detections" - Fix:
```bash
# Check if mines were created
curl http://localhost:3005/api/mines/initialize \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"action": "initialize_all"}'
```

### "AI Reasoning Inactive" - Fix:
```bash
# Start the reasoning service
curl http://localhost:3005/api/reasoning/service \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"action": "start"}'
```

### Check System Status:
```bash
# Check reasoning service status
curl http://localhost:3005/api/reasoning/service

# Check recent logs
curl "http://localhost:3005/api/logs/activity?limit=10"
```

## 📊 Real Data Sources:
Once working, you can set up real monitoring:
- **LinkedIn**: Configure BrightData webhook to `/api/mines/webhook`
- **News**: Set up news API monitoring 
- **Procurement**: Configure tender site monitoring
- **Job Boards**: Monitor for technology hiring signals

## 🎯 Success Indicators:
✅ Detections count increases from 0  
✅ Activity feed shows live events  
✅ System metrics show real data  
✅ PWA notifications appear in the system