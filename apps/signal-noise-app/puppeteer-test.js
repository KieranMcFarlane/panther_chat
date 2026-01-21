const puppeteer = require('puppeteer');

async function testMinimalPage() {
  console.log('🚀 Starting Puppeteer test of minimal-test page...');
  
  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: false, // Show browser window
      devtools: true    // Open dev tools
    });
    
    const page = await browser.newPage();
    
    // Enable console logging from the page
    page.on('console', msg => {
      console.log('🖥️  Browser Console:', msg.text());
    });
    
    page.on('request', request => {
      if (request.url().includes('/api/copilotkit')) {
        console.log('🌐 API Request:', request.method(), request.url());
        console.log('📤 Request Headers:', request.headers());
      }
    });
    
    page.on('response', response => {
      if (response.url().includes('/api/copilotkit')) {
        console.log('📬 API Response:', response.status(), response.url());
        console.log('📥 Response Headers:', response.headers());
      }
    });
    
    // Navigate to the minimal test page
    console.log('📄 Navigating to minimal-test page...');
    await page.goto('http://localhost:3005/minimal-test', { 
      waitUntil: 'networkidle2' 
    });
    
    // Wait for page to load
    await page.waitForSelector('form', { timeout: 10000 });
    console.log('✅ Page loaded successfully');
    
    // Test first message
    console.log('\n📤 Test 1: Sending "hi"');
    await page.type('input[name="message"]', 'hi');
    await page.click('button[type="submit"]');
    
    // Wait for first message to complete
    await page.waitForTimeout(50000); // Wait 50 seconds for Claude Agent SDK
    console.log('✅ First message should be completed');
    
    // Clear input for second message
    await page.evaluate(() => {
      document.querySelector('input[name="message"]').value = '';
    });
    
    // Test second message (this is where the 404 was reported)
    console.log('\n📤 Test 2: Sending "how is arsenal doing?"');
    await page.type('input[name="message"]', 'how is arsenal doing?');
    await page.click('button[type="submit"]');
    
    // Wait for second message to complete
    await page.waitForTimeout(50000);
    console.log('✅ Second message should be completed');
    
    console.log('\n🎉 Puppeteer test completed!');
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'test-results.png' });
    console.log('📸 Screenshot saved as test-results.png');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Check if localhost:3005 is available first
async function checkServer() {
  try {
    const response = await fetch('http://localhost:3005/minimal-test');
    if (response.ok) {
      console.log('✅ Server is running');
      await testMinimalPage();
    } else {
      console.error('❌ Server responded with:', response.status);
    }
  } catch (error) {
    console.error('❌ Server not available:', error);
    console.log('💡 Make sure "npm run dev" is running');
  }
}

checkServer();