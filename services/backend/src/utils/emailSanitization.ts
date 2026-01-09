import { sanitizeForEmail } from './sanitization';

/**
 * Sanitize user-provided text for safe email rendering
 *
 * This is a wrapper around the centralized sanitizeForEmail() function.
 * Kept for backwards compatibility with existing imports.
 *
 * This function implements a defense-in-depth approach to prevent XSS attacks
 * while preserving newlines for better email formatting:
 *
 * 1. Normalizes line endings (Windows \r\n → Unix \n)
 * 2. Trims leading/trailing whitespace
 * 3. Escapes HTML entities (prevents XSS)
 * 4. Converts newlines to <br> tags (preserves formatting)
 * 5. Sanitizes with sanitize-html (additional security layer)
 *
 * **Security Features**:
 * - Primary defense: HTML entity escaping prevents all XSS vectors
 * - Secondary defense: sanitize-html catches any escaping bugs
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
 * @see sanitization.ts for implementation details
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
  return sanitizeForEmail(text);
}
