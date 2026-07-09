# POST-DEPLOYMENT VERIFICATION & SMOKE TEST PLAN

This plan lists the validations and testing flows to run immediately following a production deployment to verify system stability.

## 1. Network & HTTPS Verification
*   [ ] **SSL Certificate Check**: Verify `https://veil.social` loads with a valid Certificate Authority (CA) signature.
*   [ ] **HTTPS Redirections**: Verify http requests (e.g. `http://veil.social`) redirect to `https://veil.social` automatically.
*   [ ] **Security Headers Check**: Run `curl -I https://veil.social` and verify security headers are active:
    *   `Strict-Transport-Security` (HSTS)
    *   `Content-Security-Policy` (CSP)
    *   `X-Content-Type-Options: nosniff`
    *   `X-Frame-Options: DENY`

## 2. API Health checks
*   [ ] **Liveness Probe**: Ping the health route `https://api.veil.social/healthz`. Confirm:
    *   Status code: `200`
    *   Response JSON: `{ "status": "OK", "services": { "database": "UP" } }`
    *   Response latency: `< 35ms`

## 3. Frontend Functional Smoke Tests
*   [ ] **Registration flow**: 
    1. Navigate to the onboarding register view.
    2. Input a new handle (e.g. `@smoke-test`).
    3. Generate and record the recovery codes.
    4. Confirm successful creation (returns `JWT` token and creates User record).
*   [ ] **MFA (TOTP) Setup**:
    1. Navigate to security configurations.
    2. Click enable TOTP.
    3. Scan the QR code, type verification token.
    4. Confirm TOTP is active on the profile page.
*   [ ] **Passkey/WebAuthn Registration**:
    1. Under profile page, enter device label.
    2. Trigger WebAuthn and pass fingerprint/face/PIN credentials.
    3. Verify new credential appears under active passkeys list.
*   [ ] **Anonymous Posting**:
    1. Navigate to the compose tab.
    2. Toggle "Fully Anonymous" option.
    3. Type "Post-deployment smoke test post content."
    4. Click publish, confirm successful feed load without handle.
*   [ ] **Direct Message (E2E Encrypted)**:
    1. Establish a new chat channel thread with another user.
    2. Send a text message.
    3. Verify message is encrypted in transit and can be successfully decrypted and read by the recipient.
*   [ ] **Image upload & Anonymization check**:
    1. Upload a portrait photograph containing a face.
    2. Verify the image is rendered with canvas pixelation over the face area before upload completes.
    3. Confirm image loads on the feed.

## 4. Operational & Database Verifications
*   [ ] Check the database log dashboard to verify:
    *   Security events (such as `ACCOUNT_CREATED` and `LOGIN_SUCCESS`) are correctly logged.
    *   No query timeout warnings.
*   [ ] Access the Amazon CloudWatch console and confirm Morgan server logs are streaming under `/ecs/veil-backend`.
