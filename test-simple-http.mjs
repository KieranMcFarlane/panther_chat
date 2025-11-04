/**
 * Simple HTTP Test for ClaudeBox Router Service
 * Debug test to check if the HTTP server is working
 */

import RouterService from './services/router-service.js';

async function simpleHttpTest() {
  console.log('🧪 Starting simple HTTP test...');
  
  try {
    // Create router service
    const router = new RouterService({
      port: 62199,
      enableLogging: true,
      enableCors: true
    });

    // Initialize
    const initialized = await router.initialize();
    if (!initialized) {
      throw new Error('Failed to initialize router');
    }

    // Start server
    await router.start();
    
    if (!router.isRunning) {
      throw new Error('Server not running');
    }

    const port = router.server.address().port;
    console.log(`🌐 Server running on port ${port}`);

    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 500));

    // Test with curl-like approach using fetch
    const testUrl = `http://localhost:${port}/health`;
    console.log(`📡 Testing: ${testUrl}`);

    try {
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log(`📡 Response status: ${response.status}`);
      console.log(`📡 Response headers:`, Object.fromEntries(response.headers));

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Health check successful:', data);
      } else {
        console.log('❌ Health check failed:', response.status, response.statusText);
      }

    } catch (fetchError) {
      console.error('❌ Fetch error:', fetchError.message);
      
      // Fallback to Node.js HTTP
      console.log('🔄 Trying Node.js HTTP client...');
      const http = require('http');
      
      const options = {
        hostname: 'localhost',
        port: port,
        path: '/health',
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      };

      const reqPromise = new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
          let body = '';
          
          res.on('data', (chunk) => {
            body += chunk;
          });
          
          res.on('end', () => {
            console.log(`📡 Node.js HTTP response status: ${res.statusCode}`);
            console.log(`📡 Node.js HTTP response body:`, body);
            resolve({ status: res.statusCode, body });
          });
        });

        req.on('error', (error) => {
          console.error('❌ Node.js HTTP request error:', error.message);
          reject(error);
        });

        req.end();
      });

      await reqPromise;
    }

    // Cleanup
    await router.shutdown();
    console.log('✅ Simple HTTP test completed');

  } catch (error) {
    console.error('❌ Simple HTTP test failed:', error);
  }
}

// Run the test
simpleHttpTest();