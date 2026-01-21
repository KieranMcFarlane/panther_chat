/**
 * Enhanced formatValue utility function for handling Neo4j data and various data types
 * Prevents React rendering errors with Neo4j timestamp objects
 */

export function formatValue(value: any): string {
  if (value === null || value === undefined) return "N/A"
  if (typeof value === 'string') return value
  if (typeof value === 'number') return value.toString()
  if (typeof value === 'boolean') return value ? "Yes" : "No"
  if (Array.isArray(value)) return value.map(item => formatValue(item)).join(", ")
  
  // Handle objects
  if (typeof value === 'object') {
    // Handle Neo4j timestamp objects with {low, high} structure (more comprehensive)
    if (value && typeof value === 'object' && 'low' in value && 'high' in value) {
      if (typeof value.low === 'number' && typeof value.high === 'number') {
        // Convert Neo4j timestamp to JavaScript Date
        // Neo4j timestamps are stored as milliseconds since epoch
        const timestamp = value.low
        const date = new Date(timestamp)
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
          })
        }
      }
      
      // Handle nested {low, high} structures (like in year.month.day)
      const checkNestedStructure = (obj) => {
        if (obj && typeof obj === 'object' && 'low' in obj && 'high' in obj && typeof obj.low === 'number') {
          return obj.low
        }
        return obj
      }
      
      // Try to extract timestamp from nested structure
      const timestamp = checkNestedStructure(value)
      if (typeof timestamp === 'number') {
        const date = new Date(timestamp)
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
          })
        }
      }
    }
    
    // Handle Neo4j complex DateTime objects (with year, month, day, hour, minute, second components)
    if (value && typeof value === 'object' && 
        'year' in value && 'month' in value && 'day' in value && 
        typeof value.year === 'object' && typeof value.month === 'object' && typeof value.day === 'object' &&
        'low' in value.year && 'low' in value.month && 'low' in value.day) {
      try {
        // Extract date components from Neo4j DateTime structure
        const year = value.year.low
        const month = value.month.low - 1 // JavaScript months are 0-indexed
        const day = value.day.low
        const hour = value.hour?.low || 0
        const minute = value.minute?.low || 0
        const second = value.second?.low || 0
        
        const date = new Date(year, month, day, hour, minute, second)
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
          })
        }
      } catch (error) {
        console.warn('Failed to convert Neo4j DateTime:', error)
      }
      return 'DateTime'
    }
    
    // Final fallback for any object that got through (especially Neo4j timestamp objects)
    if ('low' in value && 'high' in value) {
      return `[Timestamp: ${value.low}]`
    }
    
    if ('value' in value && value.value !== undefined) {
      return formatValue(value.value)
    }
    if ('name' in value && value.name !== undefined) {
      return formatValue(value.name)
    }
    if ('text' in value && value.text !== undefined) {
      return formatValue(value.text)
    }
    if ('score' in value && value.score !== undefined) {
      return formatValue(value.score)
    }
    if ('amount' in value && value.amount !== undefined) {
      return formatValue(value.amount)
    }
    if ('currency' in value && 'value' in value) {
      return `${value.currency}${formatValue(value.value)}`
    }
    if (Object.keys(value).length === 0) {
      return "N/A"
    }
    try {
      const stringValue = JSON.stringify(value)
      return stringValue === '{}' ? 'N/A' : stringValue
    } catch {
      // Last resort - prevent React rendering error
      return String(value)
    }
  }
  
  return String(value)
}