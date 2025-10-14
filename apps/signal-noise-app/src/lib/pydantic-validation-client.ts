/**
 * Pydantic Validation Client
 * Integrates with the Python-based Pydantic validation service
 */

interface ValidationResult {
  status: 'valid' | 'invalid' | 'error';
  validated_data?: any;
  validation_metadata?: Record<string, any>;
  validation_errors?: Array<{
    field: string;
    message: string;
    type: string;
  }>;
  error?: string;
  warnings?: string[];
  enhancements?: Record<string, any>;
}

class PydanticValidationClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl: string = 'http://localhost:8001', timeout: number = 5000) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  /**
   * Validate webhook payload using Pydantic
   */
  async validateWebhookPayload(payload: any): Promise<ValidationResult> {
    try {
      const response = await fetch(`${this.baseUrl}/validate/advanced`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'webhook',
          data: payload
        }),
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Pydantic webhook validation error:', error);
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown validation error'
      };
    }
  }

  /**
   * Validate keyword mine using Pydantic
   */
  async validateKeywordMine(mineData: any): Promise<ValidationResult> {
    try {
      const response = await fetch(`${this.baseUrl}/validate/keyword-mine`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mineData),
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Pydantic keyword mine validation error:', error);
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown validation error'
      };
    }
  }

  /**
   * Validate analysis result using Pydantic
   */
  async validateAnalysisResult(analysisData: any): Promise<ValidationResult> {
    try {
      const response = await fetch(`${this.baseUrl}/validate/analysis-result`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(analysisData),
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Pydantic analysis validation error:', error);
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown validation error'
      };
    }
  }

  /**
   * Validate reasoning task using Pydantic
   */
  async validateReasoningTask(taskData: any): Promise<ValidationResult> {
    try {
      const response = await fetch(`${this.baseUrl}/validate/reasoning-task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskData),
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Pydantic reasoning task validation error:', error);
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown validation error'
      };
    }
  }

  /**
   * Check if the Pydantic validation service is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        return false;
      }

      const health = await response.json();
      return health.status === 'healthy';
    } catch (error) {
      console.error('Pydantic service health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const pydanticValidationClient = new PydanticValidationClient();
export type { ValidationResult };