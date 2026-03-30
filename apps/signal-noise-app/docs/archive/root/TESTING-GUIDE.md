# 🧪 RFP Intelligence Testing Guide

## Quick Test Overview

**Main Page:** http://localhost:3005/rfp-intelligence

**Server Status:** ✅ Running on port 3005

---

## 🎯 **Step 1: Test the RFP Intelligence Dashboard**

1. **Open your browser and go to:**
   ```
   http://localhost:3005/rfp-intelligence
   ```

2. **What you should see:**
   - 🎯 RFP Intelligence Dashboard header
   - Recent RFP Alerts panel (left side)
   - Detailed Analysis panel (right side)
   - System Status indicators at bottom
   - 🟢 Green "Connected" indicator

3. **Test the interface:**
   - Click on different RFP alerts in the left panel
   - Check that the right panel updates with detailed analysis
   - Look for fit scores, urgency indicators, and CopilotKit actions

---

## 🔧 **Step 2: Test Webhook Processing**

### **Method 1: Using the Test Script (Recommended)**

```bash
# In your terminal, run:
API_BASE_URL=http://localhost:3005 ./tests/test-rfp-integration.sh webhook
```

**Expected output:** ✅ Webhook endpoint responding

### **Method 2: Manual Webhook Test**

```bash
curl -X POST http://localhost:3005/api/webhook/linkedin-rfp-claude \
  -H "Content-Type: application/json" \
  -d '{
    "webhook_id": "test_001",
    "site_name": "LinkedIn",
    "page_url": "https://linkedin.com/posts/test",
    "page_title": "Digital Transformation RFP",
    "content": "Premier League club seeking digital transformation partner for fan engagement platform. Budget: £750K-£1.2M. Looking for experienced sports technology vendors.",
    "meta": {
      "author": "Sarah Chen",
      "role": "Chief Technology Officer", 
      "company": "Manchester United FC",
      "post_id": "test_001"
    },
    "extracted_at": "2025-01-01T12:00:00Z",
    "signals": ["procurement", "digital transformation", "fan engagement"]
  }'
```

**Expected response:** Server-sent events stream with analysis data

---

## 🤖 **Step 3: Test Claude Agent SDK Integration**

### **Test RFP Intelligence Analysis**

```bash
curl -X POST http://localhost:3005/api/rfp-intelligence/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "content": "We are seeking a digital transformation partner for our fan engagement platform modernization. This project includes mobile app development, CRM integration, and real-time analytics capabilities. Budget: £500K-£1M. Deadline: Q2 2025.",
    "author": "Sarah Chen",
    "role": "Chief Technology Officer",
    "company": "Manchester United FC", 
    "url": "https://linkedin.com/posts/mu-digital-transformation"
  }'
```

**Expected:** Streaming analysis with fit scoring and recommendations

### **Test CopilotKit Integration**

1. **Go to:** http://localhost:3005/rfp-intelligence
2. **Look for:** Claude sidebar on the right
3. **Test by typing:** "Analyze this RFP opportunity: Premier League club needs fan engagement system"

---

## 📊 **Step 4: Test Real-time Notifications**

### **Test Notifications Stream**

```bash
# Open this in a new terminal - it will show live updates:
curl -N http://localhost:3005/api/notifications/rfp-stream
```

You should see:
```
data: {"type":"connection_established","clientId":"client_xxx",...}
data: {"type":"heartbeat","timestamp":"..."}
```

### **Trigger a Test Notification**

In another terminal:
```bash
curl -X POST http://localhost:3005/api/notifications/rfp-stream \
  -H "Content-Type: application/json" \
  -d '{
    "type": "rfp_detected",
    "data": {
      "company": "Test FC",
      "fit_score": 85,
      "urgency_level": "HIGH"
    },
    "priority": "HIGH"
  }'
```

You should see the notification appear in the first terminal.

---

## 🎯 **Step 5: End-to-End Test**

### **Complete Flow Test**

1. **Open the dashboard:** http://localhost:3005/rfp-intelligence
2. **Open notifications stream:** `curl -N http://localhost:3005/api/notifications/rfp-stream`
3. **Send a test webhook:** (Using curl command from Step 2)
4. **Watch the results:**
   - Webhook processes → Claude analyzes → Dashboard updates → Notification appears

### **What to Look For:**

✅ **Success Indicators:**
- Dashboard shows "Connected" status
- RFP alerts appear in left panel
- Claude analysis completes with fit scores
- Real-time notifications stream updates
- CopilotKit sidebar responds to chat

⚠️ **Common Issues:**
- Dashboard not loading → Check server is running
- No analysis results → Check Claude Agent SDK and MCP servers
- Notifications not working → Check WebSocket/SSE connections

---

## 🔍 **Step 6: Check System Health**

### **Health Check**
```bash
curl -s http://localhost:3005/api/health | jq .
```

Expected:
```json
{
  "status": "healthy",
  "timestamp": "...",
  "services": {
    "database": {"status": "connected"},
    "api": "healthy"
  }
}
```

### **Server Logs**
Check the server terminal for:
```
✅ Claude Agent SDK message: MCP Servers initialized
✅ Webhook received from: [Company Name]
✅ RFP Intelligence complete for [Company] - Fit Score: [XX]
```

---

## 🚀 **Step 7: Production Testing**

When you're ready to test in production:

1. **Deploy to Vercel/EC2**
2. **Update BrightData webhook URL** to your production domain
3. **Test with:** `https://your-domain.com/rfp-intelligence`
4. **Monitor:** Real LinkedIn data should start appearing

---

## 📱 **Mobile Testing**

The dashboard is responsive. Test on:
- Mobile phone browser
- Tablet
- Different screen sizes

---

## 🐛 **Troubleshooting**

### **If something doesn't work:**

1. **Check server status:**
   ```bash
   curl http://localhost:3005/api/health
   ```

2. **Check server logs** in the terminal where `npm run dev` is running

3. **Clear browser cache** and refresh the dashboard

4. **Check network tab** in browser dev tools for failed requests

### **Common fixes:**
- Port already in use → Kill process on port 3005
- MCP server errors → Check environment variables
- Slow analysis → Expected (60-90 seconds for full Claude analysis)

---

## 🎉 **Success!**

When everything is working, you should see:
- 🟢 Connected status in dashboard
- 📊 RFP alerts with fit scores
- 💬 Working CopilotKit chat
- 🔔 Real-time notifications
- 🤖 Claude Agent SDK analyzing opportunities

Your RFP Intelligence system is now ready to detect and analyze real procurement opportunities!