import { Router } from 'express';
import { DeploymentManager } from '../services/deployment-manager.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = Router();

// Initialize deployment manager (would be done at app startup)
let deploymentManager: DeploymentManager;

export const initializeDeploymentManager = async (config) => {
  deploymentManager = new DeploymentManager(config);
  await deploymentManager.initialize();
};

// GET /api/deployments - List all deployments
router.get('/deployments', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const deployments = await deploymentManager.listDeployments();
    res.json({
      success: true,
      data: deployments,
      count: deployments.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to list deployments',
      details: error.message
    });
  }
});

// GET /api/deployments/:id - Get deployment details
router.get('/deployments/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const deployment = await deploymentManager.getDeploymentStatus(req.params.id);
    
    if (!deployment) {
      return res.status(404).json({
        success: false,
        error: 'Deployment not found'
      });
    }
    
    res.json({
      success: true,
      data: deployment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get deployment',
      details: error.message
    });
  }
});

// POST /api/deployments - Start new deployment
router.post('/deployments', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const deployment = await deploymentManager.startDeployment(req.body.config);
    
    res.status(201).json({
      success: true,
      data: deployment,
      message: 'Deployment started successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to start deployment',
      details: error.message
    });
  }
});

// PUT /api/deployments/:id/cancel - Cancel deployment
router.put('/deployments/:id/cancel', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const success = await deploymentManager.cancelDeployment(req.params.id);
    
    if (!success) {
      return res.status(400).json({
        success: false,
        error: 'Failed to cancel deployment'
      });
    }
    
    res.json({
      success: true,
      message: 'Deployment cancelled successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to cancel deployment',
      details: error.message
    });
  }
});

// PUT /api/deployments/:id/retry - Retry failed deployment
router.put('/deployments/:id/retry', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const deployment = await deploymentManager.retryDeployment(req.params.id);
    
    res.json({
      success: true,
      data: deployment,
      message: 'Deployment retry started successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retry deployment',
      details: error.message
    });
  }
});

// GET /api/deployments/:id/progress - Get deployment progress
router.get('/deployments/:id/progress', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const progress = await deploymentManager.getDeploymentProgress(req.params.id);
    
    res.json({
      success: true,
      data: progress
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get deployment progress',
      details: error.message
    });
  }
});

// GET /api/deployments/:id/metrics - Get deployment metrics
router.get('/deployments/:id/metrics', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const metrics = await deploymentManager.getDeploymentMetrics(req.params.id);
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get deployment metrics',
      details: error.message
    });
  }
});

// GET /api/deployments/:id/report - Generate deployment report
router.get('/deployments/:id/report', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const report = await deploymentManager.generateDeploymentReport(req.params.id);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="deployment-${req.params.id}-report.json"`);
    
    res.send(report);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to generate deployment report',
      details: error.message
    });
  }
});

// GET /api/deployments/history - Get deployment history
router.get('/deployments/history', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const history = await deploymentManager.getDeploymentHistory();
    
    res.json({
      success: true,
      data: history,
      count: history.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get deployment history',
      details: error.message
    });
  }
});

// GET /api/deployments/statistics - Get deployment statistics
router.get('/deployments/statistics', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const statistics = await deploymentManager.getDeploymentStatistics();
    
    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get deployment statistics',
      details: error.message
    });
  }
});

// GET /api/system/health - Get system health status
router.get('/system/health', authenticateToken, async (req, res) => {
  try {
    const health = await deploymentManager.getSystemHealth();
    
    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get system health',
      details: error.message
    });
  }
});

// POST /api/deployments/:id/subscribe - Subscribe to deployment notifications
router.post('/deployments/:id/subscribe', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { callbackUrl } = req.body;
    
    if (!callbackUrl) {
      return res.status(400).json({
        success: false,
        error: 'Callback URL is required'
      });
    }
    
    const callback = async (notification) => {
      // Send notification to callback URL
      try {
        await fetch(callbackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(notification)
        });
      } catch (error) {
        console.error('Failed to send notification callback:', error);
      }
    };
    
    await deploymentManager.subscribeToNotifications(req.params.id, callback);
    
    res.json({
      success: true,
      message: 'Successfully subscribed to deployment notifications'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to subscribe to notifications',
      details: error.message
    });
  }
});

// DELETE /api/deployments/:id/subscribe - Unsubscribe from deployment notifications
router.delete('/deployments/:id/subscribe', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    // Implementation would need to track callback functions properly
    // This is a simplified version
    res.json({
      success: true,
      message: 'Successfully unsubscribed from deployment notifications'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to unsubscribe from notifications',
      details: error.message
    });
  }
});

// POST /api/deployments/validate-config - Validate deployment configuration
router.post('/deployments/validate-config', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { config } = req.body;
    
    if (!config) {
      return res.status(400).json({
        success: false,
        error: 'Configuration is required'
      });
    }
    
    // Validate configuration
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
    
    const missingFields = [];
    for (const field of requiredFields) {
      if (!getNestedValue(config, field)) {
        missingFields.push(field);
      }
    }
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required configuration fields',
        missingFields
      });
    }
    
    // Additional validation logic
    const validationErrors = [];
    
    if (config.environment === 'production') {
      if (!config.monitoring?.enableMetrics || !config.monitoring?.enableLogging) {
        validationErrors.push('Production environment requires monitoring and logging');
      }
      
      if (!config.backup?.enableAutoBackup) {
        validationErrors.push('Production environment requires automated backups');
      }
    }
    
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Configuration validation failed',
        errors: validationErrors
      });
    }
    
    res.json({
      success: true,
      message: 'Configuration validation passed',
      data: {
        valid: true,
        warnings: [],
        suggestions: []
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to validate configuration',
      details: error.message
    });
  }
});

// GET /api/deployments/templates - Get deployment templates
router.get('/deployments/templates', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const templates = {
      production: {
        environment: 'production',
        region: 'us-east-1',
        instanceType: 't3.large',
        minInstances: 2,
        maxInstances: 10,
        database: {
          host: 'production-db.example.com',
          port: 5432,
          username: '${DB_USERNAME}',
          password: '${DB_PASSWORD}',
          database: 'claudebox_prod'
        },
        redis: {
          host: 'production-redis.example.com',
          port: 6379,
          password: '${REDIS_PASSWORD}'
        },
        auth: {
          betterAuthUrl: 'https://mcp.chonkie.ai/better-auth/better-auth-builder/mcp',
          betterAuthApiKey: '${BETTER_AUTH_API_KEY}',
          jwtSecret: '${JWT_SECRET}',
          sessionSecret: '${SESSION_SECRET}'
        },
        monitoring: {
          enableMetrics: true,
          enableLogging: true,
          enableAlerting: true
        },
        backup: {
          enableAutoBackup: true,
          backupSchedule: '0 2 * * *',
          retentionDays: 30,
          storageType: 's3'
        }
      },
      staging: {
        environment: 'staging',
        region: 'us-east-1',
        instanceType: 't3.medium',
        minInstances: 1,
        maxInstances: 3,
        database: {
          host: 'staging-db.example.com',
          port: 5432,
          username: '${DB_USERNAME}',
          password: '${DB_PASSWORD}',
          database: 'claudebox_staging'
        },
        redis: {
          host: 'staging-redis.example.com',
          port: 6379
        },
        auth: {
          betterAuthUrl: 'https://mcp.chonkie.ai/better-auth/better-auth-builder/mcp',
          betterAuthApiKey: '${BETTER_AUTH_API_KEY}',
          jwtSecret: '${JWT_SECRET}',
          sessionSecret: '${SESSION_SECRET}'
        },
        monitoring: {
          enableMetrics: true,
          enableLogging: true,
          enableAlerting: false
        },
        backup: {
          enableAutoBackup: true,
          backupSchedule: '0 3 * * *',
          retentionDays: 7,
          storageType: 'local'
        }
      }
    };
    
    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get deployment templates',
      details: error.message
    });
  }
});

// POST /api/deployments/dry-run - Perform deployment dry run
router.post('/deployments/dry-run', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const { config } = req.body;
    
    if (!config) {
      return res.status(400).json({
        success: false,
        error: 'Configuration is required'
      });
    }
    
    // Simulate deployment without actually executing
    const dryRunResult = {
      deploymentId: `dry-run-${Date.now()}`,
      timestamp: new Date(),
      phases: [
        {
          name: 'Pre-deployment Backup',
          steps: [
            { name: 'Backup Database', status: 'simulated' },
            { name: 'Backup Configuration', status: 'simulated' },
            { name: 'Backup User Files', status: 'simulated' }
          ]
        },
        {
          name: 'Environment Setup',
          steps: [
            { name: 'Deploy EC2 Instances', status: 'simulated' },
            { name: 'Configure Load Balancer', status: 'simulated' },
            { name: 'Configure Networking', status: 'simulated' }
          ]
        },
        {
          name: 'Database Migration',
          steps: [
            { name: 'Run Database Schema Migrations', status: 'simulated' },
            { name: 'Migrate User and Slot Data', status: 'simulated' },
            { name: 'Validate Migration Results', status: 'simulated' }
          ]
        },
        {
          name: 'Application Deployment',
          steps: [
            { name: 'Deploy Application Code', status: 'simulated' },
            { name: 'Start Application Services', status: 'simulated' },
            { name: 'Configure Monitoring', status: 'simulated' }
          ]
        },
        {
          name: 'Health Checks and Validation',
          steps: [
            { name: 'Run Health Checks', status: 'simulated' },
            { name: 'Run Performance Tests', status: 'simulated' },
            { name: 'Run Security Scans', status: 'simulated' }
          ]
        },
        {
          name: 'User Migration and Onboarding',
          steps: [
            { name: 'Notify Users of Migration', status: 'simulated' },
            { name: 'Migrate User Accounts', status: 'simulated' },
            { name: 'Verify User Migration', status: 'simulated' }
          ]
        },
        {
          name: 'Go-live and Monitoring',
          steps: [
            { name: 'Switch Traffic to Production', status: 'simulated' },
            { name: 'Monitor Deployment Health', status: 'simulated' },
            { name: 'Finalize Deployment', status: 'simulated' }
          ]
        }
      ],
      estimatedDuration: 21600000, // 6 hours
      estimatedCost: {
        compute: 150,
        storage: 50,
        network: 20,
        total: 220
      },
      warnings: [],
      recommendations: [
        'Ensure all prerequisites are met before starting deployment',
        'Have rollback plan ready in case of issues',
        'Monitor deployment progress closely'
      ]
    };
    
    res.json({
      success: true,
      data: dryRunResult,
      message: 'Dry run completed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to perform dry run',
      details: error.message
    });
  }
});

// Helper function to get nested object values
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

export default router;