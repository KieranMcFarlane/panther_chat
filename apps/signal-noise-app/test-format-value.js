// Test the formatValue function with actual API data
const testFormatValue = (value) => {
  if (value === null || value === undefined) return "N/A"
  if (typeof value === 'string') return value
  if (typeof value === 'number') return value.toString()
  if (typeof value === 'boolean') return value ? "Yes" : "No"
  if (Array.isArray(value)) return value.map(item => testFormatValue(item)).join(", ")
  
  // Handle objects
  if (typeof value === 'object') {
    // If object has a low property (common in Neo4j numbers), use that
    if ('low' in value && value.low !== undefined) {
      return testFormatValue(value.low)
    }
    
    // If object has a value property, use that
    if ('value' in value && value.value !== undefined) {
      return testFormatValue(value.value)
    }
    
    // If object has name property, use that
    if ('name' in value && value.name !== undefined) {
      return testFormatValue(value.name)
    }
    
    // If object has score property, use that
    if ('score' in value && value.score !== undefined) {
      return testFormatValue(value.score)
    }
    
    // If object has text property, use that
    if ('text' in value && value.text !== undefined) {
      return testFormatValue(value.text)
    }
    
    // If object has amount property, use that
    if ('amount' in value && value.amount !== undefined) {
      return testFormatValue(value.amount)
    }
    
    // If empty object, return N/A
    if (Object.keys(value).length === 0) {
      return "N/A"
    }
    
    // Last resort: return JSON stringified version
    try {
      const stringValue = JSON.stringify(value)
      return stringValue === '{}' ? 'N/A' : stringValue
    } catch {
      return String(value)
    }
  }
  
  return String(value)
}

// Test data similar to what we see in the API
const testData = {
  founded: { low: 1894, high: 0 },
  digitalMaturity: { low: 18, high: 0 },
  digitalTransformationScore: { low: 80, high: 0 },
  opportunityScore: { low: 99, high: 0 },
  name: "Manchester City",
  type: "Club",
  normalString: "Regular text value",
  emptyObject: {},
  nestedObject: { value: { low: 42, high: 0 } }
}

console.log("Testing formatValue function:")
console.log("============================")

Object.entries(testData).forEach(([key, value]) => {
  const result = testFormatValue(value)
  console.log(`${key}: ${result}`)
})

console.log("\nBefore fix, these would show as [object Object]")
console.log("After fix, they should show actual values")