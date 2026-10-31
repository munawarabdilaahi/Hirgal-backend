# User Invitation & Onboarding API Specification

- **Module:** Platform User Invitations
- **Prefix:** `/api/v1/invitations`

---

## 1. Endpoints Overview

| Method | Endpoint | Auth Required | Permission | Description |
| :--- | :--- | :---: | :--- | :--- |
| `GET` | `/api/v1/invitations/{token}` | No | None | Inspect invitation details using raw token. |
| `POST` | `/api/v1/invitations/{token}/accept` | No | None | Accept invitation, create user, assign role, and activate account. |
| `GET` | `/api/v1/invitations` | Yes | `users.invite` | List pending and processed invitations with pagination. |
| `POST` | `/api/v1/invitations` | Yes | `users.invite` | Dispatch a new invitation email with 7-day expiration. |
| `POST` | `/api/v1/invitations/{id}/resend` | Yes | `users.invite` | Refresh token, renew 7-day expiration, and resend invitation. |
| `DELETE` | `/api/v1/invitations/{id}` | Yes | `users.invite` | Revoke a pending invitation. |

---

## 2. Cryptographic Token Lifecycle

```
[Admin Creates Invitation]
      │
      ▼
Raw Token Generated: Str::random(64)
      │
      ├───> Stored in DB: SHA-256 Hash (`token_hash`)
      │
      └───> Dispatched via Email: Raw Token in URL query/path
                  │
                  ▼
[Recipient Submits Raw Token to /invitations/{token}/accept]
      │
      ▼
Engine hashes incoming token: SHA-256(raw_token)
      │
      ▼
Query: WHERE token_hash = ? AND status = 'pending' AND expires_at > now()
      │
      ├──> If Valid: Creates User, Assigns Role, Sets status = 'accepted'
      └──> If Expired / Used: Rejects request with 422
```

---

## 3. Endpoint Details

### 3.1 Inspect Invitation Token
- **Route:** `GET /api/v1/invitations/{token}`
- **Rate Limit:** 30 requests / minute

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Invitation details verified.",
  "data": {
    "id": 5,
    "email": "sarah.lead@hirgal.local",
    "status": "pending",
    "expires_at": "2026-11-07T12:00:00Z",
    "role": {
      "id": 3,
      "name": "Team Leader",
      "slug": "team-leader"
    },
    "inviter": {
      "id": 1,
      "name": "System Administrator",
      "email": "admin@hirgal.local"
    }
  }
}
```

---

### 3.2 Accept Invitation
- **Route:** `POST /api/v1/invitations/{token}/accept`
- **Rate Limit:** 10 requests / minute

#### Request Body
```json
{
  "name": "Sarah Smith",
  "password": "SecurePassword123!",
  "password_confirmation": "SecurePassword123!",
  "timezone": "America/New_York",
  "device_name": "macbook-pro"
}
```

#### Success Response (201 Created)
Returns an authenticated Sanctum access token and complete user profile.

---

### 3.3 Dispatch User Invitation (Admin)
- **Route:** `POST /api/v1/invitations`
- **Rate Limit:** 10 requests / minute
- **Required Permission:** `users.invite`

#### Request Body
```json
{
  "email": "engineer@company.com",
  "role_id": 4
}
```

#### Success Response (201 Created)
```json
{
  "success": true,
  "message": "Invitation dispatched successfully.",
  "data": {
    "id": 8,
    "email": "engineer@company.com",
    "status": "pending",
    "expires_at": "2026-11-07T18:00:00Z",
    "role": {
      "id": 4,
      "name": "Member",
      "slug": "member"
    }
  }
}
```
*Note:* In non-production environments, the meta payload includes `invitation_token` to facilitate automated and integration testing. In production, the raw token is exclusively dispatched via email.
