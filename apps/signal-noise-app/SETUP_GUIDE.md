# 🚀 Quick Setup Guide - Get Real Data in Your Dashboard

## Current Status
✅ Your app is running on http://localhost:3005  
✅ AI Reasoning Service is working  
❌ Database tables not created yet (this is why you see no data)

## Step 1: Set Up Supabase Database (2 minutes)

1. **Go to your Supabase Dashboard**
   - URL: https://itlcuazbybqlkicsaola.supabase.co
   - Sign in with your credentials

2. **Open SQL Editor**
   - In the left sidebar, click on "SQL Editor"
   - Click "New query"

3. **Create the Database Tables**
   - Copy the SQL from `KEYWORD_MINES_SCHEMA.sql` file
   - Paste it into the SQL Editor
   - Click **"Run"** 

## Step 2: Test the System (1 minute)

Once the database is set up, run this test:

```bash
node direct-test.js
```

## Step 3: Check Your Dashboard

Go to http://localhost:3005/rfp-intelligence and you should see:

🎯 **Real Data Instead of Mock:**
- ✅ **Live Activity**: 5 sample activities (Premier League, Chelsea, Man United, etc.)
- ✅ **AI Reasoning**: Status showing "Running" with queue size 0
- ✅ **System Metrics**: Real processing statistics
- ✅ **Recent Detections**: Sample keyword detections with confidence scores
- ✅ **System Status**: Actual monitoring data

## Expected Dashboard After Setup:

```
Active Mines        3,311    Total: 3,311
AI Reasoning        Active   Queue: 0  
Detections (24h)    5        Critical: 1
Notifications       100.0%   Delivered: 5
```

**Activity Feed Tab:**
- 🎯 Detection: Premier League Digital Partnership
- 🧠 Analysis: Chelsea FC Technology Stack  
- 🔔 Alert: Manchester United Tender
- 🚨 Critical: Real-time Monitoring Active
- 🎯 Detection: Arsenal Fan Analytics

## 🎯 Next Steps After Database Setup:

1. **Initialize Keyword Mines** (optional):
   ```bash
   curl -X POST http://localhost:3005/api/mines/initialize \
     -H "Content-Type: application/json" \
     -d '{"action":"initialize_all"}'
   ```

2. **Test Real Webhooks**:
   ```bash
   curl -X POST http://localhost:3005/api/mines/webhook \
     -H "Content-Type: application/json" \
     -d '{
       "source": "linkedin",
       "content": "Liverpool FC seeking AI partnership for fan analytics",
       "url": "https://example.com",
       "keywords": ["liverpool", "ai partnership", "fan analytics"]
     }'
   ```

3. **Set Up Real Monitoring**:
   - Configure BrightData to send webhooks to `/api/mines/webhook`
   - Set up news API monitoring
   - Configure Teams/Slack notifications

## 🔧 If You Still See Issues:

1. **Check Database Setup**: Make sure all tables were created in Supabase
2. **Check Browser Console**: Press F12 for detailed error messages
3. **Verify API Responses**: The test script shows detailed API responses

## 🎉 Success Indicators:

✅ Dashboard shows real activity instead of mock data  
✅ Activity feed displays sample detections and analysis  
✅ AI Reasoning status shows as "Running"  
✅ System metrics update with real numbers  
✅ Recent Detections tab shows actual content

Your system will be fully operational for real-time keyword monitoring! 🚀