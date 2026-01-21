# RFP Table Consolidation - Project Tickets

## Project Overview

**Goal**: Consolidate three separate RFP data sources (`rfps`, `rfp_opportunities`, `comprehensiveRfpOpportunities`) into a unified table structure for better maintainability, searchability, and analytics.

**Current State**: 
- `rfps` table: AI-detected RFPs (real-time via A2A system)
- `rfp_opportunities` table: 325 comprehensive opportunities (batch analysis)
- `comprehensiveRfpOpportunities.ts`: Static fallback data (40 opportunities)

**Target State**: Single `rfp_opportunities_unified` table with all functionality preserved.

---

## 🎫 Phase 1: Schema Migration

### Ticket #1: Design Unified RFP Table Schema
**Type**: Database Design  
**Priority**: High  
**Estimated**: 4-6 hours  
**Assignee**: Backend Developer

#### Description
Create a unified table schema that combines the best features from both existing tables while maintaining all current functionality.

#### Requirements
- [ ] Analyze existing `rfps` and `rfp_opportunities` table structures
- [ ] Design `rfp_opportunities_unified` table schema with:
  - Core RFP fields (title, organization, description, value, deadline)
  - AI detection fields (confidence_score, agent_notes, batch_id, neo4j_id)
  - Business intelligence fields (yellow_panther_fit, priority_score, category)
  - System fields (source, status, entity_id, detected_at, created_at, updated_at)
  - Enhanced metadata (link verification, contact_info, requirements)
- [ ] Create migration SQL script (`migrate-to-unified-rfps.sql`)
- [ ] Add appropriate indexes for performance
- [ ] Set up Row Level Security (RLS) policies
- [ ] Create views for common queries (active_rfps, ai_detected_rfps, comprehensive_rfps)

#### Acceptance Criteria
- [ ] Migration script creates new table without affecting existing data
- [ ] All indexes are properly created for query performance
- [ ] RLS policies match existing security model
- [ ] Views provide easy access to filtered data subsets
- [ ] Schema supports all existing functionality from both tables

#### Technical Details
**File**: `supabase-schema-rfps-unified.sql`  
**Dependencies**: None  
**Blocks**: Ticket #2 (Data Migration)

---

### Ticket #2: Create Database Migration Utilities
**Type**: Database/Backend  
**Priority**: High  
**Estimated**: 3-4 hours  
**Assignee**: Backend Developer

#### Description
Create utility scripts and functions to safely migrate data from existing tables to the new unified structure.

#### Requirements
- [ ] Create migration script that:
  - Preserves all existing data without data loss
  - Handles data type conversions between schemas
  - Maps field names correctly (rfps.* → rfp_opportunities_unified.*)
  - Maintains relationships and foreign keys
- [ ] Add data validation functions to ensure migration integrity
- [ ] Create rollback script in case of migration failure
- [ ] Add logging and progress tracking for migration monitoring

#### Acceptance Criteria
- [ ] Migration script runs successfully without errors
- [ ] All data from `rfps` table is preserved
- [ ] All data from `rfp_opportunities` table is preserved
- [ ] Data validation confirms no corruption or loss
- [ ] Rollback script successfully restores original state
- [ ] Migration logging provides clear progress tracking

#### Technical Details
**Files**: 
- `scripts/migrate-rfps-to-unified.sql`
- `scripts/rollback-rfps-migration.sql`
- `scripts/validate-rfps-migration.sql`  
**Dependencies**: Ticket #1  
**Blocks**: Ticket #3 (Data Migration Execution)

---

## 🎫 Phase 2: Data Migration

### Ticket #3: Execute Data Migration
**Type**: Database Operations  
**Priority**: High  
**Estimated**: 2-3 hours  
**Assignee**: Backend Developer + DBA

#### Description
Execute the migration of existing data from both `rfps` and `rfp_opportunities` tables into the new unified structure.

#### Requirements
- [ ] Schedule maintenance window for migration
- [ ] Create backup of existing tables before migration
- [ ] Execute migration script for `rfps` → `rfp_opportunities_unified`
- [ ] Execute migration script for `rfp_opportunities` → `rfp_opportunities_unified`
- [ ] Run data validation scripts to verify migration integrity
- [ ] Update any dependent views or procedures
- [ ] Test basic queries on new unified table

#### Acceptance Criteria
- [ ] All 325+ rows from `rfp_opportunities` successfully migrated
- [ ] All AI-detected RFPs from `rfps` table successfully migrated
- [ ] Data validation confirms 100% data integrity
- [ ] No data loss or corruption during migration
- [ ] Basic queries return expected results
- [ ] Backup successfully created and can be restored if needed

#### Technical Details
**Files**: Database execution (no code files)  
**Dependencies**: Ticket #2  
**Blocks**: Ticket #4 (Service Layer Updates)

---

### Ticket #4: Update Static Data Integration
**Type**: Backend  
**Priority**: Medium  
**Estimated**: 2-3 hours  
**Assignee**: Backend Developer

#### Description
Update the integration with `comprehensiveRfpOpportunities.ts` static data to work with the new unified table structure.

#### Requirements
- [ ] Modify data loading logic to import static data into unified table
- [ ] Create script to seed unified table with static fallback data
- [ ] Update API fallback mechanism to use unified table instead of static file
- [ ] Add data source labeling to distinguish static vs dynamic data
- [ ] Test fallback behavior when API is unavailable

#### Acceptance Criteria
- [ ] Static data can be imported into unified table
- [ ] Fallback mechanism works with unified table structure
- [ ] Data source labeling clearly identifies static vs dynamic opportunities
- [ ] System gracefully handles API unavailability
- [ ] All 40 static opportunities are properly integrated

#### Technical Details
**Files**: 
- `scripts/seed-static-rfps.sql`
- Update `src/app/api/tenders/route.ts`  
**Dependencies**: Ticket #3  
**Blocks**: Ticket #5 (Service Layer Updates)

---

## 🎫 Phase 3: Service Layer Updates

### Ticket #5: Update RFPStorageService for Unified Table
**Type**: Backend  
**Priority**: High  
**Estimated**: 6-8 hours  
**Assignee**: Backend Developer

#### Description
Update the RFPStorageService to work with the new unified table structure while preserving all existing functionality.

#### Requirements
- [ ] Update `saveToSupabase()` method to use unified table schema
- [ ] Modify `getRFPs()` method to support filtering by data source
- [ ] Update `getRFPStatistics()` to work with unified data
- [ ] Preserve hybrid Neo4j + Supabase functionality
- [ ] Add source tracking (ai-detected, comprehensive, manual, static)
- [ ] Update field mappings for new schema
- [ ] Maintain backward compatibility with existing API contracts

#### Acceptance Criteria
- [ ] AI-detected RFPs can still be saved via RFPStorageService
- [ ] Comprehensive opportunities can be retrieved with source filtering
- [ ] Statistics calculations work across all data sources
- [ ] Neo4j relationship mapping continues to function
- [ ] All existing API endpoints continue to work
- [ ] New filtering capabilities by source are functional

#### Technical Details
**Files**: 
- `src/services/RFPStorageService.ts` (major updates)
- `src/lib/supabase-client.ts` (if needed)  
**Dependencies**: Ticket #4  
**Blocks**: Ticket #6 (API Endpoint Updates)

---

### Ticket #6: Consolidate API Endpoints
**Type**: Backend  
**Priority**: Medium  
**Estimated**: 4-6 hours  
**Assignee**: Backend Developer

#### Description
Consolidate RFP-related API endpoints to use the unified table while maintaining backward compatibility.

#### Requirements
- [ ] Update `/api/tenders` to use unified table with source filtering
- [ ] Add query parameters for source filtering (`?source=ai-detected,comprehensive`)
- [ ] Consolidate any redundant RFP-related endpoints
- [ ] Update response format to include source information
- [ ] Maintain backward compatibility for existing UI code
- [ ] Add new endpoints for advanced filtering if needed

#### Acceptance Criteria
- [ ] `/api/tenders` returns unified data from single table
- [ ] Source filtering works correctly
- [ ] Response format includes source information
- [ ] Existing UI continues to function without changes
- [ ] API performance is maintained or improved
- [ ] Error handling works correctly for all scenarios

#### Technical Details
**Files**: 
- `src/app/api/tenders/route.ts`
- Any other RFP-related API endpoints  
**Dependencies**: Ticket #5  
**Blocks**: Ticket #7 (UI Integration)

---

## 🎫 Phase 4: UI Integration

### Ticket #7: Update Tenders Page for Unified Data
**Type**: Frontend  
**Priority**: Medium  
**Estimated**: 6-8 hours  
**Assignee**: Frontend Developer

#### Description
Update the `/tenders` page to use the unified data source while preserving the visual distinction between AI-detected and comprehensive opportunities.

#### Requirements
- [ ] Update data fetching to use unified API endpoints
- [ ] Preserve visual distinction between AI-detected and comprehensive opportunities
- [ ] Add source filtering options to the UI
- [ ] Update statistics calculations to use unified data
- [ ] Maintain real-time AI detection capabilities
- [ ] Ensure all existing filtering and search functionality works
- [ ] Test the toggle functionality between different data sources

#### Acceptance Criteria
- [ ] Page loads with unified data from single source
- [ ] Visual distinction between AI-detected and comprehensive opportunities is preserved
- [ ] Source filtering controls work correctly
- [ ] Real-time AI detection continues to function
- [ ] All existing search and filter functionality works
- [ ] Statistics reflect unified data accurately
- [ ] Performance is maintained or improved

#### Technical Details
**Files**: 
- `src/app/tenders/page.tsx` (major updates)
- `src/components/rfp/` (if any components need updates)  
**Dependencies**: Ticket #6  

---

### Ticket #8: Enhanced Filtering and Analytics
**Type**: Frontend  
**Priority**: Low  
**Estimated**: 4-6 hours  
**Assignee**: Frontend Developer

#### Description
Add enhanced filtering and analytics capabilities made possible by the unified data structure.

#### Requirements
- [ ] Add advanced filtering by data source, detection method, and time periods
- [ ] Create unified analytics dashboard showing cross-source insights
- [ ] Add export functionality for filtered datasets
- [ ] Implement comparison views between AI-detected and comprehensive opportunities
- [ ] Add trend analysis over time with unified data
- [ ] Create saved filter functionality for common queries

#### Acceptance Criteria
- [ ] Users can filter by multiple criteria simultaneously
- [ ] Analytics dashboard shows comprehensive insights
- [ ] Export functionality works for all filtered datasets
- [ ] Comparison views provide valuable insights
- [ ] Trend analysis shows historical patterns
- [ ] Saved filters can be created and reused

#### Technical Details
**Files**: 
- `src/app/tenders/page.tsx` (enhancements)
- Possibly new analytics components  
**Dependencies**: Ticket #7  

---

## 🎫 Future Enhancements (Post-Consolidation)

### Ticket #9: Advanced Deduplication
**Type**: Backend/Data Science  
**Priority**: Low  
**Estimated**: 8-12 hours  
**Assignee**: Backend Developer + Data Scientist

#### Description
Implement intelligent deduplication across the unified dataset to identify and merge similar opportunities from different sources.

#### Requirements
- [ ] Create similarity scoring algorithm for RFP opportunities
- [ ] Implement duplicate detection based on title, organization, and description
- [ ] Create merge functionality for duplicate opportunities
- [ ] Add manual review workflow for potential duplicates
- [ ] Track deduplication history and decisions

#### Acceptance Criteria
- [ ] Similarity scoring accurately identifies potential duplicates
- [ ] Manual review workflow allows for thoughtful duplicate handling
- [ ] Merge functionality preserves best data from each duplicate
- [ ] System learns from manual decisions over time

#### Technical Details
**Files**: New deduplication service and API endpoints  
**Dependencies**: Ticket #8  

---

### Ticket #10: Historical Analytics and Reporting
**Type**: Backend + Frontend  
**Priority**: Low  
**Estimated**: 10-15 hours  
**Assignee**: Full Stack Developer

#### Description
Build comprehensive analytics and reporting capabilities on the unified dataset.

#### Requirements
- [ ] Create historical trend analysis dashboards
- [ ] Build conversion tracking from detection to pursuit to win/loss
- [ ] Implement source effectiveness analytics
- [ ] Create automated reporting with insights
- [ ] Add data visualization for key metrics

#### Acceptance Criteria
- [ ] Historical trends are clearly visualized
- [ ] Conversion funnels show opportunity lifecycle
- [ ] Source effectiveness is accurately measured
- [ ] Automated reports provide actionable insights
- [ ] Data visualizations are interactive and informative

#### Technical Details
**Files**: New analytics pages and API endpoints  
**Dependencies**: Ticket #9  

---

## 📋 Implementation Plan

### Sprint 1 (Week 1-2): Foundation
- **Ticket #1**: Design Unified Table Schema
- **Ticket #2**: Create Migration Utilities

### Sprint 2 (Week 2-3): Migration
- **Ticket #3**: Execute Data Migration
- **Ticket #4**: Update Static Data Integration

### Sprint 3 (Week 4-5): Backend Updates
- **Ticket #5**: Update RFPStorageService
- **Ticket #6**: Consolidate API Endpoints

### Sprint 4 (Week 6-7): Frontend Integration
- **Ticket #7**: Update Tenders Page
- **Ticket #8**: Enhanced Filtering and Analytics

### Future Sprints: Advanced Features
- **Ticket #9**: Advanced Deduplication
- **Ticket #10**: Historical Analytics

---

## 🚨 Critical Path & Dependencies

```
Ticket #1 (Schema) → Ticket #2 (Utilities) → Ticket #3 (Migration) 
    ↓
Ticket #4 (Static Data) → Ticket #5 (Service Layer) → Ticket #6 (API) 
    ↓
Ticket #7 (UI) → Ticket #8 (Enhancements) → Ticket #9 (Deduplication) → Ticket #10 (Analytics)
```

**Critical Path**: Tickets #1 → #2 → #3 → #5 → #6 → #7 must be completed for basic functionality.

**Parallel Work**: Tickets #4 and #8 can be worked on in parallel with their dependencies.

---

## ⚠️ Risks and Mitigations

### High Risk
- **Data Loss During Migration**: Mitigated by comprehensive backups and validation
- **Performance Degradation**: Mitigated by proper indexing and query optimization
- **Breaking Existing Functionality**: Mitigated by thorough testing and backward compatibility

### Medium Risk
- **API Compatibility Issues**: Mitigated by maintaining existing response formats
- **UI Performance Issues**: Mitigated by pagination and efficient data loading
- **User Confusion**: Mitigated by clear UI labeling and documentation

### Low Risk
- **Feature Creep**: Mitigated by clear ticket scope and acceptance criteria
- **Coordination Delays**: Mitigated by clear dependencies and parallel work streams

---

## 🎯 Success Metrics

### Technical Metrics
- [ ] Zero data loss during migration
- [ ] API response time ≤ current performance
- [ ] 100% backward compatibility maintained
- [ ] All existing tests continue to pass

### Business Metrics
- [ ] User can access all RFP data from single interface
- [ ] Improved searchability across all opportunity types
- [ ] Enhanced analytics provide actionable insights
- [ ] System maintenance effort reduced by 50%

### User Experience Metrics
- [ ] Page load time ≤ 3 seconds
- [ ] Search results returned in ≤ 2 seconds
- [ ] All existing functionality preserved
- [ ] New filtering capabilities are intuitive

---

*Last Updated: November 2025*  
*Project Owner: Development Team*  
*Review Date: Weekly during sprints*