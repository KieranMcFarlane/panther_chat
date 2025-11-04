// Test syntax validation of GraphVisualizationClient
const fs = require('fs');
const content = fs.readFileSync('./src/components/graph/GraphVisualizationClient.tsx', 'utf8');

// Look for obvious syntax issues
const openParens = (content.match(/\(/g) || []).length;
const closeParens = (content.match(/\)/g) || []).length;
const openBraces = (content.match(/\{/g) || []).length;
const closeBraces = (content.match(/\}/g) || []).length;
const openBrackets = (content.match(/\[/g) || []).length;
const closeBrackets = (content.match(/\]/g) || []).length;

console.log('Parentheses:', openParens, 'open,', closeParens, 'close');
console.log('Braces:', openBraces, 'open,', closeBraces, 'close');
console.log('Brackets:', openBrackets, 'open,', closeBrackets, 'close');

// Find the problematic area around line 352
const lines = content.split('\n');
console.log('\nLines around 352:');
for (let i = 345; i <= 360; i++) {
  console.log(`${i}: ${lines[i-1]}`);
}