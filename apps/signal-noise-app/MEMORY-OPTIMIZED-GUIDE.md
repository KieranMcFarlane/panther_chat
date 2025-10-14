# Memory-Optimized Batch Processing Guide

## Overview

The enhanced historical batch processor now includes **memory-optimized processing** with smaller batch sizes, automatic recovery, and comprehensive monitoring to prevent RAM overload during large-scale entity processing.

## Key Features

### 🧠 Memory Management
- **Small Batch Sizes**: Default 3 entities per batch (vs previous 10)
- **Memory Threshold**: 512MB limit with automatic garbage collection
- **Real-time Monitoring**: Track memory usage during processing
- **Adaptive Delays**: Longer delays when memory usage is high

### 🛟 Recovery System
- **Automatic Checkpoints**: Save progress every 5 batches
- **Resume Capability**: Resume processing from any checkpoint
- **Retry Logic**: Automatic retries with exponential backoff
- **Failed Checkpoint Handling**: Manual recovery for failed batches

### 📊 Progress Tracking
- **Memory Statistics**: Peak usage, average per batch, utilization
- **Batch Progress**: Real-time progress updates
- **Processing Status**: Complete status with memory information
- **Checkpoint Management**: List, cleanup, and monitor checkpoints

## API Usage

### Start Memory-Optimized Processing

```javascript
const response = await fetch('/api/historical-batch-processor', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    entities: yourEntities,
    options: {
      memoryOptimized: true,        // Enable memory optimization
      batchSize: 3,                 // Small batch size
      memoryThresholdMB: 512,       // Memory limit in MB
      maxConcurrent: 2,             // Limit concurrent processing
      storeResults: true            // Store results in Neo4j
    }
  })
});

const result = await response.json();
console.log(`Started batch: ${result.batchId}`);
```

### Monitor Processing Status

```javascript
const statusResponse = await fetch('/api/historical-batch-processor?action=status');
const status = await statusResponse.json();

console.log('Status:', status.data.status);
console.log('Progress:', status.data.progress);
console.log('Memory:', status.data.memory);
console.log('Configuration:', status.data.configuration);
```

### List Available Checkpoints

```javascript
const checkpointsResponse = await fetch('/api/historical-batch-processor?action=checkpoints');
const checkpoints = await checkpointsResponse.json();

console.log(`Available checkpoints: ${checkpoints.count}`);
checkpoints.data.forEach(checkpoint => {
  console.log(`- ${checkpoint.batchId}: ${checkpoint.progress} (${checkpoint.completion}%)`);
});
```

### Resume from Checkpoint

```javascript
const resumeResponse = await fetch('/api/historical-batch-processor?action=resume&batchId=your_batch_id');
const resumeResult = await resumeResponse.json();

if (resumeResult.success) {
  console.log('Resume options:', resumeResult.availableOptions);
}
```

### Cleanup Old Checkpoints

```javascript
const cleanupResponse = await fetch('/api/historical-batch-processor?action=cleanup&maxAge=24');
const cleanupResult = await cleanupResponse.json();

console.log(cleanupResult.message); // "Cleaned up checkpoints older than 24 hours"
```

## Configuration Options

### Memory Optimization Settings

```javascript
const options = {
  // Batch Processing
  batchSize: 3,                    // Entities per batch (2-5 recommended)
  maxConcurrent: 2,                // Max concurrent batches (1-3 recommended)
  
  // Memory Management
  memoryOptimized: true,           // Enable memory optimization
  memoryThresholdMB: 512,          // Memory limit in MB
  checkpointInterval: 5,           // Save checkpoint every N batches
  
  // Recovery Settings
  maxRetries: 3,                   // Max retry attempts per batch
  retryDelay: 5000,                // Initial retry delay in ms
  fallbackBatchSize: 2,            // Smaller batch size for retries
  
  // Processing Options
  storeResults: true,              // Store results in Neo4j
  useClaudeAgent: true,            // Use Claude Agent analysis
  mcpTools: ['neo4j', 'brightdata'] // Enabled MCP tools
};
```

### Environment Configuration

```bash
# Enable garbage collection (add to package.json scripts)
NODE_OPTIONS="--expose-gc"

# Memory monitoring
export NODE_ENV=development

# Claude Agent API
export ANTHROPIC_API_KEY=your_claude_api_key

# MCP Tools
export NEO4J_URI=your_neo4j_uri
export BRIGHTDATA_API_TOKEN=your_brightdata_token
```

## Memory Safety Guidelines

### Recommended Settings for Different Systems

#### **Development Environment (8-16GB RAM)**
```javascript
{
  batchSize: 2,
  maxConcurrent: 1,
  memoryThresholdMB: 256,
  checkpointInterval: 3
}
```

#### **Production Environment (32GB+ RAM)**
```javascript
{
  batchSize: 3,
  maxConcurrent: 2,
  memoryThresholdMB: 512,
  checkpointInterval: 5
}
```

#### **High-Memory Environment (64GB+ RAM)**
```javascript
{
  batchSize: 5,
  maxConcurrent: 3,
  memoryThresholdMB: 1024,
  checkpointInterval: 10
}
```

### Memory Monitoring Tips

1. **Monitor Memory Usage**: Check status endpoint regularly during processing
2. **Watch for Warnings**: High memory utilization warnings (>80%)
3. **Adjust Batch Sizes**: Reduce batch size if memory usage is consistently high
4. **Use Checkpoints**: Enable checkpoints for large processing jobs
5. **Clean Up Regularly**: Remove old checkpoints to free memory

## Error Handling and Recovery

### Common Memory-Related Errors

#### **Memory Threshold Exceeded**
```javascript
// Symptom: "High memory usage detected: 600MB. Forcing garbage collection..."
// Solution: Reduce batch size or memory threshold
```

#### **Batch Processing Timeout**
```javascript
// Symptom: "Batch processing timeout after 30000ms"
// Solution: Increase timeout or reduce batch size
```

#### **Claude Agent Memory Error**
```javascript
// Symptom: "Claude analysis failed for entity X"
// Solution: Enable fallback processing or reduce concurrent requests
```

### Recovery Strategies

#### **Automatic Recovery**
- System automatically retries failed batches
- Exponential backoff prevents overwhelming the system
- Checkpoints allow resumption from last successful batch

#### **Manual Recovery**
```javascript
// 1. List available checkpoints
const checkpoints = await fetch('/api/historical-batch-processor?action=checkpoints');

// 2. Resume from specific checkpoint
const resume = await fetch('/api/historical-batch-processor?action=resume&batchId=checkpoint_id');

// 3. Configure recovery options
const recoveryOptions = {
  maxRetries: 5,           // More retries for problematic data
  fallbackBatchSize: 1,    // Smaller batches for retries
  retryDelay: 10000        // Longer delays between retries
};
```

## Testing

### Run the Test Suite

```bash
# Make sure development server is running
npm run dev

# In another terminal, run memory tests
node run-memory-tests.js
```

### Test Coverage

The test suite includes:
1. **Small Batch Processing**: Tests 3-entity batch processing
2. **Memory Threshold Enforcement**: Validates memory limits
3. **Checkpoint System**: Tests automatic checkpoint creation
4. **Recovery Mechanism**: Tests cleanup and recovery features
5. **Memory Monitoring**: Tests memory tracking endpoints
6. **Adaptive Delays**: Tests memory-based delay adjustments
7. **Configuration Validation**: Tests all configuration options

### Expected Test Results

```
📊 MEMORY-OPTIMIZED BATCH PROCESSING TEST REPORT
============================================================

📈 SUMMARY:
   Total Tests: 7
   Passed: 7 ✅
   Failed: 0 ✅
   Success Rate: 100%
   Total Duration: 45000ms

💡 MEMORY OPTIMIZATION RECOMMENDATIONS:
   ✅ Memory usage is well within acceptable limits (245MB average)

🎉 All tests passed! Memory-optimized batch processing is working correctly.
   - Small batch sizes: ✅
   - Memory monitoring: ✅
   - Checkpoint system: ✅
   - Recovery mechanisms: ✅
   - Adaptive delays: ✅
```

## Performance Impact

### Memory Optimization Benefits

1. **Prevents RAM Overload**: Small batches prevent memory spikes
2. **Stable Processing**: Consistent memory usage over long periods
3. **Better Resource Management**: Allows other processes to run smoothly
4. **Scalable**: Can process large datasets without memory issues

### Trade-offs

1. **Longer Processing Time**: Smaller batches increase total processing time
2. **More API Calls**: More frequent batch processing increases overhead
3. **Checkpoint Storage**: Recovery system uses additional memory for checkpoints

### Optimization Tips

1. **Tune Batch Sizes**: Find the optimal balance between memory and speed
2. **Monitor Memory Usage**: Adjust settings based on actual memory usage
3. **Use Concurrent Processing**: Increase concurrent processing for faster results
4. **Enable GC**: Use `--expose-gc` flag for better garbage collection

## Troubleshooting

### High Memory Usage

**Problem**: Memory usage exceeds threshold
**Solutions**:
- Reduce batch size to 2 or 1
- Lower memory threshold
- Increase checkpoint frequency
- Reduce concurrent processing

### Slow Processing

**Problem**: Processing is too slow
**Solutions**:
- Increase batch size slightly (if memory allows)
- Increase concurrent processing
- Reduce checkpoint frequency
- Optimize entity data size

### Recovery Issues

**Problem**: Cannot resume from checkpoint
**Solutions**:
- Check checkpoint availability with `/action=checkpoints`
- Verify original entity data is accessible
- Use smaller fallback batch size
- Increase retry attempts and delays

## Best Practices

1. **Start Small**: Begin with conservative settings and adjust based on results
2. **Monitor Closely**: Watch memory usage during first few runs
3. **Use Checkpoints**: Always enable checkpoints for large processing jobs
4. **Test Thoroughly**: Run test suite before production deployment
5. **Plan for Recovery**: Have recovery strategy for failed processing
6. **Regular Cleanup**: Remove old checkpoints to prevent memory bloat
7. **Document Settings**: Keep record of optimal settings for different data sizes

This memory-optimized system ensures safe, reliable batch processing that won't overwhelm your system's RAM while maintaining high-quality AI-powered analysis.