/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Simple JWT implementation using Node.js crypto
 * Provides HS256 signing for satellite registration tokens
 */
export class SimpleJWT {
  private static readonly ALGORITHM = 'HS256';

  /**
   * Sign a JWT token with HS256
   */
  static sign(payload: Record<string, any>, secret: string): string {
    const header = {
      alg: this.ALGORITHM,
      typ: 'JWT'
    };

    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    
    const signature = createHmac('sha256', secret)
      .update(signatureInput)
      .digest('base64url');

    return `${signatureInput}.${signature}`;
  }

  /**
   * Verify and decode a JWT token
   */
  static verify(token: string, secret: string): Record<string, any> {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const [encodedHeader, encodedPayload, signature] = parts;
    
    // Verify signature
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = createHmac('sha256', secret)
      .update(signatureInput)
      .digest('base64url');

    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      throw new Error('Invalid token signature');
    }

    // Decode and verify header
    const header = JSON.parse(this.base64UrlDecode(encodedHeader));
    if (header.alg !== this.ALGORITHM) {
      throw new Error(`Unsupported algorithm: ${header.alg}`);
    }

    // Decode payload
    const payload = JSON.parse(this.base64UrlDecode(encodedPayload));

    // Check expiration
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      const expiredError = new Error('Token has expired');
      (expiredError as any).name = 'TokenExpiredError';
      throw expiredError;
    }

    return payload;
  }

  /**
   * Base64URL encode (RFC 4648)
   */
  private static base64UrlEncode(str: string): string {
    return Buffer.from(str)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Base64URL decode
   */
  private static base64UrlDecode(str: string): string {
    // Add padding if needed
    str += '='.repeat((4 - str.length % 4) % 4);
    
    return Buffer.from(str
      .replace(/-/g, '+')
      .replace(/_/g, '/'), 'base64')
      .toString();
  }
}

/**
 * JWT Error types for compatibility
 */
export class TokenExpiredError extends Error {
  name = 'TokenExpiredError';
  constructor(message: string = 'Token has expired') {
    super(message);
  }
}
