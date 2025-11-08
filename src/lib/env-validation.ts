/**
 * Environment Variable Validation
 * 
 * Validates required environment variables at startup.
 * Fails fast with helpful error messages if critical variables are missing.
 */

interface EnvValidationRule {
  name: string
  required: boolean
  description: string
  defaultValue?: string
  validate?: (value: string) => boolean
  errorMessage?: string
}

/**
 * Environment variable validation rules
 */
const ENV_RULES: EnvValidationRule[] = [
  {
    name: 'JWT_SECRET',
    required: true,
    description: 'Secret key for JWT token generation and verification',
    validate: (value: string) => value.length >= 32,
    errorMessage: 'JWT_SECRET must be at least 32 characters long for security'
  },
  {
    name: 'DATABASE_URL',
    required: true,
    description: 'Database connection string',
    validate: (value: string) => value.startsWith('file:') || value.startsWith('postgresql:') || value.startsWith('mysql:'),
    errorMessage: 'DATABASE_URL must be a valid database connection string'
  },
  {
    name: 'NODE_ENV',
    required: false,
    description: 'Application environment',
    defaultValue: 'development',
    validate: (value: string) => ['development', 'production', 'test'].includes(value),
    errorMessage: 'NODE_ENV must be one of: development, production, test'
  },
  {
    name: 'NEXT_PUBLIC_SITE_URL',
    required: false,
    description: 'Public site URL for SEO and metadata',
    defaultValue: 'http://localhost:3000'
  },
  {
    name: 'RATE_LIMIT_AUTH_MAX',
    required: false,
    description: 'Maximum auth requests per window',
    defaultValue: '5',
    validate: (value: string) => !isNaN(Number(value)) && Number(value) > 0,
    errorMessage: 'RATE_LIMIT_AUTH_MAX must be a positive number'
  },
  {
    name: 'RATE_LIMIT_AUTH_WINDOW_MS',
    required: false,
    description: 'Auth rate limit window in milliseconds',
    defaultValue: String(15 * 60 * 1000),
    validate: (value: string) => !isNaN(Number(value)) && Number(value) > 0,
    errorMessage: 'RATE_LIMIT_AUTH_WINDOW_MS must be a positive number'
  },
  {
    name: 'RATE_LIMIT_API_MAX',
    required: false,
    description: 'Maximum API requests per window',
    defaultValue: '100',
    validate: (value: string) => !isNaN(Number(value)) && Number(value) > 0,
    errorMessage: 'RATE_LIMIT_API_MAX must be a positive number'
  },
  {
    name: 'RATE_LIMIT_API_WINDOW_MS',
    required: false,
    description: 'API rate limit window in milliseconds',
    defaultValue: String(15 * 60 * 1000),
    validate: (value: string) => !isNaN(Number(value)) && Number(value) > 0,
    errorMessage: 'RATE_LIMIT_API_WINDOW_MS must be a positive number'
  },
  {
    name: 'RATE_LIMIT_ADMIN_MAX',
    required: false,
    description: 'Maximum admin requests per window',
    defaultValue: '50',
    validate: (value: string) => !isNaN(Number(value)) && Number(value) > 0,
    errorMessage: 'RATE_LIMIT_ADMIN_MAX must be a positive number'
  },
  {
    name: 'RATE_LIMIT_ADMIN_WINDOW_MS',
    required: false,
    description: 'Admin rate limit window in milliseconds',
    defaultValue: String(15 * 60 * 1000),
    validate: (value: string) => !isNaN(Number(value)) && Number(value) > 0,
    errorMessage: 'RATE_LIMIT_ADMIN_WINDOW_MS must be a positive number'
  },
  {
    name: 'ALLOWED_ORIGINS',
    required: false,
    description: 'Comma-separated list of allowed CORS origins',
    defaultValue: '*'
  },
  {
    name: 'ENABLE_AUDIT_LOGGING',
    required: false,
    description: 'Enable security audit logging',
    defaultValue: 'true',
    validate: (value: string) => ['true', 'false'].includes(value.toLowerCase()),
    errorMessage: 'ENABLE_AUDIT_LOGGING must be true or false'
  },
  {
    name: 'DISABLE_CSP',
    required: false,
    description: 'Disable Content Security Policy (not recommended)',
    defaultValue: 'false',
    validate: (value: string) => ['true', 'false'].includes(value.toLowerCase()),
    errorMessage: 'DISABLE_CSP must be true or false'
  },
  {
    name: 'DISABLE_HSTS',
    required: false,
    description: 'Disable HTTP Strict Transport Security',
    defaultValue: 'false',
    validate: (value: string) => ['true', 'false'].includes(value.toLowerCase()),
    errorMessage: 'DISABLE_HSTS must be true or false'
  }
]

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  env: Record<string, string>
}

/**
 * Validate a single environment variable
 */
function validateEnvVar(rule: EnvValidationRule): { error?: string; warning?: string; value: string } {
  const value = process.env[rule.name]
  
  // Check if required variable is missing
  if (rule.required && !value) {
    return {
      error: `❌ Missing required environment variable: ${rule.name}\n   Description: ${rule.description}\n   Please set this variable in your .env file`
    }
  }
  
  // Use default value if not set
  if (!value && rule.defaultValue) {
    return {
      warning: `⚠️  Using default value for ${rule.name}: ${rule.defaultValue}`,
      value: rule.defaultValue
    }
  }
  
  // Validate value if validator provided
  if (value && rule.validate && !rule.validate(value)) {
    return {
      error: `❌ Invalid value for ${rule.name}: ${value}\n   ${rule.errorMessage || 'Value failed validation'}`
    }
  }
  
  return { value: value || rule.defaultValue || '' }
}

/**
 * Validate all environment variables
 */
export function validateEnv(): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const env: Record<string, string> = {}
  
  for (const rule of ENV_RULES) {
    const result = validateEnvVar(rule)
    
    if (result.error) {
      errors.push(result.error)
    }
    
    if (result.warning) {
      warnings.push(result.warning)
    }
    
    env[rule.name] = result.value
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    env
  }
}

/**
 * Validate environment and exit if validation fails
 */
export function validateEnvOrExit(): void {
  console.log('🔍 Validating environment variables...\n')
  
  const result = validateEnv()
  
  // Show warnings
  if (result.warnings.length > 0) {
    console.warn('Warnings:')
    result.warnings.forEach(warning => console.warn(warning))
    console.log()
  }
  
  // Show errors and exit if validation failed
  if (!result.valid) {
    console.error('❌ Environment validation failed!\n')
    console.error('Errors:')
    result.errors.forEach(error => console.error(error))
    console.error('\n💡 Tip: Copy .env.example to .env and fill in the required values')
    console.error('   Run: cp .env.example .env\n')
    process.exit(1)
  }
  
  console.log('✅ Environment validation passed!\n')
}

/**
 * Get validated environment variable
 */
export function getEnv(name: string, defaultValue?: string): string {
  const value = process.env[name]
  
  if (!value && !defaultValue) {
    throw new Error(`Environment variable ${name} is not set`)
  }
  
  return value || defaultValue || ''
}

/**
 * Get required environment variable (throws if not set)
 */
export function getRequiredEnv(name: string): string {
  const value = process.env[name]
  
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`)
  }
  
  return value
}

/**
 * Get boolean environment variable
 */
export function getBoolEnv(name: string, defaultValue: boolean = false): boolean {
  const value = process.env[name]
  
  if (!value) {
    return defaultValue
  }
  
  return value.toLowerCase() === 'true'
}

/**
 * Get number environment variable
 */
export function getNumberEnv(name: string, defaultValue?: number): number {
  const value = process.env[name]
  
  if (!value) {
    if (defaultValue === undefined) {
      throw new Error(`Environment variable ${name} is not set`)
    }
    return defaultValue
  }
  
  const num = Number(value)
  
  if (isNaN(num)) {
    throw new Error(`Environment variable ${name} is not a valid number: ${value}`)
  }
  
  return num
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development' || !process.env.NODE_ENV
}

/**
 * Check if running in test mode
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === 'test'
}