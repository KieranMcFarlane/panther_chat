const fs = require('fs');
const path = require('path');

// Read all RFP analysis batch files
const rfpDir = path.join(__dirname, '../rfp-analysis-results');
const batchFiles = fs.readdirSync(rfpDir)
  .filter(file => file.includes('BATCH-250-ENTITIES-RFP-ANALYSIS.json'))
  .sort();

console.log(`Found ${batchFiles.length} batch files to process...`);

// Collect all confirmed RFP opportunities
let allRfps = [];

batchFiles.forEach((file, index) => {
  try {
    const filePath = path.join(rfpDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    if (data.confirmed_rfp_opportunities) {
      data.confirmed_rfp_opportunities.forEach(rfp => {
        allRfps.push({
          ...rfp,
          batch_number: data.analysis_summary.batch_number,
          file_source: file
        });
      });
    }
    
    console.log(`Batch ${index + 1}: ${data.confirmed_rfp_opportunities?.length || 0} RFPs found`);
  } catch (error) {
    console.error(`Error processing ${file}:`, error.message);
  }
});

console.log(`\nTotal RFPs collected: ${allRfps.length}`);

// Sort by value (highest first) and then by deadline urgency
allRfps.sort((a, b) => {
  // Extract numeric values for comparison
  const aValue = parseInt(a.estimated_value.match(/£(\d+)K?/)?.[1] || '0');
  const bValue = parseInt(b.estimated_value.match(/£(\d+)K?/)?.[1] || '0');
  
  // Primary sort by value (descending)
  if (bValue !== aValue) {
    return bValue - aValue;
  }
  
  // Secondary sort by deadline urgency
  const aUrgent = a.deadline && a.deadline.includes('2025');
  const bUrgent = b.deadline && b.deadline.includes('2025');
  
  if (aUrgent && !bUrgent) return -1;
  if (!aUrgent && bUrgent) return 1;
  
  return 0;
});

// Generate HTML for tender cards
function generateTenderCard(rfp, index) {
  // Determine days until deadline
  let daysUntil = 365; // Default for no deadline
  let priority = '5/10';
  
  if (rfp.deadline) {
    const today = new Date();
    const deadlineMatch = rfp.deadline.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (deadlineMatch) {
      const [, day, month, year] = deadlineMatch;
      const deadline = new Date(`${year}-${month}-${day}`);
      daysUntil = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
      
      if (daysUntil <= 7) priority = '10/10';
      else if (daysUntil <= 30) priority = '9/10';
      else if (daysUntil <= 60) priority = '8/10';
      else if (daysUntil <= 90) priority = '7/10';
    }
  }
  
  // Determine status color
  const fitScore = rfp.yellow_panther_fit_score || 85;
  let statusColor = 'bg-green-500';
  if (fitScore < 80) statusColor = 'bg-red-500';
  else if (fitScore < 90) statusColor = 'bg-yellow-500';
  
  // Format deadline display
  let deadlineDisplay = 'No deadline';
  if (rfp.deadline) {
    if (daysUntil <= 365) {
      deadlineDisplay = `${daysUntil} days`;
    } else {
      deadlineDisplay = rfp.deadline;
    }
  }
  
  // Determine status
  let status = 'qualified';
  if (rfp.status && rfp.status.toUpperCase() === 'ACTIVE') status = 'active';
  if (rfp.status && rfp.status.toUpperCase().includes('COMPLETED')) status = 'completed';
  if (daysUntil < 0) status = 'expired';
  
  // Create category from entity type
  let category = 'Sports Technology';
  if (rfp.entity_type?.includes('International Federation')) category = 'International Federation';
  else if (rfp.entity_type?.includes('Government')) category = 'Government';
  else if (rfp.entity_type?.includes('National Federation')) category = 'National Federation';
  else if (rfp.entity_type?.includes('Professional League')) category = 'Professional League';
  
  // Get country/location
  let location = 'Global';
  if (rfp.entity_name?.includes('USA') || rfp.entity_name?.includes('American')) location = 'USA';
  else if (rfp.entity_name?.includes('India') || rfp.entity_name?.includes('Indian')) location = 'India';
  else if (rfp.entity_name?.includes('Australia') || rfp.entity_name?.includes('Australian')) location = 'Australia';
  else if (rfp.entity_name?.includes('Canada') || rfp.entity_name?.includes('Canadian')) location = 'Canada';
  else if (rfp.entity_name?.includes('UK') || rfp.entity_name?.includes('British')) location = 'UK';
  else if (rfp.entity_name?.includes('France') || rfp.entity_name?.includes('French')) location = 'France';
  else if (rfp.entity_name?.includes('Saudi') || rfp.entity_name?.includes('Arabia')) location = 'Saudi Arabia';
  
  // Truncate description
  const description = rfp.description?.substring(0, 150) + '...' || 'No description available';
  
  return `
    <div class="rounded-lg border bg-card text-card-foreground shadow-sm hover:shadow-lg transition-shadow">
      <div class="flex flex-col space-y-1.5 p-6">
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <h3 class="font-semibold tracking-tight text-lg mb-2">${rfp.rfp_title}</h3>
            <div class="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-building2 w-4 h-4">
                <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"></path>
                <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"></path>
                <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"></path>
                <path d="M10 6h4"></path>
                <path d="M10 10h4"></path>
                <path d="M10 14h4"></path>
                <path d="M10 18h4"></path>
              </svg>
              <span>${rfp.entity_name}</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin w-4 h-4 ml-2">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              <span>${location}</span>
            </div>
          </div>
          <div class="flex flex-col items-end gap-2">
            <div class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">${status}</div>
            <div class="px-2 py-1 rounded text-white text-xs ${statusColor}">${fitScore}% Fit</div>
          </div>
        </div>
      </div>
      <div class="p-6 pt-0">
        <p class="text-sm text-muted-foreground mb-4 line-clamp-2">${description}</p>
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-4 text-sm">
            <div class="flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pound-sterling w-4 h-4">
                <path d="M18 7c0-5.333-8-5.333-8 0"></path>
                <path d="M10 7v14"></path>
                <path d="M6 21h12"></path>
                <path d="M6 13h10"></path>
              </svg>
              <span class="font-medium">${rfp.estimated_value}</span>
            </div>
            <div class="flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clock w-4 h-4">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span class="">${deadlineDisplay}</span>
            </div>
          </div>
          <div class="flex items-center gap-1 text-xs text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-target w-3 h-3">
              <circle cx="12" cy="12" r="10"></circle>
              <circle cx="12" cy="12" r="6"></circle>
              <circle cx="12" cy="12" r="2"></circle>
            </svg>
            <span>Priority: ${priority}</span>
          </div>
        </div>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground text-xs">${category}</div>
            <div class="inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground text-xs">RFP</div>
          </div>
          <div class="flex gap-2">
            <button class="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 rounded-md px-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye w-4 h-4 mr-1">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>View
            </button>
            <a href="${rfp.source_url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 rounded-md px-3 flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-external-link w-4 h-4 mr-1">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" x2="21" y1="14" y2="3"></line>
              </svg>Source
            </a>
          </div>
        </div>
      </div>
    </div>`;
}

// Generate HTML grid with top 6 RFPs
const topRfps = allRfps.slice(0, 6);
const tenderCardsHtml = topRfps.map((rfp, index) => generateTenderCard(rfp, index)).join('\n');

// Calculate summary stats
const totalValue = allRfps.reduce((sum, rfp) => {
  const value = parseInt(rfp.estimated_value.match(/£(\d+)K?/)?.[1] || '0');
  return sum + value;
}, 0);

const urgentDeadlines = allRfps.filter(rfp => {
  if (!rfp.deadline) return false;
  const deadlineMatch = rfp.deadline.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!deadlineMatch) return false;
  const [, day, month, year] = deadlineMatch;
  const deadline = new Date(`${year}-${month}-${day}`);
  const daysUntil = Math.ceil((deadline - new Date()) / (1000 * 60 * 60 * 24));
  return daysUntil <= 30;
}).length;

console.log('\n=== Generated Tenders Summary ===');
console.log(`Top RFPs displayed: ${topRfps.length}`);
console.log(`Total opportunities in database: ${allRfps.length}`);
console.log(`Total pipeline value: £${totalValue}K`);
console.log(`Urgent deadlines (30 days): ${urgentDeadlines}`);

console.log('\n=== Top Opportunities ===');
topRfps.forEach((rfp, index) => {
  console.log(`${index + 1}. ${rfp.rfp_title} - ${rfp.estimated_value} (${rfp.entity_name})`);
});

// Output the HTML
console.log('\n=== Generated HTML ===');
console.log('Copy this HTML to replace the current tender cards:');
console.log('='.repeat(50));
console.log(`<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">`);
console.log(tenderCardsHtml);
console.log(`</div>`);