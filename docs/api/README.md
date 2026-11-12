# Hirgal RESTful API Documentation — v1

- **Base URL:** `/api/v1`
- **Protocol:** HTTPS (in production) / HTTP (local development)
- **Content-Type:** `application/json`
- **Accept:** `application/json`
- **Authentication:** Bearer Token via Laravel Sanctum (`Authorization: Bearer <token>`)

---

## 1. Response Envelope

All API responses follow a uniform JSON structure.

### Success Envelope
```json
{
  "success": true,
  "message": "Operation completed successfully.",
  "data": { ... },
  "meta": {
    "current_page": 1,
    "last_page": 5,
    "per_page": 15,
    "total": 68
  }
}
```

### Error Envelope
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "email": ["Invalid credentials."]
  },
  "error_code": "VALIDATION_ERROR"
}
```

---

## 2. Standard HTTP Status Codes

| Code | Meaning | Standard Error Code | Description |
| :--- | :--- | :--- | :--- |
| **200 OK** | Success | — | Request succeeded. |
| **201 Created** | Created | — | Resource created successfully. |
| **401 Unauthorized** | Unauthenticated | `UNAUTHENTICATED` | Access token missing, expired, or invalid. |
| **403 Forbidden** | Forbidden | `FORBIDDEN` / `ACCOUNT_NOT_ACTIVE` | Authenticated actor lacks permission or account is inactive. |
| **404 Not Found** | Not Found | `RESOURCE_NOT_FOUND` | Resource does not exist or user has no access. |
| **422 Unprocessable** | Validation Error | `VALIDATION_ERROR` | Request payload failed semantic/schema validation. |
| **429 Too Many Requests** | Rate Limited | `RATE_LIMIT_EXCEEDED` | Exceeded endpoint rate limit quota. |
| **500 Server Error** | Internal Server Error | `INTERNAL_SERVER_ERROR` | Unexpected server failure. |

---

## 3. Global Rate Limits

| Scope | Rate Limit Quota | Key Strategy |
| :--- | :--- | :--- |
| **Global API** (`throttle:api`, Phase 9 D6) | 60 requests / minute | Authenticated: `user:{id}` (Sanctum guard); unauthenticated: `ip:{client-ip}` |
| **Login** | 5 attempts / minute | Email + Client IP |
| **Password Reset** | 5 requests / minute | Client IP |
| **Invitations** | 10 requests / minute | User ID or Client IP |
| **Register / Invitation inspect** | 10–30 requests / minute | Client IP |

**D6 — Global API Rate Limiting (implemented and accepted 2026-11-10 — PASS):**

- **Attachment:** the named `api` limiter is attached exactly once to the framework `api` middleware group in `bootstrap/app.php` (`$middleware->throttleApi('api')`), so every route registered in `routes/api.php` inherits it. No route carries its own `throttle:api`.
- **Layering:** endpoint-specific limits (above) remain in place on their routes; the global and endpoint limiters count independently, and whichever exhausts first returns 429 — stricter limits are never weakened.
- **Identity:** authenticated requests resolve the account through the `sanctum` guard inside the limiter (`user:{id}`), so counters are per-account and independent of client-supplied parameters such as `user_id`; unauthenticated requests use the trusted client IP (`ip:{ip}`). `X-Forwarded-For` is untrusted by default — deployments behind a load balancer must configure trusted proxies or all clients will share the proxy's counter.
- **HTTP 429:** standard envelope (`success: false`, `error_code: RATE_LIMIT_EXCEEDED`, message "Rate limit exceeded. Please slow down your requests.") plus framework `Retry-After` and `X-RateLimit-*` headers.
- **Cache infrastructure:** counters use the configured `CACHE_STORE` (default `database`, `cache` table migration shipped). Multi-server deployments must use a shared store (e.g. Redis); file/array stores keep counters per-process and are ineffective across workers.

---

## 4. Security Hardening & Isolation Architecture (Phase 5.2)

1. **Role Authority Hierarchy:** Privilege escalation prevention ensures only System Admins can assign or invite System Admins. Regular users cannot self-escalate roles or account statuses via administrative endpoints.
2. **Pessimistic Concurrency Locking:** Demoting or deactivating System Administrators uses pessimistic InnoDB row locks (`SELECT ... FOR UPDATE` on `roles` table) inside atomic transactions, eliminating race conditions that could lead to administrative lockout.
3. **Information Disclosure & Credential Hygiene:** Raw invitation tokens are sent via `POST /api/v1/invitations/inspect` request bodies, removing sensitive credentials from web server access logs and browser histories.
4. **Timing Attack Resistance:** Dummy Bcrypt password evaluations ensure indistinguishable response times for valid vs non-existent accounts during login.
5. **Least Privilege Data Exposure:** Administrative management endpoints (`/users`) are isolated behind `users.view`. General team member directory lookup uses `/users/directory`, providing sanitized collaboration profiles without exposing account lifecycle or audit metadata.

---

## 5. API Modules Navigation

- [Authentication & Profile API](./AUTH.md)
- [User Management API](./USERS.md)
- [Invitation & Onboarding API](./INVITATIONS.md)
- [Appointments & Scheduling API](./APPOINTMENTS.md)
- [Activity Audit API](./ACTIVITY.md)
- [Notifications Inbox API](./NOTIFICATIONS.md)
