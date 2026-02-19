/**
 * Security utilities for Mission Control
 * Based on security best practices for AI assistant applications
 */

import { existsSync, mkdirSync, appendFileSync } from "fs";
import { join, resolve, normalize, relative } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(join(__dirname, ".."));

// ===========================================
// WORKSPACE BOUNDARIES (Babysitter Rule)
// ===========================================

// Define allowed directories - Claude can ONLY operate within these
const ALLOWED_DIRECTORIES = [
  join(ROOT, "sessions"),
  join(ROOT, "deliverables"),
  join(ROOT, "agents"),
  join(ROOT, "shared"),
];

// Directories that should NEVER be accessed
const FORBIDDEN_PATTERNS = [
  "/etc",
  "/usr",
  "/sys",
  "/var",
  "/root",
  "/home",
  "/.ssh",
  "/.gnupg",
  "/.aws",
  "/.config",
  "/Documents",
  "/Desktop",
  "/Downloads",
  "/Pictures",
  "/Movies",
  "/Music",
  "C:\\Windows",
  "C:\\Program Files",
  "C:\\Users",
];

/**
 * Check if a path is within allowed workspace boundaries
 * Prevents path traversal attacks (e.g., ../../etc/passwd)
 */
export function isPathSafe(targetPath) {
  if (!targetPath) return false;

  // Resolve to absolute path and normalize
  const resolvedPath = resolve(normalize(targetPath));

  // Check for path traversal attempts
  if (targetPath.includes("..")) {
    // Verify the resolved path is still within allowed directories
    const isWithinAllowed = ALLOWED_DIRECTORIES.some((allowed) => {
      const rel = relative(allowed, resolvedPath);
      return rel && !rel.startsWith("..") && !resolve(rel).startsWith(resolve(allowed));
    });

    if (!isWithinAllowed) {
      logSecurityEvent("PATH_TRAVERSAL_ATTEMPT", { targetPath, resolvedPath });
      return false;
    }
  }

  // Check against forbidden patterns
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (resolvedPath.toLowerCase().includes(pattern.toLowerCase())) {
      logSecurityEvent("FORBIDDEN_PATH_ACCESS", { targetPath, pattern });
      return false;
    }
  }

  // Verify path is within allowed directories
  const isAllowed = ALLOWED_DIRECTORIES.some((allowed) => {
    return resolvedPath.startsWith(allowed);
  });

  if (!isAllowed) {
    logSecurityEvent("PATH_OUTSIDE_WORKSPACE", { targetPath, resolvedPath });
    return false;
  }

  return true;
}

/**
 * Get a safe path within the workspace, or null if unsafe
 */
export function getSafePath(basePath, ...segments) {
  const fullPath = join(basePath, ...segments);
  return isPathSafe(fullPath) ? fullPath : null;
}

// ===========================================
// INPUT SANITIZATION
// ===========================================

// Patterns that should never appear in user input
const DANGEROUS_PATTERNS = [
  /\$\{.*\}/g,           // Template injection ${...}
  /`.*`/g,               // Backtick command execution
  /\$\(.*\)/g,           // Command substitution $(...)
  /;\s*rm\s+-rf/gi,      // rm -rf commands
  /;\s*sudo/gi,          // sudo commands
  /\|\s*bash/gi,         // piped to bash
  /\|\s*sh/gi,           // piped to sh
  /eval\s*\(/gi,         // eval() calls
  /exec\s*\(/gi,         // exec() calls
];

/**
 * Sanitize user input to prevent command injection
 */
export function sanitizeInput(input) {
  if (typeof input !== "string") return input;

  let sanitized = input;

  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(input)) {
      logSecurityEvent("DANGEROUS_INPUT_DETECTED", {
        pattern: pattern.toString(),
        inputPreview: input.slice(0, 100),
      });
      // Remove the dangerous pattern
      sanitized = sanitized.replace(pattern, "[REMOVED]");
    }
  }

  return sanitized;
}

/**
 * Validate agent name to prevent injection attacks
 */
export function validateAgentName(name) {
  if (typeof name !== "string") return false;

  // Agent names should be alphanumeric with optional hyphens/underscores
  const validPattern = /^[a-zA-Z][a-zA-Z0-9_-]{0,30}$/;

  if (!validPattern.test(name)) {
    logSecurityEvent("INVALID_AGENT_NAME", { name });
    return false;
  }

  return true;
}

// ===========================================
// SECRET PROTECTION
// ===========================================

// Patterns that look like secrets
const SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/g,                    // OpenAI API keys
  /sk_live_[a-zA-Z0-9]{20,}/g,               // Stripe live keys
  /sk_test_[a-zA-Z0-9]{20,}/g,               // Stripe test keys
  /ghp_[a-zA-Z0-9]{36}/g,                    // GitHub personal tokens
  /gho_[a-zA-Z0-9]{36}/g,                    // GitHub OAuth tokens
  /xox[baprs]-[a-zA-Z0-9-]{10,}/g,           // Slack tokens
  /AKIA[0-9A-Z]{16}/g,                       // AWS access keys
  /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*/g,  // JWT tokens
  /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g, // Private keys
  /password\s*[=:]\s*["']?[^\s"']{8,}/gi,   // Password assignments
  /api[_-]?key\s*[=:]\s*["']?[^\s"']{8,}/gi, // API key assignments
];

/**
 * Redact secrets from a string before logging or display
 */
export function redactSecrets(text) {
  if (typeof text !== "string") return text;

  let redacted = text;

  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, "[REDACTED]");
  }

  return redacted;
}

/**
 * Check if text contains potential secrets
 */
export function containsSecrets(text) {
  if (typeof text !== "string") return false;

  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }

  return false;
}

// ===========================================
// ACTIVITY LOGGING (Contractor Rule: Trust but Verify)
// ===========================================

const LOG_DIR = join(ROOT, "logs");
let currentLogFile = null;

/**
 * Initialize logging for the current session
 */
export function initializeLogging() {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  currentLogFile = join(LOG_DIR, `session-${timestamp}.log`);

  logActivity("SESSION_START", { timestamp: new Date().toISOString() });

  return currentLogFile;
}

/**
 * Log an activity (for monitoring)
 */
export function logActivity(action, details = {}) {
  if (!currentLogFile) {
    initializeLogging();
  }

  const entry = {
    timestamp: new Date().toISOString(),
    type: "ACTIVITY",
    action,
    details: redactSecrets(JSON.stringify(details)),
  };

  const line = JSON.stringify(entry) + "\n";

  try {
    appendFileSync(currentLogFile, line);
  } catch (error) {
    console.error("Failed to write log:", error.message);
  }

  // Also output to console for real-time monitoring
  console.log(`[${entry.timestamp}] ${action}: ${redactSecrets(JSON.stringify(details)).slice(0, 100)}`);
}

/**
 * Log a security event (for audit)
 */
export function logSecurityEvent(eventType, details = {}) {
  if (!currentLogFile) {
    initializeLogging();
  }

  const entry = {
    timestamp: new Date().toISOString(),
    type: "SECURITY",
    event: eventType,
    details: redactSecrets(JSON.stringify(details)),
  };

  const line = JSON.stringify(entry) + "\n";

  try {
    appendFileSync(currentLogFile, line);
  } catch (error) {
    console.error("Failed to write security log:", error.message);
  }

  // Security events always go to console with warning
  console.warn(`[SECURITY] ${eventType}:`, redactSecrets(JSON.stringify(details)));
}

// ===========================================
// SAFE ERROR HANDLING
// ===========================================

/**
 * Create a safe error message that doesn't expose secrets
 */
export function safeError(error) {
  const message = error?.message || String(error);
  return redactSecrets(message);
}

/**
 * Wrap an async function with security logging
 */
export function withSecurityLogging(name, fn) {
  return async (...args) => {
    logActivity(`${name}_START`, { argsCount: args.length });

    try {
      const result = await fn(...args);
      logActivity(`${name}_SUCCESS`);
      return result;
    } catch (error) {
      logActivity(`${name}_ERROR`, { error: safeError(error) });
      throw error;
    }
  };
}

// ===========================================
// RATE LIMITING (Prevent "Costing Money" Problem)
// ===========================================

const rateLimits = new Map();

/**
 * Simple rate limiter to prevent runaway operations
 */
export function checkRateLimit(operation, maxPerMinute = 60) {
  const now = Date.now();
  const windowStart = now - 60000; // 1 minute window

  if (!rateLimits.has(operation)) {
    rateLimits.set(operation, []);
  }

  const timestamps = rateLimits.get(operation);

  // Remove old timestamps
  const recent = timestamps.filter((t) => t > windowStart);
  rateLimits.set(operation, recent);

  if (recent.length >= maxPerMinute) {
    logSecurityEvent("RATE_LIMIT_EXCEEDED", { operation, count: recent.length });
    return false;
  }

  recent.push(now);
  return true;
}

// ===========================================
// EXPORTS SUMMARY
// ===========================================

export default {
  // Path safety
  isPathSafe,
  getSafePath,

  // Input sanitization
  sanitizeInput,
  validateAgentName,

  // Secret protection
  redactSecrets,
  containsSecrets,

  // Logging
  initializeLogging,
  logActivity,
  logSecurityEvent,

  // Error handling
  safeError,
  withSecurityLogging,

  // Rate limiting
  checkRateLimit,
};
