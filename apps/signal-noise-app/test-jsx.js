// Test minimal version of the problematic JSX
const testJSX = `
import React from 'react';

export default function Test() {
  const isContextPanelOpen = true;
  const selectedNode = { id: 1 };
  
  return (
    <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1">
          <div className="bg-custom-box border-custom-border rounded-lg p-4">
            <h2 className="text-xl text-white mb-4">Test</h2>
          </div>
        </div>
        <div className="lg:w-80">
          <div className="bg-custom-box border-custom-border rounded-lg p-4">
            <div className="space-y-4">
              <div>
                <select>
                  <option value="all">All Types</option>
                </select>
              </div>
              <div className="text-sm text-fm-medium-grey">
                <div>Test Content</div>
              </div>
              <button onClick={() => {}}>
                Reset View
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Context Panel */}
      {isContextPanelOpen && selectedNode && (
        <div>Context Panel Content</div>
      )}
    </div>
  );
}
`;

console.log('Testing minimal JSX syntax...');
// Try to parse it with Node.js
try {
  new Function(testJSX);
  console.log('Syntax appears to be valid');
} catch (e) {
  console.log('Syntax error:', e.message);
}