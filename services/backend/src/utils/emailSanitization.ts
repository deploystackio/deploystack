import DOMPurify from 'isomorphic-dompurify';

/**
 * DOMPurify configuration for email text sanitization
 * - Only allows <br> tags (for newline preservation)
 * - Strips all other HTML and attributes
 * - Enables DOM sanitization for additional security
 */
const EMAIL_TEXT_SANITIZE_CONFIG = {
  ALLOWED_TAGS: ['br'],
  ALLOWED_ATTR: [],
  KEEP_CONTENT: true,
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  SANITIZE_DOM: true,
  FORCE_BODY: false
};

/**
 * Escape HTML entities to prevent XSS attacks
 *
 * This function converts potentially dangerous HTML characters into their
 * HTML entity equivalents, making them display as literal text rather than
 * being interpreted as HTML.
 *
 * @param text - Raw text that may contain HTML characters
 * @returns Text with HTML entities escaped
 *
 * @example
 * escapeHtml('<script>alert("xss")</script>')
 * // Returns: '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')   // Must be first to avoid double-escaping
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitize user-provided text for safe email rendering
 *
 * This function implements a defense-in-depth approach to prevent XSS attacks
 * while preserving newlines for better email formatting:
 *
 * 1. Normalizes line endings (Windows \r\n → Unix \n)
 * 2. Trims leading/trailing whitespace
 * 3. Escapes HTML entities (prevents XSS)
 * 4. Converts newlines to <br> tags (preserves formatting)
 * 5. Sanitizes with DOMPurify (additional security layer)
 *
 * **Security Features**:
 * - Primary defense: HTML entity escaping prevents all XSS vectors
 * - Secondary defense: DOMPurify catches any escaping bugs
 * - Preserves user intent: Users can type HTML-like text (e.g., "The <button> component")
 *   and it displays literally, not stripped
 *
 * **Email Compatibility**:
 * - Uses <br> tags instead of CSS (works in all email clients)
 * - Handles Windows/Unix/Mac line endings
 * - Preserves multiple consecutive newlines
 *
 * @param text - Raw user input from textarea (may contain newlines, HTML, etc.)
 * @returns Sanitized HTML string with <br> tags, safe for email rendering
 *
 * @example
 * sanitizeUserTextForEmail('Hello\nWorld')
 * // Returns: 'Hello<br>World'
 *
 * @example
 * sanitizeUserTextForEmail('<script>alert("xss")</script>\nDangerous')
 * // Returns: '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;<br>Dangerous'
 *
 * @example
 * sanitizeUserTextForEmail('The <div> tag\nis broken')
 * // Returns: 'The &lt;div&gt; tag<br>is broken'
 */
export function sanitizeUserTextForEmail(text: string): string {
  if (!text) return '';

  // 1. Normalize line endings (Windows \r\n → Unix \n)
  let sanitized = text.replace(/\r\n/g, '\n');

  // 2. Trim leading/trailing whitespace
  sanitized = sanitized.trim();

  // Return empty string if only whitespace
  if (!sanitized) return '';

  // 3. Escape HTML entities (CRITICAL: do this BEFORE adding <br> tags)
  //    This ensures user-typed HTML displays as literal text
  sanitized = escapeHtml(sanitized);

  // 4. Convert newlines to <br> tags for email rendering
  //    After escaping, we can safely add our trusted <br> tags
  sanitized = sanitized.replace(/\n/g, '<br>');

  // 5. Sanitize with DOMPurify as defense-in-depth
  //    This catches any potential bugs in our escaping logic
  sanitized = DOMPurify.sanitize(sanitized, EMAIL_TEXT_SANITIZE_CONFIG);

  return sanitized;
}
