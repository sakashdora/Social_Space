# Authentication - Veil Shine

## 1. Introduction

Authentication in Veil Shine is designed from the ground up to uphold the platform's core principle of architectural anonymity. Unlike traditional social networks that rely on personally identifiable information (PII) for user verification, Veil Shine enables users to interact fully without revealing their real-world identity. This document details the anonymous authentication flows, token management, and the underlying strategy that ensures user privacy while maintaining platform security.

## 2. Core Principles of Anonymous Authentication

*   **No PII Collection**: The system explicitly avoids collecting email addresses, phone numbers, real names, or any other data that could directly identify a user.
*   **Handle-Based Identity**: Users are identified solely by a self-chosen, unique handle and an internally generated, non-traceable `user_id`.
*   **Token-Based Security**: All authenticated interactions are secured using JSON Web Tokens (JWTs), which are short-lived and do not contain PII.
*   **Architectural Anonymity**: The authentication system is built such that even platform administrators cannot link a `user_id` or handle to a real person.

## 3. Authentication Flow

### 3.1. Anonymous Account Creation (Registration)

Users initiate their journey on Veil Shine by creating an anonymous account. This process is designed to be quick and require minimal input.

1.  **User Input**: The user provides a desired unique `handle` (e.g., 
