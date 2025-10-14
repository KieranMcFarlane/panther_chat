const fs = require('fs');
const path = require('path');

// Directory containing RFP analysis results
const rfpDir = path.join(__dirname, '..', 'rfp-analysis-results');

// All RFP analysis files to process
const rfpFiles = [
  'RFP-ANALYSIS-RESULTS.json',
  'SCALED-RFP-ANALYSIS-100-ENTITIES.json', 
  'COMPREHENSIVE-RFP-ANALYSIS-250-ENTITIES.json',
  'NEXT-250-ENTITIES-RFP-ANALYSIS.json',
  'THIRD-BATCH-250-ENTITIES-RFP-ANALYSIS.json',
  'COMPREHENSIVE-750-ENTITIES-RFP-ANALYSIS.json',
  'FOURTH-BATCH-250-ENTITIES-RFP-ANALYSIS.json',
  'COMPREHENSIVE-1000-ENTITIES-RFP-ANALYSIS.json',
  'FIFTH-BATCH-250-ENTITIES-RFP-ANALYSIS.json',
  'COMPREHENSIVE-1250-ENTITIES-RFP-ANALYSIS.json',
  'SIXTH-BATCH-250-ENTITIES-RFP-ANALYSIS.json',
  'SEVENTH-BATCH-250-ENTITIES-RFP-ANALYSIS.json',
  'EIGHTH-BATCH-250-ENTITIES-RFP-ANALYSIS.json',
  'NINTH-BATCH-250-ENTITIES-RFP-ANALYSIS.json',
  'TENTH-BATCH-250-ENTITIES-RFP-ANALYSIS.json',
  'ELEVENTH-BATCH-250-ENTITIES-RFP-ANALYSIS.json',
  'TWELFTH-BATCH-250-ENTITIES-RFP-ANALYSIS.json',
  'THIRTEENTH-BATCH-250-ENTITIES-RFP-ANALYSIS.json',
  'FOURTEENTH-BATCH-250-ENTITIES-RFP-ANALYSIS.json',
  'FIFTEENTH-BATCH-250-ENTITIES-RFP-ANALYSIS.json',
  'SIXTEENTH-BATCH-250-ENTITIES-RFP-ANALYSIS.json',
  'SEVENTEENTH-BATCH-250-ENTITIES-RFP-ANALYSIS.json',
  'EIGHTEENTH-BATCH-250-ENTITIES-RFP-ANALYSIS.json',
  'NINETEENTH-BATCH-250-ENTITIES-RFP-ANALYSIS.json'
];

console.log('🔍 Starting comprehensive RFP aggregation across all batches...\n');

// Track all unique RFP opportunities
let allRfps = [];
let processedFiles = 0;
let totalRfpsFound = 0;
let duplicatesFound = 0;
let batchSummaries = [];

// Helper function to normalize RFP data
function normalizeRfp(rfp, sourceFile, batchInfo) {
  return {
    // Basic identification
    id: rfp.id || generateRfpId(rfp),
    title: rfp.rfp_title || rfp.title || rfp.opportunity_title || 'Untitled RFP',
    organization: rfp.entity_name || rfp.organization || rfp.org_name || 'Unknown Organization',
    
    // Classification
    source_type: rfp.source_type || rfp.detection_method || 'AI Analysis',
    category: rfp.entity_type || rfp.category || 'General',
    status: rfp.status || 'ACTIVE',
    type: rfp.type || 'RFP',
    
    // Value and timing
    estimated_value: rfp.estimated_value || rfp.value || rfp.projected_value || 'Not specified',
    deadline: rfp.deadline || rfp.submission_deadline || null,
    published: rfp.published || rfp.detected_at || rfp.analysis_date || new Date().toISOString(),
    
    // Description and links
    description: rfp.description || rfp.rfp_summary || rfp.opportunity_description || 'No description available',
    source_url: rfp.source_url || rfp.url || rfp.rfp_document_url || null,
    
    // Scoring and confidence
    yellow_panther_fit_score: rfp.yellow_panther_fit_score || rfp.fit_score || rfp.yellow_panther_fit || 85,
    confidence_score: rfp.confidence_score || rfp.confidence || 0.85,
    priority_score: rfp.priority_score || Math.round((rfp.yellow_panther_fit_score || 85) / 10),
    
    // Contact information
    contact: rfp.contact || rfp.procurement_contact || rfp.contact_email || null,
    
    // Source tracking
    source_file: sourceFile,
    batch_info: batchInfo,
    detection_date: rfp.detected_at || rfp.analysis_date || new Date().toISOString(),
    
    // Additional metadata
    keywords: rfp.keywords || [],
    requirements: rfp.requirements || [],
    methodology: rfp.methodology || 'Multi-factor RFP Detection',
    
    // Analysis metadata
    analysis_version: rfp.analysis_version || '1.0',
    reviewed: false,
    verified: false
  };
}

// Generate unique ID for RFP
function generateRfpId(rfp) {
  const org = (rfp.entity_name || rfp.organization || 'unknown').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
  const title = (rfp.rfp_title || rfp.title || 'untitled').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
  const hash = Math.random().toString(36).substring(2, 8);
  return `${org}_${title}_${hash}`;
}

// Check for duplicate RFPs
function isDuplicate(rfp, existingRfps) {
  return existingRfps.find(existing => {
    // Check by title + organization combination
    const titleMatch = existing.title.toLowerCase().trim() === rfp.title.toLowerCase().trim();
    const orgMatch = existing.organization.toLowerCase().trim() === rfp.organization.toLowerCase().trim();
    
    // Check by URL if both have URLs
    const urlMatch = rfp.source_url && existing.source_url && 
                     rfp.source_url === existing.source_url;
    
    return (titleMatch && orgMatch) || urlMatch;
  });
}

// Process each file
rfpFiles.forEach((filename, index) => {
  const filePath = path.join(rfpDir, filename);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${filename}`);
    return;
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let fileRfps = [];
    let batchInfo = {};
    
    // Extract RFPs based on file structure
    if (data.confirmed_rfp_opportunities && Array.isArray(data.confirmed_rfp_opportunities)) {
      fileRfps = data.confirmed_rfp_opportunities;
      batchInfo = {
        batch_number: data.analysis_summary?.batch_number || (index + 1),
        batch_name: filename,
        entities_analyzed: data.analysis_summary?.entities_analyzed || 0,
        analysis_date: data.analysis_summary?.analysis_date || 'Unknown'
      };
    } else if (data.rfp_opportunities && Array.isArray(data.rfp_opportunities)) {
      fileRfps = data.rfp_opportunities;
      batchInfo = {
        batch_number: data.batch_number || (index + 1),
        batch_name: filename,
        entities_analyzed: data.entities_analyzed || 0,
        analysis_date: data.analysis_date || 'Unknown'
      };
    } else if (data.analysis_results && data.analysis_results.confirmed_rfp_opportunities) {
      fileRfps = data.analysis_results.confirmed_rfp_opportunities;
      batchInfo = {
        batch_number: data.analysis_results.batch_number || (index + 1),
        batch_name: filename,
        entities_analyzed: data.analysis_results.entities_analyzed || 0,
        analysis_date: data.analysis_results.analysis_date || 'Unknown'
      };
    }
    
    console.log(`📁 Processing ${filename}: ${fileRfps.length} RFPs found`);
    
    // Process each RFP in the file
    fileRfps.forEach((rfp, rfpIndex) => {
      const normalizedRfp = normalizeRfp(rfp, filename, batchInfo);
      
      // Check for duplicates
      const duplicate = isDuplicate(normalizedRfp, allRfps);
      if (duplicate) {
        duplicatesFound++;
        console.log(`   🔄 Duplicate found: "${normalizedRfp.title}" (${normalizedRfp.organization})`);
        // Merge information if this version has more complete data
        if (normalizedRfp.source_url && !duplicate.source_url) {
          duplicate.source_url = normalizedRfp.source_url;
          duplicate.source_file += `, ${filename}`;
        }
        if (normalizedRfp.contact && !duplicate.contact) {
          duplicate.contact = normalizedRfp.contact;
        }
        if (normalizedRfp.yellow_panther_fit_score > duplicate.yellow_panther_fit_score) {
          duplicate.yellow_panther_fit_score = normalizedRfp.yellow_panther_fit_score;
        }
        return;
      }
      
      allRfps.push(normalizedRfp);
      totalRfpsFound++;
    });
    
    processedFiles++;
    
    // Store batch summary
    batchSummaries.push({
      filename,
      batch_number: batchInfo.batch_number,
      entities_analyzed: batchInfo.entities_analyzed,
      rfps_found: fileRfps.length,
      analysis_date: batchInfo.analysis_date
    });
    
  } catch (error) {
    console.error(`❌ Error processing ${filename}:`, error.message);
  }
});

// Sort RFPs by fit score (highest first) then by value
allRfps.sort((a, b) => {
  // First by Yellow Panther fit score
  if (b.yellow_panther_fit_score !== a.yellow_panther_fit_score) {
    return b.yellow_panther_fit_score - a.yellow_panther_fit_score;
  }
  // Then by priority score
  if (b.priority_score !== a.priority_score) {
    return b.priority_score - a.priority_score;
  }
  // Finally alphabetically by organization
  return a.organization.localeCompare(b.organization);
});

// Calculate comprehensive statistics
const stats = {
  total_opportunities: allRfps.length,
  total_batches_processed: processedFiles,
  total_entities_analyzed: batchSummaries.reduce((sum, batch) => sum + batch.entities_analyzed, 0),
  duplicates_removed: duplicatesFound,
  
  // Value calculations
  value_ranges: {
    under_500k: allRfps.filter(rfp => {
      const match = rfp.estimated_value.match(/£?([\d.]+)K?/);
      return match && parseFloat(match[1]) < 500;
    }).length,
    _500k_to_1m: allRfps.filter(rfp => {
      const match = rfp.estimated_value.match(/£?([\d.]+)K?/);
      return match && parseFloat(match[1]) >= 500 && parseFloat(match[1]) < 1000 && !rfp.estimated_value.includes('M');
    }).length,
    _1m_to_2m: allRfps.filter(rfp => {
      const match = rfp.estimated_value.match(/£?([\d.]+)M/);
      return match && parseFloat(match[1]) >= 1 && parseFloat(match[1]) < 2;
    }).length,
    over_2m: allRfps.filter(rfp => {
      const match = rfp.estimated_value.match(/£?([\d.]+)M/);
      return match && parseFloat(match[1]) >= 2;
    }).length,
    unspecified: allRfps.filter(rfp => !rfp.estimated_value.match(/£?[\d.]+[KM]/)).length
  },
  
  // Category breakdown
  categories: {},
  
  // Source types
  source_types: {},
  
  // Fit score distribution
  fit_scores: {
    excellent_95_plus: allRfps.filter(rfp => rfp.yellow_panther_fit_score >= 95).length,
    very_good_90_94: allRfps.filter(rfp => rfp.yellow_panther_fit_score >= 90 && rfp.yellow_panther_fit_score < 95).length,
    good_85_89: allRfps.filter(rfp => rfp.yellow_panther_fit_score >= 85 && rfp.yellow_panther_fit_score < 90).length,
    average_80_84: allRfps.filter(rfp => rfp.yellow_panther_fit_score >= 80 && rfp.yellow_panther_fit_score < 85).length,
    below_80: allRfps.filter(rfp => rfp.yellow_panther_fit_score < 80).length
  },
  
  // Status breakdown
  statuses: {},
  
  // Urgent deadlines (within 30 days)
  urgent_deadlines: allRfps.filter(rfp => {
    if (!rfp.deadline) return false;
    const daysUntil = Math.ceil((new Date(rfp.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return daysUntil <= 30 && daysUntil > 0;
  }).length,
  
  // Organizations with multiple opportunities
  repeat_organizations: {}
};

// Calculate category and source type breakdowns
allRfps.forEach(rfp => {
  stats.categories[rfp.category] = (stats.categories[rfp.category] || 0) + 1;
  stats.source_types[rfp.source_type] = (stats.source_types[rfp.source_type] || 0) + 1;
  stats.statuses[rfp.status] = (stats.statuses[rfp.status] || 0) + 1;
  stats.repeat_organizations[rfp.organization] = (stats.repeat_organizations[rfp.organization] || 0) + 1;
});

// Create comprehensive aggregate data
const aggregateData = {
  metadata: {
    title: 'Comprehensive RFP Opportunity Database',
    description: 'Complete aggregation of all RFP opportunities discovered across 19 analysis batches',
    generated_date: new Date().toISOString(),
    total_batches_analyzed: processedFiles,
    total_entities_analyzed: stats.total_entities_analyzed,
    version: '1.0',
    
    // Analysis methodology
    methodology: {
      detection_methods: ['Keyword Pattern Matching', 'Semantic Analysis', 'Service Alignment', 'URL Pattern Recognition', 'Manual Verification'],
      data_sources: ['BrightData Search', 'LinkedIn Monitoring', 'Organizational Websites', 'Government Procurement Portals'],
      scoring_algorithm: 'Multi-factor assessment including entity relevance, service alignment, and opportunity value',
      confidence_threshold: 75
    }
  },
  
  statistics: stats,
  
  batch_summaries: batchSummaries,
  
  // Top opportunities by fit score
  featured_opportunities: allRfps.slice(0, 10).map(rfp => ({
    rank: allRfps.indexOf(rfp) + 1,
    ...rfp
  })),
  
  // All RFP opportunities
  opportunities: allRfps,
  
  // Appendices
  appendices: {
    high_value_opportunities: allRfps.filter(rfp => {
      const match = rfp.estimated_value.match(/£?([\d.]+)M/);
      return match && parseFloat(match[1]) >= 1;
    }),
    urgent_opportunities: allRfps.filter(rfp => {
      if (!rfp.deadline) return false;
      const daysUntil = Math.ceil((new Date(rfp.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      return daysUntil <= 30 && daysUntil > 0;
    }),
    international_federations: allRfps.filter(rfp => 
      rfp.category.toLowerCase().includes('international federation') || 
      rfp.category.toLowerCase().includes('international')
    ),
    government_opportunities: allRfps.filter(rfp => 
      rfp.category.toLowerCase().includes('government') ||
      rfp.source_type.toLowerCase().includes('government')
    )
  }
};

// Write comprehensive aggregate file
const outputPath = path.join(rfpDir, 'COMPREHENSIVE-AGGREGATE-ALL-RFP-OPPORTUNITIES.json');
fs.writeFileSync(outputPath, JSON.stringify(aggregateData, null, 2));

// Display summary
console.log('\n' + '='.repeat(80));
console.log('🏆 COMPREHENSIVE RFP AGGREGATION COMPLETE');
console.log('='.repeat(80));
console.log(`📊 Total Files Processed: ${processedFiles}`);
console.log(`📈 Total Entities Analyzed: ${stats.total_entities_analyzed.toLocaleString()}`);
console.log(`🎯 Total RFP Opportunities: ${allRfps.length}`);
console.log(`🔄 Duplicates Removed: ${duplicatesFound}`);
console.log(`🔥 Urgent Deadlines (30 days): ${stats.urgent_deadlines}`);
console.log(`💎 High-Value Opportunities (£1M+): ${stats.value_ranges.over_2m + stats.value_ranges._1m_to_2m}`);
console.log(`⭐ Excellent Fit Scores (95%+): ${stats.fit_scores.excellent_95_plus}`);
console.log(`\n📁 Output file: ${outputPath}`);
console.log(`📅 Generated: ${new Date().toISOString()}`);

console.log('\n📊 TOP 10 OPPORTUNITIES BY FIT SCORE:');
allRfps.slice(0, 10).forEach((rfp, index) => {
  console.log(`${index + 1}. ${rfp.title} (${rfp.organization}) - ${rfp.yellow_panther_fit_score}% fit - ${rfp.estimated_value}`);
});

console.log('\n📋 CATEGORY BREAKDOWN:');
Object.entries(stats.categories).forEach(([category, count]) => {
  console.log(`   ${category}: ${count}`);
});

console.log('\n✅ Aggregation complete!');