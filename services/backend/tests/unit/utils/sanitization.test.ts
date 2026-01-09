import { describe, it, expect } from 'vitest';
import { sanitizeText, sanitizeForEmail, sanitizeMarkdown } from '../../../src/utils/sanitization';

describe('sanitization utilities', () => {

  describe('sanitizeText', () => {
    it('should escape HTML entities', () => {
      const input = '<script>alert("xss")</script>';
      const output = sanitizeText(input);
      expect(output).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('should escape ampersands first to avoid double-escaping', () => {
      const input = 'Hello & <world>';
      const output = sanitizeText(input);
      expect(output).toBe('Hello &amp; &lt;world&gt;');
    });

    it('should escape single quotes', () => {
      const input = "It's a test";
      const output = sanitizeText(input);
      expect(output).toBe('It&#39;s a test');
    });

    it('should handle empty string', () => {
      expect(sanitizeText('')).toBe('');
    });

    it('should escape double quotes', () => {
      const input = 'Say "hello"';
      const output = sanitizeText(input);
      expect(output).toBe('Say &quot;hello&quot;');
    });

    it('should escape all dangerous characters at once', () => {
      const input = `<div class="test" onclick='alert("xss")'>Hello & goodbye</div>`;
      const output = sanitizeText(input);
      expect(output).toContain('&lt;div');
      expect(output).toContain('&gt;');
      expect(output).toContain('&quot;');
      expect(output).toContain('&#39;');
      expect(output).toContain('&amp;');
    });
  });

  describe('sanitizeForEmail', () => {
    it('should preserve newlines as <br /> tags', () => {
      const input = 'Hello\nWorld';
      const output = sanitizeForEmail(input);
      expect(output).toBe('Hello<br />World');
    });

    it('should normalize Windows line endings', () => {
      const input = 'Hello\r\nWorld';
      const output = sanitizeForEmail(input);
      expect(output).toBe('Hello<br />World');
    });

    it('should escape HTML and then add <br /> tags', () => {
      const input = '<script>alert("xss")</script>\nDangerous';
      const output = sanitizeForEmail(input);
      expect(output).toContain('&lt;script&gt;');
      expect(output).toContain('<br />');
      expect(output).not.toContain('<script>');
    });

    it('should trim whitespace', () => {
      const input = '  Hello World  \n  ';
      const output = sanitizeForEmail(input);
      expect(output).toBe('Hello World');
    });

    it('should return empty string for whitespace-only input', () => {
      expect(sanitizeForEmail('   \n  \n  ')).toBe('');
    });

    it('should return empty string for null/undefined-like input', () => {
      expect(sanitizeForEmail('')).toBe('');
    });

    it('should allow user to type HTML-like text that displays literally', () => {
      const input = 'The <button> component\nis broken';
      const output = sanitizeForEmail(input);
      expect(output).toContain('&lt;button&gt;');
      expect(output).toContain('<br />');
      expect(output).not.toContain('<button>');
    });

    it('should handle multiple consecutive newlines', () => {
      const input = 'Line1\n\n\nLine2';
      const output = sanitizeForEmail(input);
      expect(output).toBe('Line1<br /><br /><br />Line2');
    });

    it('should escape XSS vectors', () => {
      const input = '<img src=x onerror=alert(1)>\nText';
      const output = sanitizeForEmail(input);
      expect(output).toContain('&lt;img');
      expect(output).toContain('<br />');
      expect(output).not.toContain('<img'); // Should not contain actual HTML tag
    });

    it('should preserve legitimate angle brackets in text', () => {
      const input = 'x < 5 && y > 10';
      const output = sanitizeForEmail(input);
      expect(output).toBe('x &lt; 5 &amp;&amp; y &gt; 10');
    });
  });

  describe('sanitizeMarkdown', () => {
    it('should allow safe HTML tags', () => {
      const input = '<h1>Title</h1><p>Paragraph with <strong>bold</strong> text</p>';
      const result = sanitizeMarkdown(input);
      expect(result.content).toBe(input);
      expect(result.removalPercentage).toBe(0);
    });

    it('should remove dangerous tags', () => {
      const input = '<h1>Title</h1><script>alert("xss")</script>';
      const result = sanitizeMarkdown(input);
      expect(result.content).not.toContain('<script>');
      expect(result.content).toContain('<h1>Title</h1>');
    });

    it('should calculate removal statistics correctly', () => {
      const input = '<h1>Title</h1><script>alert("xss")</script>';
      const result = sanitizeMarkdown(input);
      expect(result.originalLength).toBe(input.length);
      expect(result.sanitizedLength).toBe(result.content.length);
      expect(result.removalBytes).toBeGreaterThan(0);
      expect(result.removalPercentage).toBeGreaterThan(0);
    });

    it('should allow safe link protocols', () => {
      const input = '<a href="https://example.com">Link</a>';
      const result = sanitizeMarkdown(input);
      expect(result.content).toContain('https://example.com');
    });

    it('should block javascript: protocol', () => {
      const input = '<a href="javascript:alert(1)">Link</a>';
      const result = sanitizeMarkdown(input);
      expect(result.content).not.toContain('javascript:');
    });

    it('should allow images with safe protocols', () => {
      const input = '<img src="https://example.com/image.png" alt="Test">';
      const result = sanitizeMarkdown(input);
      expect(result.content).toContain('src="https://example.com/image.png"');
    });

    it('should allow data URIs for images', () => {
      const input = '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" alt="Test">';
      const result = sanitizeMarkdown(input);
      expect(result.content).toContain('data:image/png');
    });

    it('should remove event handlers', () => {
      const input = '<img src="test.png" onerror="alert(1)">';
      const result = sanitizeMarkdown(input);
      expect(result.content).not.toContain('onerror');
    });

    it('should preserve table structure', () => {
      const input = '<table><tr><td colspan="2">Cell</td></tr></table>';
      const result = sanitizeMarkdown(input);
      expect(result.content).toContain('<table>');
      expect(result.content).toContain('colspan="2"');
    });

    it('should handle empty input', () => {
      const result = sanitizeMarkdown('');
      expect(result.content).toBe('');
      expect(result.removalPercentage).toBe(0);
      expect(result.removalBytes).toBe(0);
    });

    it('should allow headings', () => {
      const input = '<h1>H1</h1><h2>H2</h2><h3>H3</h3><h4>H4</h4><h5>H5</h5><h6>H6</h6>';
      const result = sanitizeMarkdown(input);
      expect(result.content).toBe(input);
    });

    it('should allow lists', () => {
      const input = '<ul><li>Item 1</li><li>Item 2</li></ul><ol><li>Item 1</li></ol>';
      const result = sanitizeMarkdown(input);
      expect(result.content).toBe(input);
    });

    it('should allow code blocks', () => {
      const input = '<pre><code>const x = 1;</code></pre>';
      const result = sanitizeMarkdown(input);
      expect(result.content).toBe(input);
    });

    it('should allow blockquotes', () => {
      const input = '<blockquote>Quote text</blockquote>';
      const result = sanitizeMarkdown(input);
      expect(result.content).toBe(input);
    });

    it('should remove style attributes', () => {
      const input = '<div style="color: red;">Text</div>';
      const result = sanitizeMarkdown(input);
      expect(result.content).not.toContain('style');
    });

    it('should remove onclick handlers', () => {
      const input = '<button onclick="alert(1)">Click</button>';
      const result = sanitizeMarkdown(input);
      expect(result.content).not.toContain('onclick');
      expect(result.content).not.toContain('alert');
    });

    it('should allow mailto links', () => {
      const input = '<a href="mailto:test@example.com">Email</a>';
      const result = sanitizeMarkdown(input);
      expect(result.content).toContain('mailto:test@example.com');
    });

    it('should allow tel links', () => {
      const input = '<a href="tel:+1234567890">Call</a>';
      const result = sanitizeMarkdown(input);
      expect(result.content).toContain('tel:+1234567890');
    });

    it('should allow GitHub-specific tags', () => {
      const input = '<details><summary>Click to expand</summary>Content here</details>';
      const result = sanitizeMarkdown(input);
      expect(result.content).toContain('<details>');
      expect(result.content).toContain('<summary>');
    });

    it('should remove iframe tags', () => {
      const input = '<p>Text</p><iframe src="evil.com"></iframe>';
      const result = sanitizeMarkdown(input);
      expect(result.content).not.toContain('iframe');
      expect(result.content).toContain('<p>Text</p>');
    });

    it('should remove object tags', () => {
      const input = '<p>Text</p><object data="evil.swf"></object>';
      const result = sanitizeMarkdown(input);
      expect(result.content).not.toContain('object');
    });

    it('should remove embed tags', () => {
      const input = '<p>Text</p><embed src="evil.swf">';
      const result = sanitizeMarkdown(input);
      expect(result.content).not.toContain('embed');
    });

    it('should calculate removal percentage for heavy sanitization', () => {
      const malicious = '<script>alert(1)</script>'.repeat(10);
      const safe = '<p>Safe text</p>';
      const input = malicious + safe;
      const result = sanitizeMarkdown(input);

      expect(result.removalPercentage).toBeGreaterThan(50);
      expect(result.content).toContain('Safe text');
      expect(result.content).not.toContain('alert');
    });

    it('should preserve class and id attributes', () => {
      const input = '<div class="container" id="main">Content</div>';
      const result = sanitizeMarkdown(input);
      expect(result.content).toContain('class="container"');
      expect(result.content).toContain('id="main"');
    });

    it('should allow text formatting tags', () => {
      const input = '<p><strong>Bold</strong> <em>Italic</em> <u>Underline</u> <s>Strike</s></p>';
      const result = sanitizeMarkdown(input);
      expect(result.content).toBe(input);
    });

    it('should allow sup and sub tags', () => {
      const input = '<p>x<sup>2</sup> and H<sub>2</sub>O</p>';
      const result = sanitizeMarkdown(input);
      expect(result.content).toBe(input);
    });
  });

  describe('XSS Prevention Suite', () => {
    it('sanitizeForEmail should prevent all XSS vectors', () => {
      const xssVectors = [
        '<script>alert(1)</script>',
        '<img src=x onerror=alert(1)>',
        '<svg onload=alert(1)>',
        '<body onload=alert(1)>',
        '<input onfocus=alert(1) autofocus>',
      ];

      xssVectors.forEach(vector => {
        const result = sanitizeForEmail(vector);
        // Verify HTML tags are escaped (not executable)
        expect(result).not.toContain('<script');
        expect(result).not.toContain('<img');
        expect(result).not.toContain('<svg');
        expect(result).not.toContain('<body');
        expect(result).not.toContain('<input');
        // Verify escaped versions are present
        expect(result).toContain('&lt;');
        expect(result).toContain('&gt;');
      });
    });

    it('sanitizeMarkdown should prevent all XSS vectors', () => {
      const xssVectors = [
        '<script>alert(1)</script>',
        '<img src=x onerror=alert(1)>',
        '<a href="javascript:alert(1)">click</a>',
        '<iframe src="javascript:alert(1)"></iframe>',
        '<svg onload=alert(1)>',
        '<body onload=alert(1)>',
      ];

      xssVectors.forEach(vector => {
        const result = sanitizeMarkdown(vector);
        expect(result.content).not.toContain('javascript:');
        expect(result.content).not.toContain('onerror=');
        expect(result.content).not.toContain('onload=');
        expect(result.content).not.toContain('<script>');
      });
    });
  });
});
