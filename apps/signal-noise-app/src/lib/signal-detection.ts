/**
 * 🔍 Signal Detection Engine
 * 
 * Detects and analyzes changes in people and companies
 * Matches commercial monitoring platform capabilities
 */

export interface PersonSignal {
  id: string;
  type: 'promotion' | 'departure' | 'new_job' | 'post' | 'skill_update';
  person: {
    name: string;
    linkedinUrl?: string;
    currentRole?: string;
    company?: string;
  };
  details: {
    previousRole?: string;
    newRole?: string;
    previousCompany?: string;
    newCompany?: string;
    postContent?: string;
    skills?: string[];
  };
  confidence: number;
  timestamp: string;
  source: string;
}

export interface CompanySignal {
  id: string;
  type: 'hiring' | 'job_listing' | 'traffic_change' | 'funding' | 'expansion';
  company: {
    name: string;
    website?: string;
    domain?: string;
  };
  details: {
    jobCount?: number;
    jobTypes?: string[];
    trafficChange?: number;
    currentVisitors?: string;
    fundingAmount?: number;
    locations?: string[];
  };
  confidence: number;
  timestamp: string;
  source: string;
}

class SignalDetectionEngine {
  private previousData: Map<string, any> = new Map();
  private signalCallbacks: ((signal: PersonSignal | CompanySignal) => void)[] = [];

  // Register callback for real-time signal processing
  onSignalDetected(callback: (signal: PersonSignal | CompanySignal) => void) {
    this.signalCallbacks.push(callback);
  }

  // Analyze person data for changes
  async analyzePersonData(personId: string, currentData: any, previousData: any = null): Promise<PersonSignal[]> {
    const signals: PersonSignal[] = [];
    const now = new Date().toISOString();

    // Store current data for future comparison
    this.previousData.set(personId, currentData);

    if (!previousData) {
      previousData = this.previousData.get(personId);
    }

    if (!previousData) {
      return signals; // No previous data to compare
    }

    // Detect promotion
    const promotionSignal = this.detectPromotion(personId, currentData, previousData, now);
    if (promotionSignal) signals.push(promotionSignal);

    // Detect departure
    const departureSignal = this.detectDeparture(personId, currentData, previousData, now);
    if (departureSignal) signals.push(departureSignal);

    // Detect new job
    const newJobSignal = this.detectNewJob(personId, currentData, previousData, now);
    if (newJobSignal) signals.push(newJobSignal);

    // Detect new posts
    const postSignal = this.detectNewPost(personId, currentData, previousData, now);
    if (postSignal) signals.push(postSignal);

    // Detect skill updates
    const skillSignal = this.detectSkillUpdate(personId, currentData, previousData, now);
    if (skillSignal) signals.push(skillSignal);

    // Trigger callbacks for detected signals
    signals.forEach(signal => {
      this.signalCallbacks.forEach(callback => callback(signal));
    });

    return signals;
  }

  // Analyze company data for changes
  async analyzeCompanyData(companyId: string, currentData: any, previousData: any = null): Promise<CompanySignal[]> {
    const signals: CompanySignal[] = [];
    const now = new Date().toISOString();

    // Store current data for future comparison
    this.previousData.set(companyId, currentData);

    if (!previousData) {
      previousData = this.previousData.get(companyId);
    }

    if (!previousData) {
      return signals; // No previous data to compare
    }

    // Detect hiring changes
    const hiringSignal = this.detectHiringChange(companyId, currentData, previousData, now);
    if (hiringSignal) signals.push(hiringSignal);

    // Detect new job listings
    const jobListingSignal = this.detectNewJobListings(companyId, currentData, previousData, now);
    if (jobListingSignal) signals.push(jobListingSignal);

    // Detect traffic changes
    const trafficSignal = this.detectTrafficChange(companyId, currentData, previousData, now);
    if (trafficSignal) signals.push(trafficSignal);

    // Detect funding changes
    const fundingSignal = this.detectFundingChange(companyId, currentData, previousData, now);
    if (fundingSignal) signals.push(fundingSignal);

    // Detect expansion
    const expansionSignal = this.detectExpansion(companyId, currentData, previousData, now);
    if (expansionSignal) signals.push(expansionSignal);

    // Trigger callbacks for detected signals
    signals.forEach(signal => {
      this.signalCallbacks.forEach(callback => callback(signal));
    });

    return signals;
  }

  private detectPromotion(personId: string, current: any, previous: any, timestamp: string): PersonSignal | null {
    const currentTitle = current.headline || current.title;
    const previousTitle = previous.headline || previous.title;
    
    if (!currentTitle || !previousTitle) return null;

    // Check for promotion indicators
    const promotionKeywords = ['VP', 'Director', 'Manager', 'Lead', 'Head', 'Chief', 'Senior', 'Principal'];
    const currentLevel = this.getSeniorityLevel(currentTitle);
    const previousLevel = this.getSeniorityLevel(previousTitle);

    if (currentLevel > previousLevel && current.company === previous.company) {
      return {
        id: `promotion-${personId}-${Date.now()}`,
        type: 'promotion',
        person: {
          name: current.name,
          linkedinUrl: current.linkedinUrl,
          currentRole: currentTitle,
          company: current.company
        },
        details: {
          previousRole: previousTitle,
          newRole: currentTitle
        },
        confidence: 0.85,
        timestamp,
        source: 'linkedin_analysis'
      };
    }

    return null;
  }

  private detectDeparture(personId: string, current: any, previous: any, timestamp: string): PersonSignal | null {
    if (current.company !== previous.company && !current.newJobStartDate) {
      return {
        id: `departure-${personId}-${Date.now()}`,
        type: 'departure',
        person: {
          name: current.name,
          linkedinUrl: current.linkedinUrl,
          currentRole: previous.title,
          company: previous.company
        },
        details: {
          previousRole: previous.title,
          previousCompany: previous.company
        },
        confidence: 0.9,
        timestamp,
        source: 'linkedin_analysis'
      };
    }

    return null;
  }

  private detectNewJob(personId: string, current: any, previous: any, timestamp: string): PersonSignal | null {
    if (current.company !== previous.company && current.newJobStartDate) {
      return {
        id: `newjob-${personId}-${Date.now()}`,
        type: 'new_job',
        person: {
          name: current.name,
          linkedinUrl: current.linkedinUrl,
          currentRole: current.title,
          company: current.company
        },
        details: {
          previousCompany: previous.company,
          newCompany: current.company,
          newRole: current.title
        },
        confidence: 0.95,
        timestamp,
        source: 'linkedin_analysis'
      };
    }

    return null;
  }

  private detectNewPost(personId: string, current: any, previous: any, timestamp: string): PersonSignal | null {
    const currentPosts = current.posts || [];
    const previousPosts = previous.posts || [];
    
    if (currentPosts.length > previousPosts.length) {
      const latestPost = currentPosts[0]; // Assuming posts are sorted by date
      
      return {
        id: `post-${personId}-${Date.now()}`,
        type: 'post',
        person: {
          name: current.name,
          linkedinUrl: current.linkedinUrl
        },
        details: {
          postContent: latestPost.content || latestPost.text
        },
        confidence: 0.9,
        timestamp,
        source: 'linkedin_analysis'
      };
    }

    return null;
  }

  private detectSkillUpdate(personId: string, current: any, previous: any, timestamp: string): PersonSignal | null {
    const currentSkills = current.skills || [];
    const previousSkills = previous.skills || [];
    
    if (currentSkills.length > previousSkills.length) {
      const newSkills = currentSkills.filter((skill: string) => !previousSkills.includes(skill));
      
      return {
        id: `skills-${personId}-${Date.now()}`,
        type: 'skill_update',
        person: {
          name: current.name,
          linkedinUrl: current.linkedinUrl
        },
        details: {
          skills: newSkills
        },
        confidence: 0.8,
        timestamp,
        source: 'linkedin_analysis'
      };
    }

    return null;
  }

  private detectHiringChange(companyId: string, current: any, previous: any, timestamp: string): CompanySignal | null {
    const currentEmployeeCount = current.employeeCount || 0;
    const previousEmployeeCount = previous.employeeCount || 0;
    
    if (currentEmployeeCount > previousEmployeeCount) {
      const change = currentEmployeeCount - previousEmployeeCount;
      const percentChange = (change / previousEmployeeCount) * 100;

      return {
        id: `hiring-${companyId}-${Date.now()}`,
        type: 'hiring',
        company: {
          name: current.name,
          website: current.website,
          domain: current.domain
        },
        details: {
          jobCount: change,
          currentVisitors: currentEmployeeCount.toString()
        },
        confidence: 0.85,
        timestamp,
        source: 'company_analysis'
      };
    }

    return null;
  }

  private detectNewJobListings(companyId: string, current: any, previous: any, timestamp: string): CompanySignal | null {
    const currentJobs = current.jobListings || [];
    const previousJobs = previous.jobListings || [];
    
    if (currentJobs.length > previousJobs.length) {
      const newJobs = currentJobs.filter((job: any) => !previousJobs.some((prevJob: any) => prevJob.id === job.id));
      const jobTypes = newJobs.map((job: any) => job.category || job.type);

      return {
        id: `joblistings-${companyId}-${Date.now()}`,
        type: 'job_listing',
        company: {
          name: current.name,
          website: current.website,
          domain: current.domain
        },
        details: {
          jobCount: newJobs.length,
          jobTypes: [...new Set(jobTypes)]
        },
        confidence: 0.95,
        timestamp,
        source: 'company_careers'
      };
    }

    return null;
  }

  private detectTrafficChange(companyId: string, current: any, previous: any, timestamp: string): CompanySignal | null {
    const currentTraffic = current.websiteTraffic || 0;
    const previousTraffic = previous.websiteTraffic || 0;
    
    if (currentTraffic > 0 && previousTraffic > 0) {
      const percentChange = ((currentTraffic - previousTraffic) / previousTraffic) * 100;
      
      if (Math.abs(percentChange) > 5) { // Only flag changes > 5%
        return {
          id: `traffic-${companyId}-${Date.now()}`,
          type: 'traffic_change',
          company: {
            name: current.name,
            website: current.website,
            domain: current.domain
          },
          details: {
            trafficChange: Math.round(percentChange * 10) / 10,
            currentVisitors: current.estimatedVisitors || currentTraffic.toString()
          },
          confidence: 0.9,
          timestamp,
          source: 'web_analytics'
        };
      }
    }

    return null;
  }

  private detectFundingChange(companyId: string, current: any, previous: any, timestamp: string): CompanySignal | null {
    const currentFunding = current.totalFunding || 0;
    const previousFunding = previous.totalFunding || 0;
    
    if (currentFunding > previousFunding) {
      const newFunding = currentFunding - previousFunding;

      return {
        id: `funding-${companyId}-${Date.now()}`,
        type: 'funding',
        company: {
          name: current.name,
          website: current.website,
          domain: current.domain
        },
        details: {
          fundingAmount: newFunding
        },
        confidence: 0.95,
        timestamp,
        source: 'funding_analysis'
      };
    }

    return null;
  }

  private detectExpansion(companyId: string, current: any, previous: any, timestamp: string): CompanySignal | null {
    const currentLocations = current.locations || [];
    const previousLocations = previous.locations || [];
    
    if (currentLocations.length > previousLocations.length) {
      const newLocations = currentLocations.filter((loc: string) => !previousLocations.includes(loc));

      return {
        id: `expansion-${companyId}-${Date.now()}`,
        type: 'expansion',
        company: {
          name: current.name,
          website: current.website,
          domain: current.domain
        },
        details: {
          locations: newLocations
        },
        confidence: 0.9,
        timestamp,
        source: 'company_analysis'
      };
    }

    return null;
  }

  private getSeniorityLevel(title: string): number {
    const levels: Record<string, number> = {
      'Chief': 10,
      'VP': 9,
      'Vice President': 9,
      'Director': 8,
      'Head': 7,
      'Senior': 6,
      'Principal': 6,
      'Lead': 5,
      'Manager': 4,
      'Associate': 3,
      'Junior': 2,
      'Intern': 1
    };

    for (const [keyword, level] of Object.entries(levels)) {
      if (title.toLowerCase().includes(keyword.toLowerCase())) {
        return level;
      }
    }

    return 3; // Default level
  }

  // Process batch data for multiple entities
  async processBatchData(personUpdates: Array<{id: string, data: any}>, companyUpdates: Array<{id: string, data: any}>) {
    const allSignals: (PersonSignal | CompanySignal)[] = [];

    // Process person updates
    for (const update of personUpdates) {
      const signals = await this.analyzePersonData(update.id, update.data);
      allSignals.push(...signals);
    }

    // Process company updates
    for (const update of companyUpdates) {
      const signals = await this.analyzeCompanyData(update.id, update.data);
      allSignals.push(...signals);
    }

    return allSignals;
  }
}

export const signalDetectionEngine = new SignalDetectionEngine();
export default SignalDetectionEngine;