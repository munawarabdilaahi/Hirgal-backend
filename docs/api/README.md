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
| **Global API** | 60 requests / minute | User ID (if authenticated) or Client IP |
| **Login** | 5 attempts / minute | Email + Client IP |
| **Password Reset** | 5 requests / minute | Client IP |
| **Invitations** | 10 requests / minute | User ID or Client IP |

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
