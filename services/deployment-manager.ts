import { ProductionDeployer, DeploymentConfig, DeploymentPlan, HealthCheck } from './production-deployment.js';
import { Logger } from './logger.js';
import { EventEmitter } from 'events';

export interface DeploymentProgress {
  deploymentId: string;
  phase: string;
  step: string;
  progress: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  message: string;
  timestamp: Date;
}

export interface DeploymentNotification {
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  deploymentId: string;
  timestamp: Date;
  data?: any;
}

export interface DeploymentMetrics {
  deploymentId: string;
  duration: number;
  phasesCompleted: number;
  totalPhases: number;
  stepsCompleted: number;
  totalSteps: number;
  successRate: number;
  errors: string[];
  warnings: string[];
  timestamp: Date;
}

export class DeploymentManager extends EventEmitter {
  private deployer: ProductionDeployer;
  private logger: Logger;
  private activeDeployments: Map<string, DeploymentPlan> = new Map();
  private deploymentMetrics: Map<string, DeploymentMetrics> = new Map();
  private notificationSubscribers: Map<string, Function[]> = new Map();

  constructor(config: DeploymentConfig) {
    super();
    this.logger = new Logger('DeploymentManager');
    this.deployer = new ProductionDeployer(config);
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing deployment manager');
      
      await this.deployer.initialize();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Load active deployments
      await this.loadActiveDeployments();
      
      this.logger.info('Deployment manager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize deployment manager', { error });
      throw error;
    }
  }

  private setupEventListeners(): void {
    this.deployer.on('deploymentStarted', (deployment: DeploymentPlan) => {
      this.handleDeploymentStarted(deployment);
    });

    this.deployer.on('phaseStarted', (phase: any) => {
      this.handlePhaseStarted(phase);
    });

    this.deployer.on('stepStarted', (step: any) => {
      this.handleStepStarted(step);
    });

    this.deployer.on('stepCompleted', (step: any) => {
      this.handleStepCompleted(step);
    });

    this.deployer.on('stepFailed', (step: any) => {
      this.handleStepFailed(step);
    });

    this.deployer.on('phaseCompleted', (phase: any) => {
      this.handlePhaseCompleted(phase);
    });

    this.deployer.on('deploymentCompleted', (deployment: DeploymentPlan) => {
      this.handleDeploymentCompleted(deployment);
    });

    this.deployer.on('deploymentFailed', (deployment: DeploymentPlan) => {
      this.handleDeploymentFailed(deployment);
    });

    this.deployer.on('rollbackStarted', (deployment: DeploymentPlan) => {
      this.handleRollbackStarted(deployment);
    });

    this.deployer.on('rollbackCompleted', (deployment: DeploymentPlan) => {
      this.handleRollbackCompleted(deployment);
    });
  }

  private async loadActiveDeployments(): Promise<void> {
    // Load any active deployments from persistent storage
    this.logger.info('Loading active deployments');
    // Implementation would load from database or file system
  }

  async startDeployment(config?: Partial<DeploymentConfig>): Promise<DeploymentPlan> {
    try {
      this.logger.info('Starting new deployment');
      
      // Create deployment ID
      const deploymentId = `deploy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Start deployment
      const deployment = await this.deployer.executeDeployment();
      
      // Track deployment
      this.activeDeployments.set(deployment.id, deployment);
      
      // Initialize metrics
      this.initializeMetrics(deployment.id);
      
      // Notify subscribers
      await this.notifySubscribers({
        type: 'info',
        title: 'Deployment Started',
        message: `Deployment ${deployment.id} has started`,
        deploymentId: deployment.id,
        timestamp: new Date()
      });
      
      this.emit('deploymentStarted', deployment);
      
      return deployment;
    } catch (error) {
      this.logger.error('Failed to start deployment', { error });
      throw error;
    }
  }

  async getDeploymentStatus(deploymentId: string): Promise<DeploymentPlan | null> {
    try {
      const deployment = await this.deployer.getDeploymentStatus(deploymentId);
      if (deployment) {
        this.activeDeployments.set(deploymentId, deployment);
      }
      return deployment;
    } catch (error) {
      this.logger.error('Failed to get deployment status', { deploymentId, error });
      return null;
    }
  }

  async listDeployments(): Promise<DeploymentPlan[]> {
    return Array.from(this.activeDeployments.values());
  }

  async cancelDeployment(deploymentId: string): Promise<boolean> {
    try {
      this.logger.info(`Canceling deployment: ${deploymentId}`);
      
      const deployment = this.activeDeployments.get(deploymentId);
      if (!deployment) {
        throw new Error(`Deployment not found: ${deploymentId}`);
      }
      
      if (deployment.status === 'completed' || deployment.status === 'failed') {
        throw new Error(`Cannot cancel deployment with status: ${deployment.status}`);
      }
      
      // Execute rollback
      await this.deployer.executeRollback();
      
      deployment.status = 'failed';
      this.activeDeployments.set(deploymentId, deployment);
      
      // Update metrics
      this.updateMetrics(deploymentId, { status: 'cancelled' });
      
      // Notify subscribers
      await this.notifySubscribers({
        type: 'warning',
        title: 'Deployment Cancelled',
        message: `Deployment ${deploymentId} has been cancelled`,
        deploymentId: deployment.id,
        timestamp: new Date()
      });
      
      this.emit('deploymentCancelled', deployment);
      
      return true;
    } catch (error) {
      this.logger.error('Failed to cancel deployment', { deploymentId, error });
      return false;
    }
  }

  async retryDeployment(deploymentId: string): Promise<DeploymentPlan> {
    try {
      this.logger.info(`Retrying deployment: ${deploymentId}`);
      
      const deployment = this.activeDeployments.get(deploymentId);
      if (!deployment) {
        throw new Error(`Deployment not found: ${deploymentId}`);
      }
      
      if (deployment.status !== 'failed') {
        throw new Error(`Can only retry failed deployments. Current status: ${deployment.status}`);
      }
      
      // Reset deployment status and retry
      deployment.status = 'pending';
      deployment.phases.forEach(phase => {
        phase.status = 'pending';
        phase.steps.forEach(step => {
          step.status = 'pending';
          step.output = undefined;
          step.error = undefined;
          step.startTime = undefined;
          step.endTime = undefined;
        });
      });
      
      // Execute deployment again
      const newDeployment = await this.deployer.executeDeployment();
      
      this.activeDeployments.set(newDeployment.id, newDeployment);
      
      // Reset metrics
      this.initializeMetrics(newDeployment.id);
      
      // Notify subscribers
      await this.notifySubscribers({
        type: 'info',
        title: 'Deployment Retried',
        message: `Deployment ${newDeployment.id} has been retried`,
        deploymentId: newDeployment.id,
        timestamp: new Date()
      });
      
      this.emit('deploymentRetried', newDeployment);
      
      return newDeployment;
    } catch (error) {
      this.logger.error('Failed to retry deployment', { deploymentId, error });
      throw error;
    }
  }

  async getDeploymentProgress(deploymentId: string): Promise<DeploymentProgress> {
    const deployment = this.activeDeployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }
    
    const currentPhase = deployment.phases.find(phase => 
      phase.status === 'in_progress'
    ) || deployment.phases.find(phase => 
      phase.status === 'pending'
    ) || deployment.phases[deployment.phases.length - 1];
    
    const currentStep = currentPhase?.steps.find(step => 
      step.status === 'in_progress'
    ) || currentPhase?.steps.find(step => 
      step.status === 'pending'
    ) || currentPhase?.steps[currentPhase.steps.length - 1];
    
    const totalPhases = deployment.phases.length;
    const completedPhases = deployment.phases.filter(p => p.status === 'completed').length;
    const totalSteps = deployment.phases.reduce((acc, phase) => acc + phase.steps.length, 0);
    const completedSteps = deployment.phases.reduce((acc, phase) => 
      acc + phase.steps.filter(s => s.status === 'completed').length, 0);
    
    const progress = (completedSteps / totalSteps) * 100;
    
    return {
      deploymentId,
      phase: currentPhase?.name || 'Unknown',
      step: currentStep?.name || 'Unknown',
      progress,
      status: deployment.status,
      message: this.generateProgressMessage(deployment),
      timestamp: new Date()
    };
  }

  private generateProgressMessage(deployment: DeploymentPlan): string {
    switch (deployment.status) {
      case 'pending':
        return 'Deployment is waiting to start';
      case 'in_progress':
        const currentPhase = deployment.phases.find(p => p.status === 'in_progress');
        return currentPhase ? `Executing phase: ${currentPhase.name}` : 'Deployment in progress';
      case 'completed':
        return 'Deployment completed successfully';
      case 'failed':
        return 'Deployment failed';
      case 'rolled_back':
        return 'Deployment was rolled back';
      default:
        return 'Unknown deployment status';
    }
  }

  async getDeploymentMetrics(deploymentId: string): Promise<DeploymentMetrics> {
    const metrics = this.deploymentMetrics.get(deploymentId);
    if (!metrics) {
      throw new Error(`Metrics not found for deployment: ${deploymentId}`);
    }
    
    // Update metrics with current status
    const deployment = this.activeDeployments.get(deploymentId);
    if (deployment) {
      const completedPhases = deployment.phases.filter(p => p.status === 'completed').length;
      const totalPhases = deployment.phases.length;
      const completedSteps = deployment.phases.reduce((acc, phase) => 
        acc + phase.steps.filter(s => s.status === 'completed').length, 0);
      const totalSteps = deployment.phases.reduce((acc, phase) => 
        acc + phase.steps.length, 0);
      
      metrics.phasesCompleted = completedPhases;
      metrics.totalPhases = totalPhases;
      metrics.stepsCompleted = completedSteps;
      metrics.totalSteps = totalSteps;
      metrics.successRate = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
      metrics.timestamp = new Date();
    }
    
    return metrics;
  }

  async getSystemHealth(): Promise<any> {
    try {
      return await this.deployer.getHealthStatus();
    } catch (error) {
      this.logger.error('Failed to get system health', { error });
      throw error;
    }
  }

  async generateDeploymentReport(deploymentId: string): Promise<string> {
    try {
      return await this.deployer.generateDeploymentReport();
    } catch (error) {
      this.logger.error('Failed to generate deployment report', { deploymentId, error });
      throw error;
    }
  }

  // Notification Management
  async subscribeToNotifications(deploymentId: string, callback: Function): Promise<void> {
    if (!this.notificationSubscribers.has(deploymentId)) {
      this.notificationSubscribers.set(deploymentId, []);
    }
    
    const subscribers = this.notificationSubscribers.get(deploymentId);
    subscribers.push(callback);
    
    this.logger.info(`Added notification subscriber for deployment: ${deploymentId}`);
  }

  async unsubscribeFromNotifications(deploymentId: string, callback: Function): Promise<void> {
    const subscribers = this.notificationSubscribers.get(deploymentId);
    if (subscribers) {
      const index = subscribers.indexOf(callback);
      if (index > -1) {
        subscribers.splice(index, 1);
      }
      
      if (subscribers.length === 0) {
        this.notificationSubscribers.delete(deploymentId);
      }
    }
    
    this.logger.info(`Removed notification subscriber for deployment: ${deploymentId}`);
  }

  private async notifySubscribers(notification: DeploymentNotification): Promise<void> {
    const subscribers = this.notificationSubscribers.get(notification.deploymentId);
    if (subscribers) {
      for (const callback of subscribers) {
        try {
          await callback(notification);
        } catch (error) {
          this.logger.error('Notification callback failed', { error });
        }
      }
    }
  }

  // Event Handlers
  private handleDeploymentStarted(deployment: DeploymentPlan): void {
    this.logger.info(`Deployment started: ${deployment.id}`);
    this.updateMetrics(deployment.id, { status: 'started' });
  }

  private handlePhaseStarted(phase: any): void {
    this.logger.info(`Phase started: ${phase.name}`);
    this.emit('phaseStarted', phase);
  }

  private handleStepStarted(step: any): void {
    this.logger.info(`Step started: ${step.name}`);
    this.emit('stepStarted', step);
  }

  private handleStepCompleted(step: any): void {
    this.logger.info(`Step completed: ${step.name}`);
    this.emit('stepCompleted', step);
  }

  private handleStepFailed(step: any): void {
    this.logger.error(`Step failed: ${step.name}`);
    this.emit('stepFailed', step);
  }

  private handlePhaseCompleted(phase: any): void {
    this.logger.info(`Phase completed: ${phase.name}`);
    this.emit('phaseCompleted', phase);
  }

  private handleDeploymentCompleted(deployment: DeploymentPlan): void {
    this.logger.info(`Deployment completed: ${deployment.id}`);
    this.updateMetrics(deployment.id, { status: 'completed' });
    this.emit('deploymentCompleted', deployment);
  }

  private handleDeploymentFailed(deployment: DeploymentPlan): void {
    this.logger.error(`Deployment failed: ${deployment.id}`);
    this.updateMetrics(deployment.id, { status: 'failed' });
    this.emit('deploymentFailed', deployment);
  }

  private handleRollbackStarted(deployment: DeploymentPlan): void {
    this.logger.info(`Rollback started: ${deployment.id}`);
    this.emit('rollbackStarted', deployment);
  }

  private handleRollbackCompleted(deployment: DeploymentPlan): void {
    this.logger.info(`Rollback completed: ${deployment.id}`);
    this.emit('rollbackCompleted', deployment);
  }

  // Metrics Management
  private initializeMetrics(deploymentId: string): void {
    const metrics: DeploymentMetrics = {
      deploymentId,
      duration: 0,
      phasesCompleted: 0,
      totalPhases: 0,
      stepsCompleted: 0,
      totalSteps: 0,
      successRate: 0,
      errors: [],
      warnings: [],
      timestamp: new Date()
    };
    
    this.deploymentMetrics.set(deploymentId, metrics);
  }

  private updateMetrics(deploymentId: string, updates: Partial<DeploymentMetrics>): void {
    const metrics = this.deploymentMetrics.get(deploymentId);
    if (metrics) {
      Object.assign(metrics, updates, { timestamp: new Date() });
      this.deploymentMetrics.set(deploymentId, metrics);
    }
  }

  async getDeploymentHistory(): Promise<DeploymentPlan[]> {
    // Return historical deployments
    // Implementation would load from database or file system
    return Array.from(this.activeDeployments.values());
  }

  async getDeploymentStatistics(): Promise<any> {
    const deployments = Array.from(this.activeDeployments.values());
    
    const statistics = {
      totalDeployments: deployments.length,
      completedDeployments: deployments.filter(d => d.status === 'completed').length,
      failedDeployments: deployments.filter(d => d.status === 'failed').length,
      activeDeployments: deployments.filter(d => d.status === 'in_progress').length,
      averageDeploymentTime: this.calculateAverageDeploymentTime(deployments),
      successRate: this.calculateSuccessRate(deployments),
      mostCommonErrors: this.getMostCommonErrors(deployments),
      deploymentTrends: this.getDeploymentTrends(deployments)
    };
    
    return statistics;
  }

  private calculateAverageDeploymentTime(deployments: DeploymentPlan[]): number {
    const completedDeployments = deployments.filter(d => d.status === 'completed');
    if (completedDeployments.length === 0) return 0;
    
    const totalTime = completedDeployments.reduce((acc, deployment) => {
      const duration = deployment.phases.reduce((phaseAcc, phase) => {
        return phaseAcc + (phase.actualDuration || 0);
      }, 0);
      return acc + duration;
    }, 0);
    
    return totalTime / completedDeployments.length;
  }

  private calculateSuccessRate(deployments: DeploymentPlan[]): number {
    if (deployments.length === 0) return 0;
    
    const successfulDeployments = deployments.filter(d => d.status === 'completed').length;
    return (successfulDeployments / deployments.length) * 100;
  }

  private getMostCommonErrors(deployments: DeploymentPlan[]): string[] {
    const errors: string[] = [];
    
    deployments.forEach(deployment => {
      deployment.phases.forEach(phase => {
        phase.steps.forEach(step => {
          if (step.error) {
            errors.push(step.error);
          }
        });
      });
    });
    
    // Return top 5 most common errors
    const errorCounts = errors.reduce((acc, error) => {
      acc[error] = (acc[error] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(errorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([error]) => error);
  }

  private getDeploymentTrends(deployments: DeploymentPlan[]): any {
    // Group deployments by time periods
    const now = new Date();
    const last24Hours = deployments.filter(d => 
      new Date(d.timestamp).getTime() > now.getTime() - 24 * 60 * 60 * 1000
    );
    const last7Days = deployments.filter(d => 
      new Date(d.timestamp).getTime() > now.getTime() - 7 * 24 * 60 * 60 * 1000
    );
    const last30Days = deployments.filter(d => 
      new Date(d.timestamp).getTime() > now.getTime() - 30 * 24 * 60 * 60 * 1000
    );
    
    return {
      last24Hours: {
        total: last24Hours.length,
        completed: last24Hours.filter(d => d.status === 'completed').length,
        failed: last24Hours.filter(d => d.status === 'failed').length
      },
      last7Days: {
        total: last7Days.length,
        completed: last7Days.filter(d => d.status === 'completed').length,
        failed: last7Days.filter(d => d.status === 'failed').length
      },
      last30Days: {
        total: last30Days.length,
        completed: last30Days.filter(d => d.status === 'completed').length,
        failed: last30Days.filter(d => d.status === 'failed').length
      }
    };
  }

  async cleanup(): Promise<void> {
    try {
      this.logger.info('Cleaning up deployment manager');
      
      // Clean up active deployments
      for (const [deploymentId, deployment] of this.activeDeployments) {
        if (deployment.status === 'completed' || deployment.status === 'failed') {
          this.activeDeployments.delete(deploymentId);
          this.deploymentMetrics.delete(deploymentId);
          this.notificationSubscribers.delete(deploymentId);
        }
      }
      
      // Clean up deployer
      await this.deployer.cleanup();
      
      this.logger.info('Deployment manager cleanup completed');
    } catch (error) {
      this.logger.error('Failed to cleanup deployment manager', { error });
      throw error;
    }
  }
}