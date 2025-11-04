# 🔗 LinkedIn Scraper Criteria & Configuration Guide

## 📋 Overview
This document outlines the specific criteria and configuration for the LinkedIn scraper system designed to monitor sports brands and organizations for RFP opportunities, digital product projects, and strategic business intelligence.

## 🎯 Primary Objectives

### 1. **RFP & Digital Product Projects** (Priority: CRITICAL)
- **Target**: Request for Proposals (RFPs)
- **Target**: Digital product development briefs
- **Target**: Technology procurement announcements
- **Target**: Digital transformation initiatives
- **Scoring Weight**: 9.0-10.0 (Highest Priority)

### 2. **Strategic Business Intelligence** (Priority: HIGH)
- **Target**: New role announcements (Digital/Technology positions)
- **Target**: Technology investment announcements
- **Target**: Digital innovation initiatives
- **Scoring Weight**: 5.0-7.0 (Moderate Priority)

## 🏢 Target Organizations

### Premier League Clubs
- Manchester United
- Manchester City
- Arsenal
- Chelsea
- Liverpool
- Tottenham Hotspur
- Newcastle United
- Aston Villa
- Brighton & Hove Albion
- West Ham United
- Crystal Palace
- Fulham
- Brentford
- Wolverhampton Wanderers
- Nottingham Forest
- Burnley
- Sheffield United
- Luton Town
- Everton
- Bournemouth

### Additional Sports Brands (To be added)
*[Client to provide specific list of additional sports brands]*

## 🔍 Monitoring Criteria

### A. Content Types to Monitor

#### **High Priority (Score 9.0-10.0)**
- **RFP Announcements**: "Request for Proposals", "RFP", "Tender"
- **Digital Projects**: "Digital transformation", "Technology procurement"
- **System Implementations**: "New system", "Platform upgrade", "Digital platform"
- **Technology Briefs**: "Technology partner", "Digital partner", "Tech vendor"

#### **Medium Priority (Score 5.0-7.0)**
- **Hiring Announcements**: "Head of Digital", "CTO", "Digital Director"
- **Technology Investments**: "Technology investment", "Digital investment"
- **Innovation Initiatives**: "Digital innovation", "Technology innovation"

#### **Low Priority (Score 1.0-4.0)**
- **General Updates**: Regular business updates
- **Non-Digital Roles**: Non-technology hiring
- **General Announcements**: Standard company updates

### B. Scoring Logic

#### **RFP & Project Scoring (9.0-10.0)**
```
RFP Keywords: +9.0 base score
- "Request for Proposals" = +9.5
- "RFP" = +9.0
- "Tender" = +9.0
- "Digital transformation" = +9.0
- "Technology procurement" = +9.0

Project Scope Bonuses:
- Large-scale project (+0.5)
- Digital platform (+0.5)
- Technology partner needed (+0.5)
```

#### **Hiring & Investment Scoring (5.0-7.0)**
```
Role Type Scoring:
- "Head of Digital Innovation" = +6.0
- "CTO" = +6.5
- "Digital Director" = +5.5
- "Technology Director" = +5.0

Investment Type:
- "Technology investment" = +5.0
- "Digital investment" = +5.0
```

## 📊 Notification System

### Real-Time Alerts (Score >8.5)
- **Channel**: Microsoft Teams
- **Trigger**: Immediate notification
- **Content**: High-priority signals with actionable insights
- **Setup Required**: Teams chat group configuration

### Daily Digest (Score >7.0)
- **Channel**: Email
- **Time**: 9 AM daily
- **Content**: Top 5 opportunities from previous 24 hours
- **Format**: Summarized with quick action items

### Critical Alerts (Score >9.0)
- **Channel**: Immediate notification
- **Priority**: Highest priority signals
- **Content**: RFP announcements and major digital projects

### On-Demand Access
- **Channel**: Dashboard interface
- **Access**: Real-time query capability
- **Content**: All signals with filtering options

## ⚙️ Technical Configuration

### Scraping Frequency
- **Real-time Monitoring**: Every 2 hours
- **Historical Scraping**: Configurable (up to 6 months)
- **Data Retention**: 6-month rolling window

### Historical Data Configuration
- **Start Date**: Configurable preset date
- **End Date**: Current date
- **Purpose**: Build comprehensive backlog of opportunities
- **Use Case**: Context for recent RFPs and announcements

### Data Processing
- **Signal Detection**: AI-powered content analysis
- **Scoring Algorithm**: Multi-factor weighted scoring
- **Duplicate Detection**: Automated deduplication
- **Relevance Filtering**: Industry-specific keyword matching

## 🎯 Example Signal Output

### High-Priority RFP Signal
```
🔥 HIGH-IMPACT SIGNAL DETECTED

Club: Manchester United
Signal: "Request for Proposals: Digital Platform Development"
Score: 9.5/10
Type: RFP / Digital Project
Date: 2025-01-15
Quick Actions:
• Research project scope and requirements
• Identify key stakeholders
• Draft proposal strategy
• Check for warm introductions
```

### Medium-Priority Hiring Signal
```
📊 BUSINESS INTELLIGENCE SIGNAL

Club: Arsenal
Signal: "New Head of Digital Innovation Role Posted"
Score: 6.0/10
Type: Hiring / Technology Investment
Date: 2025-01-15
Quick Actions:
• Research stakeholders at Arsenal
• Check for warm introductions
• Monitor for related technology announcements
```

## 🔧 Implementation Requirements

### Microsoft Teams Integration
- **Setup**: Client to create Teams chat group
- **Configuration**: Webhook integration
- **Testing**: Demo required during implementation

### Email Digest Setup
- **Frequency**: Daily at 9 AM
- **Recipients**: Client team members
- **Format**: HTML email with actionable insights

### Dashboard Access
- **URL**: TBD based on deployment
- **Authentication**: Client-specific access
- **Features**: Real-time signal viewing and querying

## 📈 Success Metrics

### Signal Quality
- **RFP Detection Rate**: >90% accuracy
- **False Positive Rate**: <10%
- **Response Time**: <2 hours from posting

### User Engagement
- **Teams Alert Response**: Track engagement with alerts
- **Dashboard Usage**: Monitor query frequency
- **Action Taken**: Track follow-up actions on signals

## 🚀 Next Steps

1. **Client Review**: Confirm target organizations list
2. **Teams Setup**: Configure Microsoft Teams integration
3. **Demo Configuration**: Set up demonstration environment
4. **Historical Scraping**: Configure 6-month historical data pull
5. **Testing Phase**: Validate signal detection and scoring
6. **Go-Live**: Full production deployment

---

*Document Version: 1.0*  
*Last Updated: January 2025*  
*Prepared for: Client Implementation* 