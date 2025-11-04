import cron from 'node-cron';
import { HeadlessClaudeAgentService } from '../services/HeadlessClaudeAgentService';

interface CronJobConfig {
  schedule: string; // cron expression
  enabled: boolean;
  timezone: string;
}

export class ClaudeAgentCronScheduler {
  private jobs: Map<string, cron.ScheduledTask> = new Map();
  private claudeService: HeadlessClaudeAgentService;
  private config: CronJobConfig;

  constructor(claudeService: HeadlessClaudeAgentService, config: CronJobConfig) {
    this.claudeService = claudeService;
    this.config = config;
  }

  /**
   * Start all scheduled jobs
   */
  start(): void {
    if (!this.config.enabled) {
      console.log('Claude Agent cron scheduler is disabled');
      return;
    }

    // Daily RFP scraping at 9:00 AM
    this.scheduleJob(
      'daily-rfp-scraping',
      '0 9 * * *', // 9:00 AM every day
      async () => {
        await this.executeWithRetry('daily-rfp-scraping', () => 
          this.claudeService.runDailyRFPScraping()
        );
      }
    );

    // RFP scraping at 2:00 PM (for real-time updates)
    this.scheduleJob(
      'afternoon-rfp-check',
      '0 14 * * *', // 2:00 PM every day
      async () => {
        await this.executeWithRetry('afternoon-rfp-check', () => 
          this.claudeService.runDailyRFPScraping()
        );
      }
    );

    // Hourly high-priority monitoring (business hours)
    this.scheduleJob(
      'hourly-monitoring',
      '0 9-17 * * 1-5', // Every hour from 9 AM to 5 PM, Monday to Friday
      async () => {
        await this.executeWithRetry('hourly-monitoring', async () => {
          // Quick check for urgent opportunities
          console.log('Running hourly high-priority RFP monitoring');
          return [];
        });
      }
    );

    console.log(`Claude Agent cron scheduler started with ${this.jobs.size} jobs`);
  }

  /**
   * Schedule a single job
   */
  private scheduleJob(name: string, schedule: string, task: () => Promise<void>): void {
    if (this.jobs.has(name)) {
      console.warn(`Job ${name} is already scheduled`);
      return;
    }

    try {
      const job = cron.schedule(schedule, task, {
        scheduled: true,
        timezone: this.config.timezone
      });

      this.jobs.set(name, job);
      console.log(`Scheduled job: ${name} with schedule: ${schedule}`);
    } catch (error) {
      console.error(`Failed to schedule job ${name}:`, error);
    }
  }

  /**
   * Execute task with retry logic
   */
  private async executeWithRetry(jobName: string, task: () => Promise<any>, maxRetries: number = 3): Promise<void> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Executing ${jobName} (attempt ${attempt}/${maxRetries})`);
        const result = await task();
        console.log(`Successfully completed ${jobName} on attempt ${attempt}`);
        return;
      } catch (error) {
        lastError = error;
        console.error(`Attempt ${attempt} failed for ${jobName}:`, error.message);
        
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(`Retrying ${jobName} in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error(`All ${maxRetries} attempts failed for ${jobName}. Last error:`, lastError.message);
    
    // Send error notification to Teams
    try {
      const { NotificationService } = await import('../services/NotificationService');
      const notificationService = new NotificationService();
      await notificationService.sendNotification({
        type: 'cron_job_failure',
        title: `❌ Cron Job Failed: ${jobName}`,
        content: `Job ${jobName} failed after ${maxRetries} attempts.\n\nLast error: ${lastError.message}`,
        channels: ['teams'],
        metadata: {
          urgency_level: 'high',
          jobName,
          attempts: maxRetries,
          lastError: lastError.message,
          timestamp: new Date().toISOString()
        }
      });
    } catch (notificationError) {
      console.error('Failed to send error notification:', notificationError);
    }
  }

  /**
   * Stop all scheduled jobs
   */
  stop(): void {
    this.jobs.forEach((job, name) => {
      job.stop();
      console.log(`Stopped job: ${name}`);
    });
    this.jobs.clear();
    console.log('Claude Agent cron scheduler stopped');
  }

  /**
   * Stop a specific job
   */
  stopJob(name: string): boolean {
    const job = this.jobs.get(name);
    if (job) {
      job.stop();
      this.jobs.delete(name);
      console.log(`Stopped job: ${name}`);
      return true;
    }
    return false;
  }

  /**
   * Manually trigger a job
   */
  async triggerJob(name: string): Promise<boolean> {
    try {
      switch (name) {
        case 'daily-rfp-scraping':
        case 'afternoon-rfp-check':
          await this.claudeService.runDailyRFPScraping();
          break;
        case 'hourly-monitoring':
          console.log('Running manual hourly monitoring');
          break;
        default:
          console.error(`Unknown job: ${name}`);
          return false;
      }
      
      console.log(`Manually triggered job: ${name}`);
      return true;
    } catch (error) {
      console.error(`Failed to trigger job ${name}:`, error);
      return false;
    }
  }

  /**
   * Get status of all jobs
   */
  getStatus(): {
    enabled: boolean;
    jobs: Array<{ name: string; running: boolean; lastRun?: Date }>;
    claudeService: { isRunning: boolean };
  } {
    return {
      enabled: this.config.enabled,
      jobs: Array.from(this.jobs.keys()).map(name => ({
        name,
        running: this.jobs.get(name)?.running || false
      })),
      claudeService: this.claudeService.getStatus()
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<CronJobConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (!this.config.enabled) {
      this.stop();
    } else if (this.jobs.size === 0) {
      this.start();
    }
  }
}