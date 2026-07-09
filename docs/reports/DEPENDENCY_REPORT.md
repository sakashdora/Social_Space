# DEPENDENCY REPORT

## Findings
The VEIL backend was using two large, legacy npm packages declared in `package.json` that were not imported or used anywhere in the source files:
1.  **`mongoose`**: Scaffolding left over from a previous design that targeted MongoDB database architectures.
2.  **`bcryptjs`**: Cryptographic hashing utility made redundant by the exclusive use of Argon2id (`argon2`) and HMAC-SHA256 (`crypto`) for credentials.

## Risk Level
*   Dead dependencies in package.json: **LOW** (increases bundle size, build times, and threat surface)

## Affected Files
*   `backend/package.json` (Pruned packages)
*   `backend/package-lock.json` (Synced references)

## Code Changes
Removed `mongoose` and `bcryptjs` from dependencies block:
```bash
npm uninstall mongoose bcryptjs
```
This pruned **21 sub-packages** from `node_modules/` and updated `package-lock.json`.

## Verification Result
*   Verified that the backend builds and executes without any module resolution errors.
*   Automated tests executed cleanly after package removal.
*   NPM audit reported **0 vulnerabilities** on remaining active libraries.

## Remaining Issues
*   None. Dead dependencies have been fully removed.

## Recommendation
*   Run `npm audit` weekly inside CI/CD pipelines to catch vulnerable libraries early.
*   Use tools like `depcheck` to verify code-level package imports periodically.
