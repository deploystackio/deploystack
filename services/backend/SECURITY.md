# Security Policy

This document outlines security procedures and policies for the backend service.

## Reporting a Vulnerability

If you discover a security vulnerability, please report it to us as soon as possible. We appreciate your efforts to disclose your findings responsibly. Please email us at [SECURITY_CONTACT_EMAIL_ADDRESS_HERE - *you'll need to replace this*] with a detailed description of the vulnerability and steps to reproduce it.

We will acknowledge receipt of your vulnerability report promptly and work with you to understand and address the issue. We ask that you do not publicly disclose the vulnerability until we have had a chance to remediate it.

## Password Hashing

User passwords are never stored in plaintext. We employ a strong, adaptive hashing algorithm to protect user credentials.

- **Algorithm:** We will use `argon2id`, which is a part of the Argon2 family of algorithms (Argon2id is generally recommended as it provides resistance against both side-channel attacks and GPU cracking attacks).
- **Salt Generation:** A unique, cryptographically secure salt is automatically generated for each user's password by the `argon2` library at the time of account creation or password change. This salt is then stored as part of the resulting hash string.
- **Parameters:** We use appropriate parameters for `argon2` (e.g., memory cost, time cost, and parallelism) to ensure that the hashing process is computationally intensive, making brute-force attacks significantly more difficult. These parameters are chosen to balance security with acceptable performance on our servers and may be adjusted based on hardware improvements over time.
- **Verification:** During login, the provided password and the stored salt (extracted from the hash string) are used to re-compute the hash. This newly computed hash is then compared against the stored hash in a constant-time manner (handled by the `argon2` library's verify function) to help prevent timing attacks.

This approach ensures that even if the database were compromised, recovering the original passwords would be computationally infeasible.

## Session Management

User sessions are managed using `lucia-auth`.

- Session identifiers are cryptographically random and stored in secure, HTTP-only cookies to prevent XSS attacks from accessing them.
- Sessions have defined expiration times (both active and idle timeouts) to limit the window of opportunity for session hijacking.

## Data Validation

All incoming data from clients (e.g., API request bodies, URL parameters) is rigorously validated using `zod` schemas on the server-side before being processed. This helps prevent common vulnerabilities such as injection attacks and unexpected data handling errors.

## Dependencies

We strive to keep our dependencies up-to-date and regularly review them for known vulnerabilities. Automated tools may be used to scan for vulnerabilities in our dependency tree.

## Infrastructure Security

[Placeholder: Add details about infrastructure security, e.g., network configuration, firewalls, access controls, HTTPS enforcement, etc., as applicable to your deployment environment.]

## Incident Response

[Placeholder: Outline your incident response plan. Who to contact, steps to take, etc.]
