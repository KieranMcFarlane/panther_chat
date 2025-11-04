/**
 * Link Verification Service
 * 
 * Provides URL validation and verification for RFP source links
 */

interface LinkVerificationResult {
  url: string;
  isValid: boolean;
  statusCode?: number;
  error?: string;
  redirectedUrl?: string;
  verificationTime: string;
}

interface VerificationCache {
  [url: string]: {
    result: LinkVerificationResult;
    expiresAt: number;
  };
}

class LinkVerificationService {
  private cache: VerificationCache = {};
  private readonly CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes
  private readonly VERIFICATION_TIMEOUT_MS = 10000; // 10 seconds

  /**
   * Verify a single URL
   */
  async verifyUrl(url: string): Promise<LinkVerificationResult> {
    // Check cache first
    const cached = this.cache[url];
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }

    const startTime = Date.now();
    
    try {
      // Create a controller to timeout the request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.VERIFICATION_TIMEOUT_MS);

      console.log(`🔍 Verifying URL: ${url}`);
      
      // Use a HEAD request first (faster)
      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; YellowPanther-RFP-Bot/1.0)'
        }
      });

      clearTimeout(timeoutId);

      const result: LinkVerificationResult = {
        url,
        isValid: response.ok,
        statusCode: response.status,
        verificationTime: new Date().toISOString()
      };

      // Handle redirects
      if (response.redirected && response.url !== url) {
        result.redirectedUrl = response.url;
      }

      // Cache the result
      this.cache[url] = {
        result,
        expiresAt: Date.now() + this.CACHE_DURATION_MS
      };

      console.log(`✅ URL verification complete for ${url}: ${result.isValid ? 'VALID' : 'INVALID'} (${result.statusCode})`);
      
      return result;

    } catch (error) {
      const result: LinkVerificationResult = {
        url,
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        verificationTime: new Date().toISOString()
      };

      // Cache failures for a shorter duration
      this.cache[url] = {
        result,
        expiresAt: Date.now() + (5 * 60 * 1000) // 5 minutes for failures
      };

      console.log(`❌ URL verification failed for ${url}: ${result.error}`);
      
      return result;
    }
  }

  /**
   * Verify multiple URLs in parallel
   */
  async verifyUrls(urls: string[]): Promise<LinkVerificationResult[]> {
    console.log(`🔍 Verifying ${urls.length} URLs...`);
    
    const results = await Promise.allSettled(
      urls.map(url => this.verifyUrl(url))
    );

    return results.map((result, index) => 
      result.status === 'fulfilled' ? result.value : {
        url: urls[index] || 'unknown',
        isValid: false,
        error: result.reason?.message || 'Verification failed',
        verificationTime: new Date().toISOString()
      }
    );
  }

  /**
   * Get cached verification for a URL
   */
  getCachedVerification(url: string): LinkVerificationResult | null {
    const cached = this.cache[url];
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }
    return null;
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    Object.keys(this.cache).forEach(url => {
      if (this.cache[url].expiresAt <= now) {
        delete this.cache[url];
      }
    });
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    totalCached: number;
    validCached: number;
    expiredCached: number;
  } {
    const now = Date.now();
    const entries = Object.values(this.cache);
    
    return {
      totalCached: entries.length,
      validCached: entries.filter(entry => entry.expiresAt > now).length,
      expiredCached: entries.filter(entry => entry.expiresAt <= now).length
    };
  }
}

// Export singleton instance
export const linkVerificationService = new LinkVerificationService();

// Export types
export type { LinkVerificationResult, VerificationCache };