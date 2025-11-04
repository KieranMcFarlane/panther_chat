/**
 * ⚙️ Monitoring Configuration
 * 
 * Defines which companies and people to monitor for real-time alerts
 */

export interface MonitoringTarget {
  id: string;
  name: string;
  type: 'company' | 'person';
  url?: string;
  linkedinUrl?: string;
  careersUrl?: string;
  keywords: string[];
  alertTypes: string[];
  tier: 'golden' | 'standard' | 'economy';
  checkInterval: number; // minutes
}

export const MONITORING_TARGETS: MonitoringTarget[] = [
  // Companies - Golden Zone (real-time)
  {
    id: 'podium',
    name: 'Podium',
    type: 'company',
    url: 'https://podium.com',
    careersUrl: 'https://podium.com/careers',
    linkedinUrl: 'https://linkedin.com/company/podium',
    keywords: ['podium', 'customer experience', 'reputation management'],
    alertTypes: ['traffic', 'hiring', 'funding', 'expansion', 'job_listing'],
    tier: 'golden',
    checkInterval: 5
  },
  {
    id: 'payhawk',
    name: 'Payhawk',
    type: 'company',
    url: 'https://payhawk.com',
    careersUrl: 'https://payhawk.com/careers',
    linkedinUrl: 'https://linkedin.com/company/payhawk',
    keywords: ['payhawk', 'expense management', 'fintech'],
    alertTypes: ['hiring', 'job_listing', 'funding', 'expansion'],
    tier: 'golden',
    checkInterval: 7
  },
  {
    id: 'magnitude',
    name: 'Magnitude',
    type: 'company',
    url: 'https://magnitude.com',
    careersUrl: 'https://magnitude.com/careers',
    linkedinUrl: 'https://linkedin.com/company/magnitude-software',
    keywords: ['magnitude', 'data integration', 'analytics'],
    alertTypes: ['hiring', 'job_listing', 'expansion'],
    tier: 'golden',
    checkInterval: 6
  },

  // Companies - Standard Tier
  {
    id: 'spotify',
    name: 'Spotify',
    type: 'company',
    url: 'https://spotify.com',
    careersUrl: 'https://www.lifeatspotify.com/jobs',
    linkedinUrl: 'https://linkedin.com/company/spotify',
    keywords: ['spotify', 'music streaming', 'audio'],
    alertTypes: ['hiring', 'departure', 'expansion'],
    tier: 'standard',
    checkInterval: 15
  },
  {
    id: 'techcorp',
    name: 'TechCorp',
    type: 'company',
    url: 'https://techcorp.com',
    careersUrl: 'https://techcorp.com/careers',
    keywords: ['techcorp', 'technology', 'software'],
    alertTypes: ['promotion', 'hiring', 'expansion'],
    tier: 'standard',
    checkInterval: 12
  },

  // People - Golden Zone (real-time)
  {
    id: 'taylor-morgan',
    name: 'Taylor Morgan',
    type: 'person',
    linkedinUrl: 'https://linkedin.com/in/taylor-morgan',
    keywords: ['taylor morgan', 'cmo', 'marketing'],
    alertTypes: ['promotion', 'departure', 'post'],
    tier: 'golden',
    checkInterval: 5
  },
  {
    id: 'ryan-sullivan',
    name: 'Ryan Sullivan',
    type: 'person',
    linkedinUrl: 'https://linkedin.com/in/ryan-sullivan',
    keywords: ['ryan sullivan', 'product manager', 'spotify'],
    alertTypes: ['departure', 'promotion', 'post'],
    tier: 'golden',
    checkInterval: 5
  },
  {
    id: 'cristala-jones',
    name: 'Cristala Jones',
    type: 'person',
    linkedinUrl: 'https://linkedin.com/in/cristala-jones',
    keywords: ['cristala jones', 'industry insights'],
    alertTypes: ['post', 'promotion', 'departure'],
    tier: 'standard',
    checkInterval: 10
  },

  // Additional Tech Companies for Monitoring
  {
    id: 'stripe',
    name: 'Stripe',
    type: 'company',
    url: 'https://stripe.com',
    careersUrl: 'https://stripe.com/jobs',
    linkedinUrl: 'https://linkedin.com/company/stripe',
    keywords: ['stripe', 'payments', 'fintech'],
    alertTypes: ['hiring', 'funding', 'expansion', 'traffic'],
    tier: 'standard',
    checkInterval: 20
  },
  {
    id: 'shopify',
    name: 'Shopify',
    type: 'company',
    url: 'https://shopify.com',
    careersUrl: 'https://www.shopify.com/careers',
    linkedinUrl: 'https://linkedin.com/company/shopify',
    keywords: ['shopify', 'e-commerce', 'platform'],
    alertTypes: ['hiring', 'expansion', 'traffic'],
    tier: 'standard',
    checkInterval: 18
  }
];

// Keywords for industry monitoring
export const INDUSTRY_KEYWORDS = {
  fintech: ['fintech', 'payments', 'banking', 'financial technology'],
  saas: ['saas', 'software as a service', 'subscription', 'cloud software'],
  ecommerce: ['e-commerce', 'online shopping', 'retail technology'],
  healthtech: ['healthtech', 'digital health', 'medical technology'],
  edtech: ['edtech', 'education technology', 'online learning'],
  ai_ml: ['artificial intelligence', 'machine learning', 'ai', 'ml'],
  blockchain: ['blockchain', 'cryptocurrency', 'web3', 'defi']
};

// Alert types and their configurations
export const ALERT_TYPES = {
  hiring: {
    name: 'Hiring',
    icon: 'user-plus',
    color: 'green',
    priority: 'medium'
  },
  promotion: {
    name: 'Promotion',
    icon: 'arrow-up',
    color: 'yellow',
    priority: 'high'
  },
  departure: {
    name: 'Departure',
    icon: 'arrow-down',
    color: 'red',
    priority: 'high'
  },
  post: {
    name: 'New Post',
    icon: 'message-square',
    color: 'blue',
    priority: 'low'
  },
  traffic: {
    name: 'Traffic Change',
    icon: 'trending-up',
    color: 'purple',
    priority: 'medium'
  },
  job_listing: {
    name: 'Job Listing',
    icon: 'briefcase',
    color: 'orange',
    priority: 'medium'
  },
  funding: {
    name: 'Funding',
    icon: 'dollar-sign',
    color: 'green',
    priority: 'high'
  },
  expansion: {
    name: 'Expansion',
    icon: 'map-pin',
    color: 'blue',
    priority: 'medium'
  }
};

// Monitoring intervals by tier
export const MONITORING_INTERVALS = {
  golden: 5, // minutes
  standard: 15, // minutes
  economy: 60 // minutes
};