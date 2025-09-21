# 🚨 Microsoft Teams Integration Setup

## Overview
This guide will help you set up Microsoft Teams alerts for the RFP scraping system, ensuring you receive real-time notifications for high-priority opportunities.

---

## 🔧 Teams Setup Process

### **Step 1: Create Teams Channel**
1. **Create dedicated Teams channel**: `#rfp-alerts`
2. **Add team members** who should receive notifications
3. **Set channel permissions** (typically team-wide access)

### **Step 2: Generate Webhook URL**
1. In your `#rfp-alerts` channel, click **"..."** (More options)
2. Select **"Connectors"**
3. Find **"Incoming Webhook"** and click **"Configure"**
4. Name your webhook: **"RFP Intelligence System"**
5. Upload an icon (optional)
6. Click **"Create"**
7. **Copy the webhook URL** - you'll need this for our integration

### **Step 3: Provide Webhook to Our System**
Send us the webhook URL and we'll configure:
- **High-priority RFP alerts** (score ≥ 8.5): Immediate notification
- **Hiring signals** (digital roles): Daily digest  
- **Innovation cycles**: Weekly summaries

---

## 📊 Alert Configuration

### **Priority Thresholds**
| Score | Priority | Notification Time | Channel |
|-------|----------|------------------|---------|
| **≥ 9.0** | 🔴 Critical | **Immediate** | Teams + SMS |
| **≥ 8.5** | 🟠 High | **Within 1 hour** | Teams |
| **≥ 7.0** | 🟡 Medium | **Daily digest** | Teams |
| **≥ 5.0** | 🟢 Low | **Weekly summary** | Email |

### **Signal Type Weights for RFP Focus**
| Signal Type | Weight | Justification |
|-------------|--------|---------------|
| **RFP/Tender** | **3.0x** | 🎯 Primary target |
| **Digital Project** | **2.5x** | High relevance |
| **Partnership Change** | **2.0x** | Immediate opportunity |
| **Tech Investment** | **1.8x** | Medium relevance |
| **Hiring (Digital)** | **1.2x** | Context only |

---

## 📱 Example Alert Formats

### **🔥 Critical RFP Alert (Score ≥ 9.0)**
```
🚨 CRITICAL RFP DETECTED 🚨

Organization: Cricket West Indies
RFP: "Digital Transformation & Mobile App Development"
Score: 9.2/10
Type: RFP/Tender
Posted: 2 hours ago

💰 Estimated Value: £1.5M - £3M
⏰ Deadline: 6 weeks
🎯 Perfect Match: Mobile app development, fan engagement

Quick Actions:
• Research stakeholders at Cricket West Indies
• Check for warm introductions  
• Download RFP documents
• Draft response strategy

📎 RFP Link: [View Original Post]
📊 View in Dashboard: [Intelligence Graph]
```

### **🔔 High-Priority Alert (Score ≥ 8.5)**
```
🔥 HIGH-IMPACT SIGNAL DETECTED

Organization: World Boxing
Signal: "New digital platform RFP announced"
Score: 8.7/10
Type: Digital Project RFP
Date: 4 hours ago

Quick Actions:
• Research stakeholders at World Boxing
• Check for warm introductions
• Draft outreach strategy

View Details: [Dashboard Link]
```

### **📊 Daily Digest (Medium Priority)**
```
📈 Daily RFP Intelligence Summary - March 15, 2024

🎯 Top 3 Opportunities:
1. International Table Tennis Federation - Website modernization (Score: 7.8)
2. World Lacrosse - Mobile app development (Score: 7.5) 
3. Global Esports Federation - Fan platform RFP (Score: 7.2)

📊 Pipeline Summary:
• 5 new signals detected
• 2 RFPs identified
• 3 digital transformation projects

View Full Report: [Dashboard Link]
```

---

## ⚙️ Technical Integration

### **Webhook Configuration**
```json
{
  "webhook_url": "YOUR_TEAMS_WEBHOOK_URL_HERE",
  "alert_settings": {
    "rfp_immediate": true,
    "hiring_digest": "daily",
    "innovation_summary": "weekly"
  },
  "priority_thresholds": {
    "critical": 9.0,
    "high": 8.5,
    "medium": 7.0,
    "low": 5.0
  },
  "signal_weights": {
    "rfp": 3.0,
    "digital_project": 2.5,
    "partnership_change": 2.0,
    "tech_investment": 1.8,
    "hiring": 1.2
  }
}
```

### **Testing the Integration**
Once configured, we'll send a test alert to verify:
1. **Connection works properly**
2. **Message formatting appears correctly**
3. **Action buttons function**
4. **Links direct to proper dashboards**

---

## 🎯 RFP-Focused Keywords

### **Primary RFP Terms (Weight: 3.0x)**
- "request for proposal"
- "RFP"
- "tender"
- "procurement"
- "digital transformation tender"
- "mobile app development RFP"

### **Digital Project Terms (Weight: 2.5x)**
- "mobile app development"
- "digital platform"
- "fan engagement platform"
- "website redesign project"
- "digital innovation initiative"

### **Technology Investment Terms (Weight: 1.8x)**
- "technology investment"
- "digital transformation"
- "innovation fund"
- "tech upgrade"
- "digital modernization"

---

## 📞 Support & Troubleshooting

### **Common Issues**
1. **Not receiving alerts**: Check webhook URL and channel permissions
2. **Too many notifications**: Adjust priority thresholds
3. **Missing RFPs**: Verify keyword monitoring scope

### **Contact Information**
- **Technical Support**: [Your support email]
- **Account Manager**: [Your AM contact]
- **Emergency Escalation**: [Emergency contact]

---

## 🔄 Next Steps

1. ✅ Create `#rfp-alerts` Teams channel
2. ✅ Generate webhook URL and send to our team
3. ✅ Configure alert preferences
4. ✅ Test integration with sample alert
5. ✅ Begin receiving live RFP intelligence

**Timeline**: Setup typically takes 24-48 hours after receiving webhook URL.

---

*This integration ensures you never miss a high-value RFP opportunity while filtering out noise to focus on what matters most to your business.* 