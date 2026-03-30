# Yellow Panther RFP Discovery - Quick Start Guide

**Purpose**: Find RFPs and digital transformation opportunities for Yellow Panther using hypothesis-driven discovery

---

## 🚀 Quick Start

### Option 1: Test Single Entity (Fast)

```bash
python test_yellow_panther_rfp_discovery.py --entity arsenal-fc
```

**Duration**: ~2-3 minutes
**Output**: Detailed RFP analysis for Arsenal FC

---

### Option 2: Test Multiple Entities

```bash
python test_yellow_panther_rfp_discovery.py --all
```

**Duration**: ~6-10 minutes (3 entities)
**Output**: RFP opportunities for Arsenal, Chelsea, Manchester United

---

## 📋 Yellow Panther Template

The `yellow_panther_agency` template detects RFPs for these services:

### 1. **Web Development** (React)
- Job postings: "React Developer", "Frontend Developer (React)"
- RFP keywords: "React web application", "SPWA development"
- Weight: 0.6 (medium priority)

### 2. **Mobile App Development**
- Job postings: "Mobile App Developer", "iOS/Android Developer"
- RFP keywords: "Mobile application", "Cross-platform app"
- Weight: 0.7 (high priority)

### 3. **Digital Transformation**
- Job postings: "Digital Transformation Manager", "Change Manager"
- RFP keywords: "Digital transformation partner", "Technology modernization"
- Weight: 0.8 (very high priority)

### 4. **E-commerce Development**
- Job postings: "E-commerce Developer", "Shopify Developer"
- RFP keywords: "E-commerce platform", "Online store"
- Weight: 0.7 (high priority)

### 5. **API Integration**
- Job postings: "API Developer", "Integration Specialist"
- RFP keywords: "API development", "System integration"
- Weight: 0.6 (medium priority)

### 6. **Fan Engagement** (Sports) 🎯
- Job postings: "Fan Engagement Manager", "Supporter Experience Director"
- RFP keywords: "Fan platform", "Supporter app"
- Weight: 0.9 (highest priority - YP specialty!)

### 7. **UI/UX Design**
- Job postings: "UI/UX Designer", "Product Designer"
- RFP keywords: "UI design project", "UX redesign"
- Weight: 0.5 (lower priority)

### 8. **Gamification**
- Job postings: "Gamification Designer", "Engagement Specialist"
- RFP keywords: "Gamification platform", "Loyalty program"
- Weight: 0.7 (high priority)

---

**Ready to find RFPs for Yellow Panther! 🎯**
