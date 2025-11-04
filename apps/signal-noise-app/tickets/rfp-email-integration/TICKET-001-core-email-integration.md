# TICKET-001: Core Email Integration

**Status:** 🟡 Ready for Development  
**Priority:** 🔴 P0 - Critical  
**Ticket ID:** RFP-EMAIL-001  
**Created:** 2024-10-27  
**Assignee:** Backend Developer  
**Estimated:** 4-6 hours  
**Sprint:** Q4-2024-Sprint-4

---

## 🎯 Objective

Integrate the migrated email service with the existing RFP monitoring bash script to enable immediate email notifications for high-priority RFP detections.

---

## 📋 User Story

As a **Sales Team Member**, I want to **receive immediate email notifications** when high-priority RFPs are detected, so that **I can respond quickly to valuable opportunities**.

---

## ✅ Acceptance Criteria

### **Functional Requirements**
- [ ] Modified bash script sends emails for RFPs with confidence_score ≥ 80
- [ ] Each high-priority RFP triggers immediate email notification within 30 seconds
- [ ] Uses migrated email service API: `/api/notifications/rfp-detected-migrated`
- [ ] Logs all email notifications to dedicated log files with timestamps
- [ ] Handles email sending failures gracefully with retry logic
- [ ] Sends daily summary email with RFP statistics at script completion

### **Technical Requirements**
- [ ] Integration with existing RFP monitoring script without breaking current functionality
- [ ] Error handling for API failures and network issues
- [ ] Rate limiting to prevent email service overload
- [ ] Structured logging for troubleshooting and monitoring
- [ ] Environment variable configuration for API keys and endpoints

### **Performance Requirements**
- [ ] Email sending time: <30 seconds per RFP
- [ ] Script execution time increase: <20% overhead
- [ ] Success rate: >95% email delivery
- [ ] Concurrent processing: Handle up to 10 high-priority RFPs per run

---

## 🔧 Technical Implementation

### **Integration Point**
```bash
# Add to existing bash script after RFP detection
process_rfp_notifications() {
    local rfp_file="$1"
    local stamp="$2"
    
    # Extract high-priority RFPs
    HIGH_PRIORITY_RFPS=$(jq -r '.rfps[] | select(.confidence_score >= 80)' "$rfp_file")
    
    if [ ! -z "$HIGH_PRIORITY_RFPS" ]; then
        echo "📧 Processing $(echo "$HIGH_PRIORITY_RFPS" | jq '. | length') high-priority RFPs..."
        
        # Send each RFP notification
        echo "$HIGH_PRIORITY_RFPS" | jq -c '.' | while read -r rfp; do
            send_rfp_email_notification "$rfp" "$stamp"
        done
    fi
}

send_rfp_email_notification() {
    local rfp="$1"
    local stamp="$2"
    
    # Extract RFP details
    ORGANIZATION=$(echo "$rfp" | jq -r '.organization')
    FIT_SCORE=$(echo "$rfp" | jq -r '.confidence_score')
    ESTIMATED_VALUE=$(echo "$rfp" | jq -r '.estimated_value // "TBD"')
    SPORT=$(echo "$rfp" | jq -r '.sport // "Multi-sport"')
    RECOMMENDATION=$(echo "$rfp" | jq -r '.recommendation // "Immediate outreach recommended"')
    DETECTED_AT=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)
    
    # Send email via migrated service
    local response=$(curl -s -X POST "http://localhost:3005/api/notifications/rfp-detected-migrated" \
        -H "Content-Type: application/json" \
        -d "{
            \"type\": \"rfp_detected\",
            \"priority\": \"HIGH\",
            \"organization\": \"$ORGANIZATION\",
            \"fit_score\": $FIT_SCORE,
            \"estimated_value\": \"$ESTIMATED_VALUE\",
            \"urgency\": \"HIGH\",
            \"recommendation\": \"$RECOMMENDATION\",
            \"detected_at\": \"$DETECTED_AT\",
            \"sport\": \"$SPORT\"
        }")
    
    # Log result
    local success=$(echo "$response" | jq -r '.success // false')
    if [ "$success" = "true" ]; then
        echo "✅ Email sent: $ORGANIZATION (Score: $FIT_SCORE)" | tee -a "$LOG_DIR/email_notifications_${stamp}.log"
    else
        echo "❌ Email failed: $ORGANIZATION - $response" | tee -a "$LOG_DIR/email_errors_${stamp}.log"
    fi
}
```

### **Daily Summary Email**
```bash
send_daily_summary() {
    local stamp="$1"
    local total_rfps=$(jq '.rfps | length' "$LOG_DIR/rfp_results_${stamp}.json")
    local high_priority_count=$(jq -r '.rfps[] | select(.confidence_score >= 80)' "$LOG_DIR/rfp_results_${stamp}.json" | jq '. | length')
    local email_count=$(wc -l < "$LOG_DIR/email_notifications_${stamp}.log" 2>/dev/null || echo "0")
    
    curl -s -X POST "http://localhost:3005/api/test-email-send" \
        -H "Content-Type: application/json" \
        -d "{
            \"to\": \"kieranmcfarlane2@googlemail.com\",
            \"subject\": \"🔍 Daily RFP Intelligence Report - $stamp\",
            \"message\": \"Daily RFP monitoring complete.\n\n📊 Summary:\n• Total RFPs detected: $total_rfps\n• High-priority opportunities: $high_priority_count\n• Email notifications sent: $email_count\n\n📁 Results: rfp_results_${stamp}.json\n📋 Summary: rfp_summary_${stamp}.md\n\nCompleted at $(date).\"
        }" | tee -a "$LOG_DIR/summary_email_${stamp}.log"
}
```

---

## 🧪 Testing Plan

### **Unit Tests**
- [ ] Test `process_rfp_notifications()` with mock JSON data
- [ ] Test `send_rfp_email_notification()` with various RFP scenarios
- [ ] Test error handling for API failures
- [ ] Test email parsing and formatting

### **Integration Tests**
- [ ] End-to-end test with actual RFP detection data
- [ ] Test email delivery to sales team addresses
- [ ] Test daily summary email generation
- [ ] Test log file creation and content validation

### **Performance Tests**
- [ ] Test with 10+ high-priority RFPs in single run
- [ ] Measure script execution time overhead
- [ ] Test concurrent email sending
- [ ] Validate rate limiting behavior

### **Test Data**
```json
{
  "rfps": [
    {
      "organization": "Premier League",
      "confidence_score": 92,
      "estimated_value": "£750K-£1.2M",
      "sport": "Football",
      "recommendation": "Immediate outreach recommended - Olympic-level digital transformation opportunity"
    }
  ]
}
```

---

## 📁 File Changes

### **Files to Modify**
- `./rfp-monitoring-script.sh` - Add email notification functions
- `./logs/` - Create new log file structure
- `.env` - Add email service configuration

### **Files to Create**
- `src/services/email/rfp-notification-processor.ts` - ✅ Already created
- `src/app/api/notifications/rfp-detected-migrated/route.ts` - ✅ Already created
- `test-email-integration.sh` - Integration test script

### **Configuration Files**
```bash
# Add to environment
RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL=rfp-alerts@yellow-panther.com
NEXT_PUBLIC_BASE_URL=https://signal-noise-app.com
```

---

## 🚀 Deployment Steps

### **Pre-Deployment**
1. [ ] Set up Resend API key and configure sender domain
2. [ ] Test migrated email service endpoints
3. [ ] Create backup of existing bash script
4. [ ] Set up monitoring for email delivery rates

### **Deployment**
1. [ ] Deploy enhanced bash script with email integration
2. [ ] Configure log rotation for email logs
3. [ ] Set up alerts for email delivery failures
4. [ ] Test with production RFP data

### **Post-Deployment**
1. [ ] Monitor first 24 hours of email notifications
2. [ ] Validate email delivery to sales team
3. [ ] Check log file structure and content
4. [ ] Review performance metrics

---

## 📊 Success Metrics

### **Immediate**
- ✅ Email delivery rate: >95%
- ✅ Email sending time: <30 seconds per RFP
- ✅ Script overhead: <20% execution time increase

### **30-Day**
- 📈 RFP response time: 50% faster
- 📈 Sales team engagement: 80% email open rate
- 📈 High-priority RFP coverage: 100%

---

## 🆘 Risk Mitigation

### **High Risk**
1. **Email Service Failure**
   - **Mitigation:** Fallback to Slack notifications
   - **Monitoring:** Email delivery rate alerts

2. **API Rate Limiting**
   - **Mitigation:** Implement email queuing
   - **Monitoring:** API response time tracking

### **Medium Risk**
1. **False Positive RFPs**
   - **Mitigation:** Confidence score thresholds
   - **Monitoring:** Manual review process

2. **Script Performance**
   - **Mitigation:** Optimize email sending logic
   - **Monitoring:** Script execution time alerts

---

## 📞 Contact Information

**Assignee:** Backend Developer  
**Reviewer:** Technical Lead  
**Stakeholders:** Sales Team, Product Manager  
**Slack Channel:** #rfp-integration  
**Emergency Contact:** [Name] - [Phone]

---

## 📝 Implementation Notes

### **Dependencies**
- ✅ Migrated email service (`src/services/email/`)
- ✅ Resend API integration
- ⏳ Environment configuration
- ⏳ Testing infrastructure

### **Blockers**
- [ ] Resend API key configuration
- [ ] Production email domain verification
- [ ] Sales team email distribution list

### **Definition of Done**
- [ ] All acceptance criteria met
- [ ] Code reviewed and approved
- [ ] Tests passing with >90% coverage
- [ ] Documentation updated
- [ ] Stakeholder sign-off received

---

**Last Updated:** 2024-10-27  
**Next Review:** Daily standup  
**Status:** Ready for development