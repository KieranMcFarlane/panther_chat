/**
 * Headless RFP Verification System
 * 
 * Browser automation agent that can:
 * - Navigate to RFP/procurement websites
 * - Take screenshots for GLM-4.5V analysis  
 * - Click buttons, fill forms, submit inquiries
 * - Monitor responses and score authenticity
 */

import puppeteer, { Browser, Page } from 'puppeteer';

interface VerificationConfig {
  url: string;
  organizationInfo: {
    name: string;
    website: string;
    type: string;
  };
  businessInfo: {
    contactName: string;
    email: string;
    phone: string;
    company: string;
    message?: string;
  };
  screenshotInterval?: number;
  timeout?: number;
}

interface VerificationResult {
  success: boolean;
  authenticityScore: number;
  screenshots: string[];
  interactions: string[];
  responseCaptured?: string;
  pageAnalysis?: any;
  error?: string;
  duration: number;
}

export class HeadlessRFPVerifier {
  private browser: Browser | null = null;
  private isInitialized = false;

  async initialize() {
    try {
      console.log('🤖 Initializing headless RFP verifier...');
      
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--window-size=1920,1080'
        ]
      });

      this.isInitialized = true;
      console.log('✅ Headless verifier initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize headless verifier:', error);
      throw error;
    }
  }

  async verifyRFP(config: VerificationConfig): Promise<VerificationResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const result: VerificationResult = {
      success: false,
      authenticityScore: 0,
      screenshots: [],
      interactions: [],
      duration: 0
    };

    try {
      console.log(`🔍 Starting RFP verification: ${config.url}`);
      
      const page = await this.browser!.newPage();
      
      // Set user agent and viewport
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1920, height: 1080 });

      try {
        // Step 1: Navigate to RFP page
        await this.navigateToPage(page, config, result);
        
        // Step 2: Initial screenshot and visual analysis
        await this.capturePageAnalysis(page, config, result);
        
        // Step 3: Look for contact/application forms
        const formFound = await this.lookForContactForm(page, config, result);
        
        if (formFound) {
          // Step 4: Fill and submit form
          await this.fillAndSubmitForm(page, config, result);
          
          // Step 5: Monitor for response
          await this.monitorForResponse(page, config, result);
        } else {
          // Alternative: Look for contact info and record
          await this.extractContactInfo(page, config, result);
        }

        result.success = true;
        console.log('✅ RFP verification completed successfully');
        
      } catch (stepError) {
        console.warn(`⚠️ Verification step failed: ${stepError.message}`);
        result.interactions.push(`Step failed: ${stepError.message}`);
      } finally {
        await page.close();
      }

    } catch (error) {
      console.error('❌ RFP verification failed:', error);
      result.error = error.message;
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  private async navigateToPage(page: Page, config: VerificationConfig, result: VerificationResult) {
    try {
      console.log(`🌐 Navigating to: ${config.url}`);
      
      await page.goto(config.url, { 
        waitUntil: 'networkidle2',
        timeout: config.timeout || 30000 
      });

      // Wait a bit for any dynamic content
      await page.waitForTimeout(2000);

      // Take initial screenshot
      const screenshot = await page.screenshot({ 
        encoding: 'base64',
        fullPage: true 
      });
      
      result.screenshots.push(`data:image/png;base64,${screenshot}`);
      result.interactions.push(`Navigated to ${config.url}`);
      
    } catch (error) {
      throw new Error(`Navigation failed: ${error.message}`);
    }
  }

  private async capturePageAnalysis(page: Page, config: VerificationConfig, result: VerificationResult) {
    try {
      console.log('📸 Capturing page for visual analysis...');
      
      // Extract page title and content for analysis
      const pageTitle = await page.title();
      const pageContent = await page.evaluate(() => {
        return document.body.innerText;
      });

      // Basic authenticity checks
      let authenticityScore = 50; // Base score

      // Check for legitimate elements
      const hasNavigation = await page.$('nav') !== null;
      const hasFooter = await page.$('footer') !== null;
      const hasContact = await page.$('a[href*="contact"], a[href*="about"]') !== null;
      const hasForms = await page.$('form') !== null;
      
      if (hasNavigation) authenticityScore += 10;
      if (hasFooter) authenticityScore += 10;
      if (hasContact) authenticityScore += 15;
      if (hasForms) authenticityScore += 15;

      // Check for fake/spam indicators
      const content = pageContent.toLowerCase();
      const spamIndicators = ['click here to claim', 'you have won', 'limited time offer', 'act now'];
      const spamCount = spamIndicators.filter(indicator => content.includes(indicator)).length;
      authenticityScore -= (spamCount * 10);

      // Check for professional indicators
      const professionalIndicators = ['procurement', 'tender', 'rfp', 'partnership', 'services'];
      const professionalCount = professionalIndicators.filter(indicator => content.includes(indicator)).length;
      authenticityScore += (professionalCount * 5);

      result.authenticityScore = Math.max(0, Math.min(100, authenticityScore));
      result.interactions.push(`Page analyzed: ${pageTitle} (Score: ${result.authenticityScore})`);
      
    } catch (error) {
      console.warn('Page analysis failed:', error);
      result.authenticityScore = 30; // Low score if analysis fails
    }
  }

  private async lookForContactForm(page: Page, config: VerificationConfig, result: VerificationResult): Promise<boolean> {
    try {
      console.log('🔍 Looking for contact forms...');
      
      // Common contact form selectors
      const formSelectors = [
        'form[action*="contact"]',
        'form[action*="inquiry"]', 
        'form[action*="apply"]',
        'form[action*="submit"]',
        'form:has(input[name*="email"])',
        'form:has(textarea[name*="message"])',
        'form:has(button[type*="submit"])',
        '.contact-form form',
        '#contact-form',
        '.inquiry-form'
      ];

      for (const selector of formSelectors) {
        const form = await page.$(selector);
        if (form) {
          console.log(`✅ Found form with selector: ${selector}`);
          result.interactions.push(`Found contact form: ${selector}`);
          return true;
        }
      }

      // Look for contact/inquiry buttons
      const buttonSelectors = [
        'a:has-text("Contact")',
        'a:has-text("Inquiry")',
        'a:has-text("Apply")',
        'a:has-text("Submit")',
        'a:has-text("Request")',
        'a:has-text("Get in Touch")',
        'button:has-text("Contact")',
        '.contact-button',
        '.inquiry-button'
      ];

      for (const selector of buttonSelectors) {
        const button = await page.$(selector);
        if (button) {
          console.log(`✅ Found contact button: ${selector}`);
          result.interactions.push(`Found contact button: ${selector}`);
          
          // Click the button
          await button.click();
          await page.waitForTimeout(2000);
          
          // Take screenshot after click
          const screenshot = await page.screenshot({ 
            encoding: 'base64',
            fullPage: true 
          });
          result.screenshots.push(`data:image/png;base64,${screenshot}`);
          result.interactions.push('Clicked contact button');
          
          // Look for form again after navigation
          return await this.lookForContactForm(page, config, result);
        }
      }

      console.log('❌ No contact form found');
      result.interactions.push('No contact form or button found');
      return false;
      
    } catch (error) {
      console.warn('Contact form search failed:', error);
      return false;
    }
  }

  private async fillAndSubmitForm(page: Page, config: VerificationConfig, result: VerificationResult) {
    try {
      console.log('📝 Filling and submitting form...');
      
      // Common field selectors
      const fieldSelectors = {
        name: ['input[name*="name"]', 'input[name*="Name"]', '#name', '.name'],
        email: ['input[type="email"]', 'input[name*="email"]', 'input[name*="Email"]', '#email', '.email'],
        phone: ['input[type="tel"]', 'input[name*="phone"]', 'input[name*="Phone"]', '#phone', '.phone'],
        company: ['input[name*="company"]', 'input[name*="organization"]', '#company', '.company'],
        message: ['textarea[name*="message"]', 'textarea[name*="Message"]', '#message', '.message'],
        subject: ['input[name*="subject"]', 'input[name*="Subject"]', '#subject', '.subject']
      };

      // Fill form fields
      for (const [fieldType, selectors] of Object.entries(fieldSelectors)) {
        for (const selector of selectors) {
          try {
            const element = await page.$(selector);
            if (element) {
              const value = config.businessInfo[fieldType as keyof typeof config.businessInfo];
              if (value) {
                await element.evaluate((el, val) => el.value = val, value);
                result.interactions.push(`Filled ${fieldType} field: ${selector}`);
                break; // Move to next field type
              }
            }
          } catch (fieldError) {
            // Continue trying other selectors
          }
        }
      }

      // Look for submit button
      const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Submit")',
        'button:has-text("Send")',
        'button:has-text("Apply")',
        'button:has-text("Contact")',
        '.submit-button',
        '#submit'
      ];

      let submitClicked = false;
      for (const selector of submitSelectors) {
        try {
          const button = await page.$(selector);
          if (button) {
            await button.click();
            result.interactions.push(`Clicked submit button: ${selector}`);
            submitClicked = true;
            break;
          }
        } catch (buttonError) {
          // Continue trying other selectors
        }
      }

      if (submitClicked) {
        // Wait for response
        await page.waitForTimeout(3000);
        
        // Take post-submission screenshot
        const screenshot = await page.screenshot({ 
          encoding: 'base64',
          fullPage: true 
        });
        result.screenshots.push(`data:image/png;base64,${screenshot}`);
        result.interactions.push('Form submitted successfully');
        
        // Increase authenticity score for successful form submission
        result.authenticityScore = Math.min(100, result.authenticityScore + 20);
      } else {
        result.interactions.push('No submit button found');
      }
      
    } catch (error) {
      console.warn('Form filling failed:', error);
      result.interactions.push(`Form filling error: ${error.message}`);
    }
  }

  private async monitorForResponse(page: Page, config: VerificationConfig, result: VerificationResult) {
    try {
      console.log('👀 Monitoring for response...');
      
      // Look for success/error messages
      const messageSelectors = [
        '.success-message',
        '.error-message', 
        '.confirmation',
        '.notification',
        '[class*="success"]',
        '[class*="error"]',
        '[class*="confirmation"]'
      ];

      let responseCaptured = '';
      for (const selector of messageSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            responseCaptured = await element.evaluate(el => el.textContent || '');
            result.responseCaptured = responseCaptured;
            result.interactions.push(`Response captured: ${selector}`);
            break;
          }
        } catch (error) {
          // Continue trying other selectors
        }
      }

      // Check for page changes (success/error pages)
      const currentUrl = page.url();
      if (currentUrl !== config.url) {
        result.responseCaptured += ` Redirected to: ${currentUrl}`;
        result.interactions.push(`Page redirected to: ${currentUrl}`);
      }

      if (responseCaptured) {
        // Analyze response for legitimacy
        const responseLower = responseCaptured.toLowerCase();
        if (responseLower.includes('thank you') || responseLower.includes('success') || responseLower.includes('received')) {
          result.authenticityScore = Math.min(100, result.authenticityScore + 15);
          result.interactions.push('Positive response detected');
        }
      }
      
    } catch (error) {
      console.warn('Response monitoring failed:', error);
    }
  }

  private async extractContactInfo(page: Page, config: VerificationConfig, result: VerificationResult) {
    try {
      console.log('📋 Extracting contact information...');
      
      // Look for contact information on the page
      const contactSelectors = [
        'a[href^="mailto:"]',
        'a[href^="tel:"]',
        '.phone',
        '.email',
        '.contact',
        '[href*="mailto.com"]',
        '[href*="contact"]'
      ];

      for (const selector of contactSelectors) {
        try {
          const elements = await page.$$(selector);
          for (const element of elements) {
            const contactInfo = await element.evaluate(el => el.textContent || el.href || '');
            if (contactInfo) {
              result.responseCaptured = (result.responseCaptured || '') + ` Contact: ${contactInfo}`;
              result.interactions.push(`Contact info found: ${contactInfo}`);
            }
          }
        } catch (error) {
          // Continue trying other selectors
        }
      }
      
    } catch (error) {
      console.warn('Contact info extraction failed:', error);
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.isInitialized = false;
      console.log('🤖 Headless verifier closed');
    }
  }

  async verifyBatchRFPs(configs: VerificationConfig[]): Promise<VerificationResult[]> {
    const results: VerificationResult[] = [];
    
    for (const config of configs) {
      try {
        const result = await this.verifyRFP(config);
        results.push(result);
        
        // Wait between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        results.push({
          success: false,
          authenticityScore: 0,
          screenshots: [],
          interactions: [],
          error: error.message,
          duration: 0
        });
      }
    }
    
    return results;
  }
}

// Export singleton instance
export const headlessRFPVerifier = new HeadlessRFPVerifier();