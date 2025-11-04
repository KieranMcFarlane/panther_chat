export interface BackupConfig {
  slotId: string;
  userId: string;
  timestamp: Date;
  version: string;
  checksum: string;
  size: number;
  encryptionEnabled: boolean;
  compressionEnabled: boolean;
}

export interface BackupData {
  slotConfig: SlotConfig;
  userData: UserData;
  authConfig: AuthConfig;
  workDirectory?: WorkDirectoryBackup;
  metadata: BackupMetadata;
}

export interface SlotConfig {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'error' | 'creating';
  authProvider: string;
  settings: Record<string, any>;
  resources: {
    cpu: number;
    memory: number;
    disk: number;
  };
  createdAt: Date;
  lastModified: Date;
}

export interface UserData {
  userId: string;
  email: string;
  preferences: Record<string, any>;
  sessions: UserSession[];
  usage: UsageStats;
  createdAt: Date;
  lastLogin: Date;
}

export interface UserSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  ipAddress?: string;
  userAgent?: string;
  status: 'active' | 'expired' | 'terminated';
}

export interface UsageStats {
  totalSessions: number;
  totalDuration: number;
  totalCommands: number;
  lastActivity: Date;
  resourcesUsed: {
    cpu: number;
    memory: number;
    network: number;
  };
}

export interface AuthConfig {
  provider: string;
  providerType: 'oauth2' | 'oidc' | 'saml' | 'api_key' | 'claude';
  credentials: {
    accessToken?: string;
    refreshToken?: string;
    apiKey?: string;
    clientId?: string;
    scopes?: string[];
  };
  sessionInfo: {
    sessionId: string;
    expiresAt: Date;
    lastRefreshed: Date;
  };
  settings: Record<string, any>;
}

export interface WorkDirectoryBackup {
  files: BackupFile[];
  directories: string[];
  totalSize: number;
  fileCount: number;
}

export interface BackupFile {
  path: string;
  size: number;
  checksum: string;
  lastModified: Date;
  content?: string; // For small files
  compressionRatio?: number;
}

export interface BackupMetadata {
  backupId: string;
  timestamp: Date;
  createdBy: string;
  description?: string;
  tags: string[];
  retentionDays: number;
  isEncrypted: boolean;
  compressionAlgorithm: string;
  integrityVerified: boolean;
}

export interface BackupJob {
  id: string;
  slotId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime?: Date;
  endTime?: Date;
  progress: number;
  backupId?: string;
  error?: string;
  config: BackupJobConfig;
}

export interface BackupJobConfig {
  includeWorkDirectory: boolean;
  includeAuthConfig: boolean;
  includeUserData: boolean;
  encryptionEnabled: boolean;
  compressionEnabled: boolean;
  retentionDays: number;
  scheduled: boolean;
  schedule?: BackupSchedule;
}

export interface BackupSchedule {
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  time?: string; // For specific time execution
  days?: number[]; // For weekly/monthly schedules
  enabled: boolean;
  nextRun: Date;
}

export interface RestoreJob {
  id: string;
  backupId: string;
  targetSlotId?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime?: Date;
  endTime?: Date;
  progress: number;
  error?: string;
  config: RestoreConfig;
}

export interface RestoreConfig {
  restoreWorkDirectory: boolean;
  restoreAuthConfig: boolean;
  restoreUserData: boolean;
  overwriteExisting: boolean;
  verifyIntegrity: boolean;
  dryRun: boolean;
}

export interface BackupStorage {
  id: string;
  name: string;
  type: 'local' | 's3' | 'azure' | 'gcs' | 'custom';
  location: string;
  capacity: {
    total: number;
    used: number;
    available: number;
  };
  status: 'active' | 'inactive' | 'error';
  lastBackup?: Date;
  config: Record<string, any>;
}

export interface BackupVerification {
  backupId: string;
  verified: boolean;
  checksum: string;
  fileSize: number;
  fileCount: number;
  errors: VerificationError[];
  timestamp: Date;
  verificationTime: number;
}

export interface VerificationError {
  type: 'checksum_mismatch' | 'missing_file' | 'corrupted_data' | 'structure_error';
  path?: string;
  message: string;
  severity: 'warning' | 'error' | 'critical';
}

export interface DisasterRecoveryPlan {
  id: string;
  name: string;
  description: string;
  rpo: number; // Recovery Point Objective in minutes
  rto: number; // Recovery Time Objective in minutes
  backupConfigs: BackupJobConfig[];
  storageLocations: string[];
  notificationChannels: string[];
  testSchedule: DisasterRecoveryTestSchedule;
  lastTest?: DisasterRecoveryTestResult;
}

export interface DisasterRecoveryTestSchedule {
  frequency: 'monthly' | 'quarterly' | 'biannually';
  nextTest: Date;
  autoRun: boolean;
}

export interface DisasterRecoveryTestResult {
  testId: string;
  timestamp: Date;
  status: 'success' | 'partial' | 'failed';
  duration: number;
  dataVerified: boolean;
  recoveryTime: number;
  errors: string[];
  notes?: string;
}