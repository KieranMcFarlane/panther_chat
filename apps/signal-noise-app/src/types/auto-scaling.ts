export interface ScalingMetrics {
  timestamp: Date;
  overallUtilization: number;
  cpuUtilization: number;
  memoryUtilization: number;
  slotUtilization: number;
  activeSlots: number;
  totalSlots: number;
  activeUsers: number;
  requestRate: number;
  responseTime: number;
  errorRate: number;
  costPerHour: number;
}

export interface ScalingPolicy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  cooldownPeriod: number;
  maxInstances: number;
  minInstances: number;
  targetUtilization: number;
  scalingFactors: {
    cpu: number;
    memory: number;
    slots: number;
    requests: number;
  };
  costConstraints: {
    maxHourlyCost: number;
    maxDailyCost: number;
    reservedInstances: number;
  };
  region: string;
  instanceType: string;
  createdAt: Date;
  lastModified: Date;
}

export interface ScalingEvent {
  id: string;
  type: 'scale_up' | 'scale_down' | 'failed_scale' | 'cooldown';
  timestamp: Date;
  policyId: string;
  previousInstanceCount: number;
  newInstanceCount: number;
  reason: string;
  metrics: ScalingMetrics;
  cost: {
    estimatedAdditionalCost: number;
    totalNewCost: number;
  };
  status: 'initiated' | 'in_progress' | 'completed' | 'failed';
  errorMessage?: string;
  completedAt?: Date;
}

export interface InstanceInfo {
  id: string;
  instanceId: string;
  publicIp: string;
  privateIp: string;
  status: 'pending' | 'running' | 'stopping' | 'stopped' | 'terminated';
  region: string;
  availabilityZone: string;
  instanceType: string;
  launchTime: Date;
  slotCapacity: number;
  activeSlots: number;
  cpuUtilization: number;
  memoryUtilization: number;
  cost: {
    hourly: number;
    estimatedMonthly: number;
  };
  health: 'healthy' | 'unhealthy' | 'initializing';
  lastHealthCheck: Date;
}

export interface LoadBalancerConfig {
  id: string;
  name: string;
  type: 'application' | 'network' | 'classic';
  scheme: 'internet-facing' | 'internal';
  dnsName: string;
  listeners: LoadBalancerListener[];
  targetGroups: TargetGroup[];
  healthCheck: HealthCheckConfig;
  sslCertificate?: string;
  createdAt: Date;
  status: 'active' | 'provisioning' | 'failed';
}

export interface LoadBalancerListener {
  id: string;
  port: number;
  protocol: 'HTTP' | 'HTTPS' | 'TCP';
  rules: LoadBalancerRule[];
  defaultActions: ListenerAction[];
}

export interface LoadBalancerRule {
  id: string;
  priority: number;
  conditions: RuleCondition[];
  actions: ListenerAction[];
}

export interface RuleCondition {
  field: 'path' | 'host-header' | 'http-header' | 'http-request-method' | 'source-ip';
  values: string[];
}

export interface ListenerAction {
  type: 'forward' | 'redirect' | 'fixed-response';
  targetGroupArn?: string;
  statusCode?: number;
  redirectConfig?: {
    protocol: string;
    port: string;
    host: string;
    path: string;
    query: string;
  };
}

export interface TargetGroup {
  id: string;
  name: string;
  port: number;
  protocol: 'HTTP' | 'HTTPS' | 'TCP';
  targetType: 'instance' | 'ip';
  healthCheck: HealthCheckConfig;
  targets: TargetInstance[];
  createdAt: Date;
}

export interface TargetInstance {
  id: string;
  instanceId: string;
  port: number;
  status: 'healthy' | 'unhealthy' | 'unused' | 'draining';
  healthCheck?: HealthCheckResult;
}

export interface HealthCheckConfig {
  enabled: boolean;
  path: string;
  port: number;
  protocol: 'HTTP' | 'HTTPS' | 'TCP';
  interval: number;
  timeout: number;
  healthyThreshold: number;
  unhealthyThreshold: number;
  matcher?: {
    httpCode: string;
  };
}

export interface HealthCheckResult {
  timestamp: Date;
  status: 'healthy' | 'unhealthy';
  responseCode: number;
  responseTime: number;
  reason?: string;
}

export interface ScalingCost {
  timestamp: Date;
  currentHourlyCost: number;
  projectedDailyCost: number;
  projectedMonthlyCost: number;
  instanceCount: number;
  averageUtilization: number;
  costEfficiency: number;
  savings: number;
  recommendations: string[];
}

export interface ScalingAlert {
  id: string;
  type: 'warning' | 'critical';
  category: 'scaling' | 'cost' | 'performance' | 'availability';
  message: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  instanceId?: string;
  policyId?: string;
  recommendedAction: string;
  metadata: Record<string, any>;
}

export interface ScalingHistory {
  id: string;
  timestamp: Date;
  eventType: 'scale_up' | 'scale_down' | 'policy_change' | 'config_change';
  description: string;
  details: Record<string, any>;
  userId?: string;
  automated: boolean;
}