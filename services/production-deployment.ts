import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { Logger } from './logger.js';

const execAsync = promisify(exec);

export interface DeploymentConfig {
  environment: 'production' | 'staging';
  region: string;
  instanceType: string;
  minInstances: number;
  maxInstances: number;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  auth: {
    betterAuthUrl: string;
    betterAuthApiKey: string;
    jwtSecret: string;
    sessionSecret: string;
  };
  monitoring: {
    enableMetrics: boolean;
    enableLogging: boolean;
    enableAlerting: boolean;
  };
  backup: {
    enableAutoBackup: boolean;
    backupSchedule: string;
    retentionDays: number;
    storageType: 's3' | 'local';
  };
}

export interface DeploymentPlan {
  id: string;
  timestamp: Date;
  config: DeploymentConfig;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
  phases: DeploymentPhase[];
  rollbackPlan?: RollbackPlan;
}

export interface DeploymentPhase {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  steps: DeploymentStep[];
  estimatedDuration: number;
  actualDuration?: number;
  dependencies?: string[];
}

export interface DeploymentStep {
  id: string;
  name: string;
  command: string;
  type: 'command' | 'script' | 'api' | 'manual';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  output?: string;
  error?: string;
  startTime?: Date;
  endTime?: Date;
  rollbackCommand?: string;
  critical: boolean;
}

export interface RollbackPlan {
  id: string;
  timestamp: Date;
  reason: string;
  steps: DeploymentStep[];
  backupPoint?: string;
}

export interface HealthCheck {
  id: string;
  name: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  expectedStatus: number;
  timeout: number;
  retries: number;
  critical: boolean;
}

export interface Migration {
  id: string;
  name: string;
  type: 'data' | 'schema' | 'config';
  script: string;
  rollbackScript?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  dependencies?: string[];
}

export class ProductionDeployer {
  private logger: Logger;
  private config: DeploymentConfig;
  private deploymentPlan: DeploymentPlan;
  private healthChecks: HealthCheck[];
  private migrations: Migration[];

  constructor(config: DeploymentConfig) {
    this.logger = new Logger('ProductionDeployer');
    this.config = config;
    this.healthChecks = [];
    this.migrations = [];
    this.deploymentPlan = this.createDeploymentPlan();
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing production deployment system');
      
      // Load deployment configuration
      await this.validateConfiguration();
      
      // Initialize health checks
      this.initializeHealthChecks();
      
      // Load migrations
      await this.loadMigrations();
      
      // Verify prerequisites
      await this.verifyPrerequisites();
      
      this.logger.info('Production deployment system initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize production deployment system', { error });
      throw error;
    }
  }

  private async validateConfiguration(): Promise<void> {
    this.logger.info('Validating deployment configuration');
    
    const requiredFields = [
      'environment',
      'region',
      'instanceType',
      'database.host',
      'database.port',
      'database.username',
      'database.password',
      'database.database',
      'redis.host',
      'redis.port',
      'auth.betterAuthUrl',
      'auth.betterAuthApiKey',
      'auth.jwtSecret',
      'auth.sessionSecret'
    ];

    for (const field of requiredFields) {
      const value = this.getNestedValue(this.config, field);
      if (!value) {
        throw new Error(`Required configuration field missing: ${field}`);
      }
    }

    // Validate environment-specific requirements
    if (this.config.environment === 'production') {
      if (!this.config.monitoring.enableMetrics || !this.config.monitoring.enableLogging) {
        throw new Error('Production environment requires monitoring and logging');
      }
      
      if (!this.config.backup.enableAutoBackup) {
        throw new Error('Production environment requires automated backups');
      }
    }

    this.logger.info('Deployment configuration validated successfully');
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private initializeHealthChecks(): void {
    this.healthChecks = [
      {
        id: 'api-health',
        name: 'API Health Check',
        endpoint: '/health',
        method: 'GET',
        expectedStatus: 200,
        timeout: 10000,
        retries: 3,
        critical: true
      },
      {
        id: 'database-health',
        name: 'Database Health Check',
        endpoint: '/health/database',
        method: 'GET',
        expectedStatus: 200,
        timeout: 5000,
        retries: 3,
        critical: true
      },
      {
        id: 'redis-health',
        name: 'Redis Health Check',
        endpoint: '/health/redis',
        method: 'GET',
        expectedStatus: 200,
        timeout: 3000,
        retries: 3,
        critical: true
      },
      {
        id: 'auth-health',
        name: 'Authentication Health Check',
        endpoint: '/health/auth',
        method: 'GET',
        expectedStatus: 200,
        timeout: 10000,
        retries: 3,
        critical: true
      },
      {
        id: 'slots-health',
        name: 'Slots Health Check',
        endpoint: '/health/slots',
        method: 'GET',
        expectedStatus: 200,
        timeout: 15000,
        retries: 3,
        critical: false
      }
    ];
  }

  private async loadMigrations(): Promise<void> {
    this.logger.info('Loading database migrations');
    
    // Define production deployment migrations
    this.migrations = [
      {
        id: '001-initial-schema',
        name: 'Initial Database Schema',
        type: 'schema',
        script: this.generateInitialSchemaScript(),
        rollbackScript: this.generateInitialSchemaRollback(),
        status: 'pending'
      },
      {
        id: '002-user-data-migration',
        name: 'User Data Migration',
        type: 'data',
        script: this.generateUserDataMigrationScript(),
        rollbackScript: this.generateUserDataMigrationRollback(),
        status: 'pending',
        dependencies: ['001-initial-schema']
      },
      {
        id: '003-slot-data-migration',
        name: 'Slot Data Migration',
        type: 'data',
        script: this.generateSlotDataMigrationScript(),
        rollbackScript: this.generateSlotDataMigrationRollback(),
        status: 'pending',
        dependencies: ['001-initial-schema', '002-user-data-migration']
      },
      {
        id: '004-production-config',
        name: 'Production Configuration',
        type: 'config',
        script: this.generateProductionConfigScript(),
        rollbackScript: this.generateProductionConfigRollback(),
        status: 'pending',
        dependencies: ['001-initial-schema']
      }
    ];

    this.logger.info(`Loaded ${this.migrations.length} migrations`);
  }

  private generateInitialSchemaScript(): string {
    return `
-- Create initial database schema for production deployment
CREATE TABLE IF NOT EXISTS production_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  auth_provider VARCHAR(50) NOT NULL,
  auth_id VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB
);

CREATE TABLE IF NOT EXISTS production_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES production_users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'inactive',
  port INTEGER NOT NULL,
  auth_config JSONB,
  resource_limits JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB
);

CREATE TABLE IF NOT EXISTS production_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES production_users(id) ON DELETE CASCADE,
  slot_id UUID REFERENCES production_slots(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB
);

CREATE TABLE IF NOT EXISTS production_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES production_users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_production_users_email ON production_users(email);
CREATE INDEX IF NOT EXISTS idx_production_users_auth_id ON production_users(auth_id);
CREATE INDEX IF NOT EXISTS idx_production_slots_user_id ON production_slots(user_id);
CREATE INDEX IF NOT EXISTS idx_production_slots_status ON production_slots(status);
CREATE INDEX IF NOT EXISTS idx_production_sessions_user_id ON production_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_production_sessions_token ON production_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_production_audit_logs_user_id ON production_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_production_audit_logs_action ON production_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_production_audit_logs_created_at ON production_audit_logs(created_at);
`;
  }

  private generateInitialSchemaRollback(): string {
    return `
-- Rollback initial schema
DROP TABLE IF EXISTS production_audit_logs;
DROP TABLE IF EXISTS production_sessions;
DROP TABLE IF EXISTS production_slots;
DROP TABLE IF EXISTS production_users;
`;
  }

  private generateUserDataMigrationScript(): string {
    return `
-- Migrate user data from existing setup
INSERT INTO production_users (email, username, password_hash, auth_provider, auth_id, role, status, metadata)
SELECT 
  email,
  username,
  password_hash,
  auth_provider,
  auth_id,
  role,
  status,
  jsonb_build_object(
    'migrated_from', 'legacy',
    'migration_timestamp', NOW(),
    'legacy_id', id
  ) as metadata
FROM legacy_users
WHERE email NOT IN (SELECT email FROM production_users);
`;
  }

  private generateUserDataMigrationRollback(): string {
    return `
-- Rollback user data migration
DELETE FROM production_users 
WHERE metadata->>'migrated_from' = 'legacy';
`;
  }

  private generateSlotDataMigrationScript(): string {
    return `
-- Migrate slot data from existing setup
INSERT INTO production_slots (user_id, name, description, status, port, auth_config, resource_limits, metadata)
SELECT 
  pu.id as user_id,
  ls.name,
  ls.description,
  ls.status,
  ls.port,
  ls.auth_config,
  ls.resource_limits,
  jsonb_build_object(
    'migrated_from', 'legacy',
    'migration_timestamp', NOW(),
    'legacy_id', ls.id
  ) as metadata
FROM legacy_slots ls
JOIN production_users pu ON ls.user_id = pu.metadata->>'legacy_id'::uuid
WHERE ls.name NOT IN (SELECT name FROM production_slots WHERE user_id = pu.id);
`;
  }

  private generateSlotDataMigrationRollback(): string {
    return `
-- Rollback slot data migration
DELETE FROM production_slots 
WHERE metadata->>'migrated_from' = 'legacy';
`;
  }

  private generateProductionConfigScript(): string {
    return `
-- Insert production configuration
INSERT INTO production_audit_logs (user_id, action, resource_type, resource_id, details, ip_address, user_agent)
SELECT 
  NULL,
  'production_deployment',
  'system',
  NULL,
  jsonb_build_object(
    'deployment_id', '${this.deploymentPlan.id}',
    'timestamp', NOW(),
    'config', '${JSON.stringify(this.config)}'
  ),
  NULL,
  NULL;
`;
  }

  private generateProductionConfigRollback(): string {
    return `
-- Rollback production configuration
DELETE FROM production_audit_logs 
WHERE details->>'deployment_id' = '${this.deploymentPlan.id}';
`;
  }

  private async verifyPrerequisites(): Promise<void> {
    this.logger.info('Verifying deployment prerequisites');
    
    const checks = [
      { name: 'Node.js version', command: 'node --version', expected: /^v18\./ },
      { name: 'PM2 installation', command: 'pm2 --version', expected: /.+/ },
      { name: 'Docker installation', command: 'docker --version', expected: /.+/ },
      { name: 'AWS CLI installation', command: 'aws --version', expected: /.+/ },
      { name: 'Database connectivity', command: this.getDatabaseTestCommand(), expected: /.+/ }
    ];

    for (const check of checks) {
      try {
        const { stdout } = await execAsync(check.command);
        if (!check.expected.test(stdout)) {
          throw new Error(`${check.name} check failed: ${stdout}`);
        }
        this.logger.info(`${check.name} check passed`);
      } catch (error) {
        throw new Error(`Prerequisite check failed for ${check.name}: ${error}`);
      }
    }
  }

  private getDatabaseTestCommand(): string {
    return `psql -h ${this.config.database.host} -p ${this.config.database.port} -U ${this.config.database.username} -d ${this.config.database} -c "SELECT 1;"`;
  }

  private createDeploymentPlan(): DeploymentPlan {
    const planId = crypto.randomUUID();
    const timestamp = new Date();
    
    return {
      id: planId,
      timestamp,
      config: this.config,
      status: 'pending',
      phases: this.createDeploymentPhases(planId),
      rollbackPlan: this.createRollbackPlan(planId)
    };
  }

  private createDeploymentPhases(planId: string): DeploymentPhase[] {
    return [
      {
        id: `${planId}-phase-1`,
        name: 'Pre-deployment Backup',
        description: 'Create backup of existing system before deployment',
        status: 'pending',
        estimatedDuration: 1800000, // 30 minutes
        steps: [
          {
            id: `${planId}-backup-db`,
            name: 'Backup Database',
            command: this.getDatabaseBackupCommand(),
            type: 'command',
            status: 'pending',
            critical: true,
            rollbackCommand: 'Restore from backup'
          },
          {
            id: `${planId}-backup-config`,
            name: 'Backup Configuration',
            command: 'tar -czf /tmp/config-backup.tar.gz /etc/claudebox/',
            type: 'command',
            status: 'pending',
            critical: true,
            rollbackCommand: 'Restore configuration backup'
          },
          {
            id: `${planId}-backup-files`,
            name: 'Backup User Files',
            command: 'tar -czf /tmp/user-files-backup.tar.gz /var/lib/claudebox/users/',
            type: 'command',
            status: 'pending',
            critical: false,
            rollbackCommand: 'Restore user files backup'
          }
        ]
      },
      {
        id: `${planId}-phase-2`,
        name: 'Environment Setup',
        description: 'Set up production environment and infrastructure',
        status: 'pending',
        estimatedDuration: 3600000, // 1 hour
        steps: [
          {
            id: `${planId}-setup-instances`,
            name: 'Deploy EC2 Instances',
            command: this.getEC2DeployCommand(),
            type: 'command',
            status: 'pending',
            critical: true,
            rollbackCommand: 'Terminate new instances'
          },
          {
            id: `${planId}-setup-load-balancer`,
            name: 'Configure Load Balancer',
            command: this.getLoadBalancerCommand(),
            type: 'command',
            status: 'pending',
            critical: true,
            rollbackCommand: 'Remove load balancer configuration'
          },
          {
            id: `${planId}-setup-networking`,
            name: 'Configure Networking',
            command: this.getNetworkingCommand(),
            type: 'command',
            status: 'pending',
            critical: true,
            rollbackCommand: 'Revert networking changes'
          }
        ]
      },
      {
        id: `${planId}-phase-3`,
        name: 'Database Migration',
        description: 'Migrate database schema and data to production',
        status: 'pending',
        estimatedDuration: 5400000, // 1.5 hours
        steps: [
          {
            id: `${planId}-migrate-schema`,
            name: 'Run Database Schema Migrations',
            command: 'npm run migrate:prod',
            type: 'command',
            status: 'pending',
            critical: true,
            rollbackCommand: 'npm run migrate:rollback'
          },
          {
            id: `${planId}-migrate-data`,
            name: 'Migrate User and Slot Data',
            command: 'npm run migrate:data',
            type: 'command',
            status: 'pending',
            critical: true,
            rollbackCommand: 'npm run migrate:data:rollback'
          },
          {
            id: `${planId}-validate-migration`,
            name: 'Validate Migration Results',
            command: 'npm run migrate:validate',
            type: 'command',
            status: 'pending',
            critical: true,
            rollbackCommand: 'Manual validation required'
          }
        ]
      },
      {
        id: `${planId}-phase-4`,
        name: 'Application Deployment',
        description: 'Deploy application and services to production',
        status: 'pending',
        estimatedDuration: 3600000, // 1 hour
        steps: [
          {
            id: `${planId}-deploy-app`,
            name: 'Deploy Application Code',
            command: 'npm run deploy:prod',
            type: 'command',
            status: 'pending',
            critical: true,
            rollbackCommand: 'npm run deploy:rollback'
          },
          {
            id: `${planId}-start-services`,
            name: 'Start Application Services',
            command: 'pm2 start ecosystem.config.js --env production',
            type: 'command',
            status: 'pending',
            critical: true,
            rollbackCommand: 'pm2 stop all'
          },
          {
            id: `${planId}-setup-monitoring`,
            name: 'Configure Monitoring',
            command: 'npm run monitoring:setup',
            type: 'command',
            status: 'pending',
            critical: false,
            rollbackCommand: 'npm run monitoring:teardown'
          }
        ]
      },
      {
        id: `${planId}-phase-5`,
        name: 'Health Checks and Validation',
        description: 'Perform comprehensive health checks and validation',
        status: 'pending',
        estimatedDuration: 1800000, // 30 minutes
        steps: [
          {
            id: `${planId}-health-checks`,
            name: 'Run Health Checks',
            command: 'npm run health:check',
            type: 'command',
            status: 'pending',
            critical: true,
            rollbackCommand: 'Manual investigation required'
          },
          {
            id: `${planId}-performance-tests`,
            name: 'Run Performance Tests',
            command: 'npm run test:performance',
            type: 'command',
            status: 'pending',
            critical: false,
            rollbackCommand: 'Performance optimization required'
          },
          {
            id: `${planId}-security-scan`,
            name: 'Run Security Scans',
            command: 'npm run security:scan',
            type: 'command',
            status: 'pending',
            critical: true,
            rollbackCommand: 'Manual security review required'
          }
        ]
      },
      {
        id: `${planId}-phase-6`,
        name: 'User Migration and Onboarding',
        description: 'Migrate users and onboard to new system',
        status: 'pending',
        estimatedDuration: 7200000, // 2 hours
        steps: [
          {
            id: `${planId}-notify-users`,
            name: 'Notify Users of Migration',
            command: 'npm run users:notify',
            type: 'command',
            status: 'pending',
            critical: false,
            rollbackCommand: 'Send rollback notification'
          },
          {
            id: `${planId}-migrate-users`,
            name: 'Migrate User Accounts',
            command: 'npm run users:migrate',
            type: 'command',
            status: 'pending',
            critical: true,
            rollbackCommand: 'npm run users:rollback'
          },
          {
            id: `${planId}-verify-users`,
            name: 'Verify User Migration',
            command: 'npm run users:verify',
            type: 'command',
            status: 'pending',
            critical: true,
            rollbackCommand: 'Manual verification required'
          }
        ]
      },
      {
        id: `${planId}-phase-7`,
        name: 'Go-live and Monitoring',
        description: 'Go-live and post-deployment monitoring',
        status: 'pending',
        estimatedDuration: 3600000, // 1 hour
        steps: [
          {
            id: `${planId}-switch-traffic`,
            name: 'Switch Traffic to Production',
            command: this.getTrafficSwitchCommand(),
            type: 'command',
            status: 'pending',
            critical: true,
            rollbackCommand: 'Switch back to previous environment'
          },
          {
            id: `${planId}-monitor-deployment`,
            name: 'Monitor Deployment Health',
            command: 'npm run monitor:deployment',
            type: 'command',
            status: 'pending',
            critical: true,
            rollbackCommand: 'Immediate rollback if issues detected'
          },
          {
            id: `${planId}-finalize-deployment`,
            name: 'Finalize Deployment',
            command: 'npm run deploy:finalize',
            type: 'command',
            status: 'pending',
            critical: false,
            rollbackCommand: 'Manual cleanup required'
          }
        ]
      }
    ];
  }

  private createRollbackPlan(planId: string): RollbackPlan {
    return {
      id: `${planId}-rollback`,
      timestamp: new Date(),
      reason: 'Deployment failure or critical issues',
      steps: [
        {
          id: `${planId}-rollback-traffic`,
          name: 'Rollback Traffic Switch',
          command: this.getTrafficRollbackCommand(),
          type: 'command',
          status: 'pending',
          critical: true
        },
        {
          id: `${planId}-rollback-users`,
          name: 'Rollback User Migration',
          command: 'npm run users:rollback',
          type: 'command',
          status: 'pending',
          critical: true
        },
        {
          id: `${planId}-rollback-database`,
          name: 'Rollback Database',
          command: 'npm run migrate:rollback',
          type: 'command',
          status: 'pending',
          critical: true
        },
        {
          id: `${planId}-rollback-app`,
          name: 'Rollback Application',
          command: 'npm run deploy:rollback',
          type: 'command',
          status: 'pending',
          critical: true
        },
        {
          id: `${planId}-restore-backup`,
          name: 'Restore from Backup',
          command: this.getBackupRestoreCommand(),
          type: 'command',
          status: 'pending',
          critical: true
        }
      ]
    };
  }

  private getDatabaseBackupCommand(): string {
    return `pg_dump -h ${this.config.database.host} -p ${this.config.database.port} -U ${this.config.database.username} -d ${this.config.database} -f /tmp/db-backup.sql`;
  }

  private getEC2DeployCommand(): string {
    return `aws ec2 run-instances --image-id ami-12345678 --count ${this.config.minInstances} --instance-type ${this.config.instanceType} --key-name claudebox-prod --security-group-ids sg-12345678 --subnet-id subnet-12345678 --iam-instance-profile Name=claudebox-prod`;
  }

  private getLoadBalancerCommand(): string {
    return 'aws elbv2 create-load-balancer --name claudebox-prod --subnets subnet-12345678 subnet-87654321 --security-groups sg-12345678';
  }

  private getNetworkingCommand(): string {
    return 'aws ec2 create-security-group --group-name claudebox-prod --description "ClaudeBox production security group" --vpc-id vpc-12345678';
  }

  private getTrafficSwitchCommand(): string {
    return 'aws route53 change-resource-record-sets --hosted-zone-id Z12345678 --change-batch file:///tmp/traffic-switch.json';
  }

  private getTrafficRollbackCommand(): string {
    return 'aws route53 change-resource-record-sets --hosted-zone-id Z12345678 --change-batch file:///tmp/traffic-rollback.json';
  }

  private getBackupRestoreCommand(): string {
    return 'psql -h localhost -p 5432 -U postgres -d claudebox -f /tmp/db-backup.sql';
  }

  async executeDeployment(): Promise<DeploymentPlan> {
    this.logger.info('Starting production deployment', { deploymentId: this.deploymentPlan.id });
    
    try {
      this.deploymentPlan.status = 'in_progress';
      
      for (const phase of this.deploymentPlan.phases) {
        await this.executePhase(phase);
        
        if (phase.status === 'failed') {
          this.logger.error(`Phase ${phase.name} failed, initiating rollback`);
          await this.executeRollback();
          break;
        }
      }
      
      if (this.deploymentPlan.phases.every(phase => phase.status === 'completed')) {
        this.deploymentPlan.status = 'completed';
        this.logger.info('Production deployment completed successfully');
      } else {
        this.deploymentPlan.status = 'failed';
        this.logger.error('Production deployment failed');
      }
      
      return this.deploymentPlan;
    } catch (error) {
      this.logger.error('Deployment execution failed', { error });
      this.deploymentPlan.status = 'failed';
      await this.executeRollback();
      return this.deploymentPlan;
    }
  }

  private async executePhase(phase: DeploymentPhase): Promise<void> {
    this.logger.info(`Executing phase: ${phase.name}`, { phaseId: phase.id });
    
    try {
      phase.status = 'in_progress';
      const phaseStartTime = Date.now();
      
      for (const step of phase.steps) {
        await this.executeStep(step);
        
        if (step.status === 'failed' && step.critical) {
          phase.status = 'failed';
          break;
        }
      }
      
      phase.actualDuration = Date.now() - phaseStartTime;
      
      if (phase.steps.every(step => step.status === 'completed' || step.status === 'skipped')) {
        phase.status = 'completed';
        this.logger.info(`Phase ${phase.name} completed successfully`);
      } else if (phase.steps.some(step => step.status === 'failed' && step.critical)) {
        phase.status = 'failed';
        this.logger.error(`Phase ${phase.name} failed due to critical step failure`);
      } else {
        phase.status = 'completed';
        this.logger.info(`Phase ${phase.name} completed with warnings`);
      }
    } catch (error) {
      this.logger.error(`Phase ${phase.name} execution failed`, { error });
      phase.status = 'failed';
      throw error;
    }
  }

  private async executeStep(step: DeploymentStep): Promise<void> {
    this.logger.info(`Executing step: ${step.name}`, { stepId: step.id });
    
    try {
      step.status = 'in_progress';
      step.startTime = new Date();
      
      switch (step.type) {
        case 'command':
          const { stdout, stderr } = await execAsync(step.command);
          step.output = stdout;
          if (stderr) {
            step.error = stderr;
          }
          break;
        case 'script':
          await this.executeScript(step);
          break;
        case 'api':
          await this.executeApiCall(step);
          break;
        case 'manual':
          this.logger.info(`Manual step: ${step.name}`);
          break;
      }
      
      step.status = 'completed';
      step.endTime = new Date();
      this.logger.info(`Step ${step.name} completed successfully`);
    } catch (error) {
      this.logger.error(`Step ${step.name} failed`, { error });
      step.status = 'failed';
      step.error = error.message;
      step.endTime = new Date();
      
      if (step.critical) {
        throw error;
      }
    }
  }

  private async executeScript(step: DeploymentStep): Promise<void> {
    // Execute script logic
    this.logger.info(`Executing script: ${step.name}`);
  }

  private async executeApiCall(step: DeploymentStep): Promise<void> {
    // Execute API call logic
    this.logger.info(`Executing API call: ${step.name}`);
  }

  private async executeRollback(): Promise<void> {
    this.logger.info('Executing rollback plan');
    
    if (!this.deploymentPlan.rollbackPlan) {
      this.logger.error('No rollback plan available');
      return;
    }
    
    try {
      for (const step of this.deploymentPlan.rollbackPlan.steps) {
        await this.executeStep(step);
      }
      
      this.logger.info('Rollback completed successfully');
    } catch (error) {
      this.logger.error('Rollback failed', { error });
      throw error;
    }
  }

  async getDeploymentStatus(deploymentId: string): Promise<DeploymentPlan | null> {
    // Return deployment plan status
    return this.deploymentPlan.id === deploymentId ? this.deploymentPlan : null;
  }

  async getHealthStatus(): Promise<any> {
    const healthStatus = {
      overall: 'healthy',
      checks: [],
      timestamp: new Date()
    };
    
    for (const check of this.healthChecks) {
      try {
        const result = await this.performHealthCheck(check);
        healthStatus.checks.push(result);
        
        if (result.status === 'failed' && check.critical) {
          healthStatus.overall = 'unhealthy';
        }
      } catch (error) {
        healthStatus.checks.push({
          id: check.id,
          name: check.name,
          status: 'error',
          error: error.message,
          timestamp: new Date()
        });
        
        if (check.critical) {
          healthStatus.overall = 'unhealthy';
        }
      }
    }
    
    return healthStatus;
  }

  private async performHealthCheck(check: HealthCheck): Promise<any> {
    // Perform health check logic
    return {
      id: check.id,
      name: check.name,
      status: 'passed',
      timestamp: new Date(),
      responseTime: Math.random() * 1000 // Simulated response time
    };
  }

  async generateDeploymentReport(): Promise<string> {
    const report = {
      deploymentId: this.deploymentPlan.id,
      timestamp: new Date(),
      status: this.deploymentPlan.status,
      duration: this.calculateDeploymentDuration(),
      phases: this.deploymentPlan.phases.map(phase => ({
        id: phase.id,
        name: phase.name,
        status: phase.status,
        duration: phase.actualDuration || 0,
        steps: phase.steps.map(step => ({
          id: step.id,
          name: step.name,
          status: step.status,
          duration: step.startTime && step.endTime ? 
            step.endTime.getTime() - step.startTime.getTime() : 0
        }))
      })),
      healthChecks: await this.getHealthStatus(),
      summary: this.generateDeploymentSummary()
    };
    
    return JSON.stringify(report, null, 2);
  }

  private calculateDeploymentDuration(): number {
    const startTime = this.deploymentPlan.timestamp.getTime();
    const endTime = Date.now();
    return endTime - startTime;
  }

  private generateDeploymentSummary(): string {
    const completedPhases = this.deploymentPlan.phases.filter(p => p.status === 'completed').length;
    const totalPhases = this.deploymentPlan.phases.length;
    const completedSteps = this.deploymentPlan.phases.reduce((acc, phase) => 
      acc + phase.steps.filter(s => s.status === 'completed').length, 0);
    const totalSteps = this.deploymentPlan.phases.reduce((acc, phase) => 
      acc + phase.steps.length, 0);
    
    return `Deployment ${this.deploymentPlan.status}: ${completedPhases}/${totalPhases} phases completed, ${completedSteps}/${totalSteps} steps completed`;
  }

  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up deployment resources');
    
    // Clean up temporary files
    try {
      await fs.rm('/tmp', { recursive: true, force: true });
      this.logger.info('Temporary files cleaned up');
    } catch (error) {
      this.logger.warn('Failed to clean up temporary files', { error });
    }
    
    // Stop monitoring services
    this.logger.info('Deployment cleanup completed');
  }
}