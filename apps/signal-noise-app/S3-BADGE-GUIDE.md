# S3 Badge Management Guide

## Overview
This guide explains how to add S3 bucket badges to map with each club and store the links in Supabase.

## What's Been Implemented

### 1. Updated Badge Service ✅
- Added `s3Url` field to `BadgeMapping` interface
- Updated `getBadgeUrl()` method to prioritize S3 URLs first
- Added `addS3BadgeMapping()` method for easy S3 badge creation
- Updated all existing badge mappings to include S3 URLs

### 2. Database Schema ✅
- Added `badge_s3_url` column to `cached_entities` table
- Updated all existing entities with S3 badge URLs

### 3. Badge Component ✅
- Re-enabled EntityBadge component in entity browser
- Added S3 source indicator (blue dot) to distinguish from other sources
- Color-coded source indicators:
  - 🔵 Blue = S3 source
  - 🟢 Green = TheSportsDB source  
  - 🟡 Yellow = Local source

### 4. S3 URL Structure ✅
Base URL: `https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/`

Current mappings:
- Manchester United: `manchester-united-badge.png`
- São Paulo FC: `sao-paulo-badge.png`
- Premier League: `premier-league-badge.png`
- Indian Premier League: `indian-premier-league-badge.png`
- Australian Football League: `australian-football-league-badge.png`
- 1. FC Köln: `1-fc-koln-badge.png`
- 1. FC Nürnberg: `1-fc-nurnberg-badge.png`
- AC Milan: `ac-milan-badge.png`
- 2. Bundesliga: `2-bundesliga-badge.png`

## How to Add New S3 Badges

### Method 1: Using Supabase MCP (Recommended)
```sql
-- Add S3 badge to a single entity
UPDATE cached_entities 
SET badge_s3_url = 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/your-club-badge.png'
WHERE neo4j_id = 'your-entity-id';

-- Add S3 badges to multiple entities
UPDATE cached_entities 
SET badge_s3_url = CASE 
  WHEN neo4j_id = 'club1' THEN 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/club1-badge.png'
  WHEN neo4j_id = 'club2' THEN 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/club2-badge.png'
  ELSE badge_s3_url
END
WHERE neo4j_id IN ('club1', 'club2');
```

### Method 2: Using Badge Service
```javascript
import { badgeService } from '@/services/badge-service';

// Add S3 badge mapping
const mapping = badgeService.addS3BadgeMapping(
  'entity-id', 
  'Entity Name',
  'custom-badge-name.png' // optional, defaults to generated name
);
```

### Method 3: Programmatic Batch Updates
Use the `s3-badge-manager.js` script for batch operations (requires proper API keys).

## S3 Bucket Configuration

### Required Permissions
Make sure your S3 bucket has the proper CORS configuration for web access:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": []
  }
]
```

### Uploading Badges to S3
1. **File Naming Convention**: Use lowercase with hyphens
   - Good: `manchester-united-badge.png`
   - Bad: `Manchester United Badge.png`

2. **Image Recommendations**:
   - Format: PNG with transparency
   - Size: Square (1:1 ratio)
   - Resolution: 256x256px or higher
   - File size: Under 100KB

3. **Upload Process**:
   ```bash
   aws s3 cp ./badge.png s3://sportsintelligence/badges/club-name-badge.png --acl public-read
   ```

## URL Priority Order

The badge service now prioritizes URLs in this order:
1. **S3 URLs** (highest priority)
2. Local paths (`/badges/`)
3. External URLs (TheSportsDB)
4. Fallback badge (lowest priority)

## Testing S3 Badges

### 1. Check S3 URL Accessibility
```bash
curl -I "https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/your-badge.png"
```

### 2. Verify in Entity Browser
- Navigate to `http://localhost:3001/entity-browser`
- Look for blue dot indicator on badges
- Badge should show S3 source in tooltip

### 3. Check Database
```sql
SELECT neo4j_id, properties->>'name' as name, badge_s3_url 
FROM cached_entities 
WHERE badge_s3_url IS NOT NULL;
```

## Troubleshooting

### S3 URLs Return 403 Forbidden
- Check S3 bucket permissions
- Ensure objects are set to public-read
- Verify CORS configuration
- Check if the badge file exists

### Badges Not Loading
- Check browser console for errors
- Verify S3 URL format
- Ensure badge service is properly initialized
- Check if entity has badge mapping

### Source Indicator Not Showing
- Ensure badge mapping has correct source field
- Check if S3 URL is properly set in database
- Verify badge component is using updated service

## Current Status

✅ **Complete**: 9 entities have S3 badge mappings
⚠️ **Note**: S3 URLs may return 403 if bucket permissions aren't configured for public access
🔄 **Ready**: System is fully configured to use S3 badges when available

The entity browser now supports S3 badges with proper fallback mechanisms and visual indicators for different badge sources.