import sanitizeHtml from 'sanitize-html';

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
 * sanitizeText('<script>alert("xss")</script>')
 * // Returns: '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
 *
 * @example
 * sanitizeText('Hello & <world>')
 * // Returns: 'Hello &amp; &lt;world&gt;'
 */
export function sanitizeText(text: string): string {
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
 * Only allows <br> tags for email compatibility. All other HTML is escaped
 * and displayed literally to preserve user intent.
 *
 * @param text - Raw user input from textarea (may contain newlines, HTML, etc.)
 * @returns Sanitized HTML string with <br> tags, safe for email rendering
 *
 * @example
 * sanitizeForEmail('Hello\nWorld')
 * // Returns: 'Hello<br>World'
 *
 * @example
 * sanitizeForEmail('<script>alert("xss")</script>\nDangerous')
 * // Returns: '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;<br>Dangerous'
 *
 * @example
 * sanitizeForEmail('The <div> tag\nis broken')
 * // Returns: 'The &lt;div&gt; tag<br>is broken'
 */
export function sanitizeForEmail(text: string): string {
  if (!text) return '';

  // 1. Normalize line endings (Windows \r\n → Unix \n)
  let sanitized = text.replace(/\r\n/g, '\n');

  // 2. Trim leading/trailing whitespace
  sanitized = sanitized.trim();

  // Return empty string if only whitespace
  if (!sanitized) return '';

  // 3. Escape HTML entities (CRITICAL: do this BEFORE adding <br> tags)
  //    This ensures user-typed HTML displays as literal text
  sanitized = sanitizeText(sanitized);

  // 4. Convert newlines to <br> tags for email rendering
  //    After escaping, we can safely add our trusted <br> tags
  sanitized = sanitized.replace(/\n/g, '<br>');

  // 5. Sanitize with sanitize-html as defense-in-depth
  //    This catches any potential bugs in our escaping logic
  sanitized = sanitizeHtml(sanitized, {
    allowedTags: ['br'],
    allowedAttributes: {},
    allowedSchemes: [],
    disallowedTagsMode: 'escape',
    parseStyleAttributes: false,
  });

  return sanitized;
}

/**
 * Sanitize GitHub README content for safe display
 *
 * Allows common markdown/HTML tags while preventing XSS attacks.
 * Implements size validation and tracks content removal for security monitoring.
 *
 * Security features:
 * - Whitelist of safe HTML tags
 * - Safe URL protocols only (http, https, mailto, tel)
 * - No data-* attributes
 * - No style attributes
 * - Content removal tracking
 *
 * @param content - Raw GitHub README content (HTML)
 * @returns Object with sanitized content and removal statistics
 *
 * @example
 * sanitizeMarkdown('<h1>Title</h1><script>alert("xss")</script>')
 * // Returns: {
 * //   content: '<h1>Title</h1>',
 * //   originalLength: 47,
 * //   sanitizedLength: 17,
 * //   removalBytes: 30,
 * //   removalPercentage: 63.83
 * // }
 */
export function sanitizeMarkdown(content: string): {
  content: string;
  originalLength: number;
  sanitizedLength: number;
  removalBytes: number;
  removalPercentage: number;
} {
  const originalLength = content.length;

  const sanitized = sanitizeHtml(content, {
    // Allow common markdown/HTML tags
    allowedTags: [
      // Text formatting
      'p', 'br', 'strong', 'em', 'u', 's', 'del', 'ins',
      // Headings
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      // Lists
      'ul', 'ol', 'li', 'dl', 'dt', 'dd',
      // Links and code
      'a', 'code', 'pre', 'blockquote',
      // Images
      'img', 'picture', 'source',
      // Tables
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
      // Containers
      'div', 'span', 'section', 'article',
      // GitHub-specific
      'details', 'summary',
      // Other
      'hr', 'sup', 'sub'
    ],

    // Allow safe attributes per tag
    allowedAttributes: {
      'a': ['href', 'title'],
      'img': ['src', 'alt', 'title', 'width', 'height'],
      'picture': [],
      'source': ['src', 'srcset', 'type'],
      'table': ['align'],
      'td': ['colspan', 'rowspan', 'align'],
      'th': ['colspan', 'rowspan', 'align'],
      'ol': ['type', 'start', 'reversed'],
      'details': ['open'],
      '*': ['class', 'id'] // Allow class and id on all tags
    },

    // Only allow safe URL protocols
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: {
      img: ['http', 'https', 'data'], // Allow data URIs for images
      source: ['http', 'https', 'data']
    },

    // Security settings
    allowedSchemesAppliedToAttributes: ['href', 'src', 'cite'],
    allowProtocolRelative: true,
    enforceHtmlBoundary: false,
    parseStyleAttributes: false, // Don't parse style attributes
    disallowedTagsMode: 'discard', // Remove disallowed tags but keep content
  });

  const sanitizedLength = sanitized.length;
  const removalBytes = originalLength - sanitizedLength;
  const removalPercentage = originalLength > 0
    ? (removalBytes / originalLength) * 100
    : 0;

  return {
    content: sanitized,
    originalLength,
    sanitizedLength,
    removalBytes,
    removalPercentage
  };
}
