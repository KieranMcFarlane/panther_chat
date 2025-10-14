import { NextRequest, NextResponse } from 'next/server';
import { linkVerificationService } from '@/lib/link-verification';
import { supabase } from '@/lib/supabase-client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, urls, rfpIds } = body;

    switch (action) {
      case 'verify':
        return await handleVerifyUrls(urls);
      case 'verify-rfps':
        return await handleVerifyRfpUrls(rfpIds);
      case 'check-cache':
        return await handleCheckCache(urls);
      case 'cleanup-cache':
        return await handleCleanupCache();
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('❌ Link verification API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'stats';

    switch (action) {
      case 'stats':
        return await handleGetStats();
      case 'verify-all':
        return await handleVerifyAllRfps();
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('❌ Link verification GET API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Verify specific URLs
 */
async function handleVerifyUrls(urls: string[]) {
  if (!Array.isArray(urls) || urls.length === 0) {
    return NextResponse.json({ error: 'Invalid URLs array' }, { status: 400 });
  }

  console.log(`🔍 Starting verification of ${urls.length} URLs...`);
  
  const results = await linkVerificationService.verifyUrls(urls);
  
  return NextResponse.json({
    success: true,
    total_urls: urls.length,
    results,
    summary: {
      valid: results.filter(r => r.isValid).length,
      invalid: results.filter(r => !r.isValid).length,
      errors: results.filter(r => r.error).length
    }
  });
}

/**
 * Verify URLs for specific RFPs
 */
async function handleVerifyRfpUrls(rfpIds: string[]) {
  if (!Array.isArray(rfpIds) || rfpIds.length === 0) {
    return NextResponse.json({ error: 'Invalid RFP IDs array' }, { status: 400 });
  }

  // Get RFPs with their URLs
  const { data: rfps, error } = await supabase
    .from('rfp_opportunities')
    .select('id, title, organization, source_url')
    .in('id', rfpIds);

  if (error) {
    console.error('❌ Failed to fetch RFPs for verification:', error);
    return NextResponse.json({ error: 'Failed to fetch RFPs' }, { status: 500 });
  }

  const urls = rfps?.map(rfp => rfp.source_url).filter(Boolean) || [];
  const results = await linkVerificationService.verifyUrls(urls);

  // Update database with verification results
  for (let i = 0; i < rfps.length; i++) {
    const rfp = rfps[i];
    const result = results.find(r => r.url === rfp.source_url);
    
    if (result) {
      await supabase
        .from('rfp_opportunities')
        .update({
          link_status: result.isValid ? 'valid' : 'invalid',
          link_verified_at: result.verificationTime,
          link_error: result.error,
          link_redirect_url: result.redirectedUrl,
          metadata: {
            ...rfp.metadata,
            link_verification: {
              status: result.isValid ? 'valid' : 'invalid',
              status_code: result.statusCode,
              verified_at: result.verificationTime,
              error: result.error,
              redirect_url: result.redirectedUrl
            }
          }
        })
        .eq('id', rfp.id);
    }
  }

  return NextResponse.json({
    success: true,
    verified_rfps: rfps.length,
    results: rfps.map(rfp => {
      const result = results.find(r => r.url === rfp.source_url);
      return {
        rfp_id: rfp.id,
        title: rfp.title,
        organization: rfp.organization,
        url: rfp.source_url,
        verification: result
      };
    })
  });
}

/**
 * Check cached verification results
 */
async function handleCheckCache(urls: string[]) {
  if (!Array.isArray(urls)) {
    return NextResponse.json({ error: 'Invalid URLs array' }, { status: 400 });
  }

  const cachedResults = urls.map(url => ({
    url,
    cached: linkVerificationService.getCachedVerification(url)
  }));

  return NextResponse.json({
    success: true,
    results: cachedResults
  });
}

/**
 * Cleanup expired cache entries
 */
async function handleCleanupCache() {
  linkVerificationService.clearExpiredCache();
  const stats = linkVerificationService.getCacheStats();
  
  return NextResponse.json({
    success: true,
    message: 'Cache cleaned up',
    cache_stats: stats
  });
}

/**
 * Get verification statistics
 */
async function handleGetStats() {
  const cacheStats = linkVerificationService.getCacheStats();
  
  // Get database statistics
  const { data: dbStats } = await supabase
    .from('rfp_opportunities')
    .select('link_status')
    .not('source_url', 'is', null);

  const statusCounts = dbStats?.reduce((acc, rfp) => {
    const status = rfp.link_status || 'unverified';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  return NextResponse.json({
    cache_stats: cacheStats,
    database_stats: {
      total_with_links: dbStats?.length || 0,
      by_status: statusCounts
    }
  });
}

/**
 * Verify all RFP URLs in the database
 */
async function handleVerifyAllRfps() {
  const { data: rfps, error } = await supabase
    .from('rfp_opportunities')
    .select('id, source_url')
    .not('source_url', 'is', null)
    .limit(50); // Limit to avoid overwhelming

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch RFPs' }, { status: 500 });
  }

  const urls = rfps?.map(rfp => rfp.source_url) || [];
  const results = await linkVerificationService.verifyUrls(urls);

  // Update database with results
  for (let i = 0; i < rfps.length; i++) {
    const rfp = rfps[i];
    const result = results[i];
    
    await supabase
      .from('rfp_opportunities')
      .update({
        link_status: result.isValid ? 'valid' : 'invalid',
        link_verified_at: result.verificationTime,
        link_error: result.error
      })
      .eq('id', rfp.id);
  }

  return NextResponse.json({
    success: true,
    verified_count: rfps.length,
    summary: {
      valid: results.filter(r => r.isValid).length,
      invalid: results.filter(r => !r.isValid).length
    }
  });
}