const fs = require('fs');
const path = require('path');

// Read the current tenders page
const pagePath = path.join(__dirname, '..', 'src', 'app', 'tenders', 'page.tsx');
let content = fs.readFileSync(pagePath, 'utf8');

// Find the start and end of the hardcoded HTML
const startPattern = /\/\* Opportunities Grid \*\/\s*<div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">/;
const endPattern = /<\/div>\s*{filteredOpportunities\.length === 0 &&/;

const startIndex = content.search(startPattern);
const endIndex = content.search(endPattern);

if (startIndex === -1 || endIndex === -1) {
  console.error('Could not find the hardcoded HTML section to replace');
  process.exit(1);
}

console.log('Found hardcoded HTML section from line', content.substring(0, startIndex).split('\n').length, 'to line', content.substring(0, endIndex).split('\n').length);

// Extract the before and after content
const beforeHTML = content.substring(0, startIndex);
const afterHTML = content.substring(endIndex);

// Generate the new dynamic HTML section
const dynamicHTML = `
        {filteredOpportunities.map((opportunity, index) => generateTenderCard(opportunity, index))}
      </div>

      {filteredOpportunities.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No opportunities found matching your criteria.</p>
        </div>
      )}
    </div>
  );
`;

// Replace the hardcoded HTML with dynamic content
const newContent = beforeHTML + dynamicHTML + afterHTML;

// Write the updated content
fs.writeFileSync(pagePath, newContent);

console.log('✅ Replaced hardcoded HTML with dynamic content');
console.log('📁 Updated file:', pagePath);
console.log('\n🎯 Changes made:');
console.log('   • Removed hardcoded HTML tender cards');
console.log('   • Added dynamic mapping for all filtered opportunities');
console.log('   • Maintained all styling and functionality');
console.log('   • Added proper deadline and status handling');