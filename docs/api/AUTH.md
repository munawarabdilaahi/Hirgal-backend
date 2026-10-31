# Authentication & User Profile API Specification

- **Module:** Authentication & Profile
- **Prefix:** `/api/v1/auth`

---

## 1. Endpoints Overview

| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/v1/auth/register` | No | Register when public registration is enabled. |
| `POST` | `/api/v1/auth/login` | No | Authenticate user credentials and receive Sanctum bearer token. |
| `POST` | `/api/v1/auth/logout` | Yes | Invalidate the current session token. |
| `POST` | `/api/v1/auth/logout-all` | Yes | Invalidate all session tokens across all devices. |
| `GET` | `/api/v1/auth/me` | Yes | Retrieve authenticated user details, roles, permissions, and profile. |
| `PUT` | `/api/v1/auth/me/profile` | Yes | Update permitted user profile attributes. |
| `POST` | `/api/v1/auth/forgot-password` | No | Dispatch secure password reset token via email. |
| `POST` | `/api/v1/auth/reset-password` | No | Reset password using valid expiring reset token. |
| `POST` | `/api/v1/auth/change-password` | Yes | Update password for the authenticated user. |

---

## 2. Endpoint Details

### 2.1 Public Registration
- **Route:** `POST /api/v1/auth/register`
- **Rate Limit:** 10 requests / minute
- **Authorization:** Public (gated by `config('auth.allow_registration')`, defaults to `false`)

#### Request Body
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "Password123!",
  "password_confirmation": "Password123!",
  "timezone": "America/New_York",
  "device_name": "chrome-desktop"
}
```

#### Success Response (201 Created)
```json
{
  "success": true,
  "message": "User registered successfully.",
  "data": {
    "access_token": "1|sanctum_plain_text_token...",
    "token_type": "Bearer",
    "user": {
      "id": 12,
      "name": "Jane Doe",
      "email": "jane@example.com",
      "account_status": "active",
      "timezone": "America/New_York",
      "roles": [
        {
          "id": 4,
          "name": "Member",
          "slug": "member"
        }
      ]
    }
  }
}
```

---

### 2.2 Login
- **Route:** `POST /api/v1/auth/login`
- **Rate Limit:** 5 attempts / minute per (Email + IP)

#### Request Body
```json
{
  "email": "pm@hirgal.local",
  "password": "Password123!",
  "device_name": "macbook-air"
}
```

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Authenticated successfully.",
  "data": {
    "access_token": "2|sanctum_plain_text_token...",
    "token_type": "Bearer",
    "user": {
      "id": 2,
      "name": "Sarah Project Manager",
      "email": "pm@hirgal.local",
      "account_status": "active",
      "timezone": "UTC",
      "roles": [
        {
          "id": 2,
          "name": "Project Manager",
          "slug": "project-manager"
        }
      ],
      "permissions": [
        "projects.view",
        "projects.create",
        "tasks.view",
        "users.invite"
      ],
      "profile": {
        "job_title": "Senior Technical PM",
        "department": "Product Delivery"
      }
    }
  }
}
```

#### Error Response — Invalid Credentials (422)
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

#### Error Response — Suspended Account (403)
```json
{
  "success": false,
  "message": "Your account is suspended. Please contact an administrator.",
  "error_code": "FORBIDDEN"
}
```

---

### 2.3 Logout
- **Route:** `POST /api/v1/auth/logout`
- **Header:** `Authorization: Bearer <token>`

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Successfully logged out.",
  "data": null
}
```

---

### 2.4 Logout from All Devices
- **Route:** `POST /api/v1/auth/logout-all`
- **Header:** `Authorization: Bearer <token>`

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Successfully logged out from all devices.",
  "data": null
}
```

---

### 2.5 Authenticated User Profile (`/auth/me`)
- **Route:** `GET /api/v1/auth/me`
- **Header:** `Authorization: Bearer <token>`

#### Success Response (200 OK)
Returns complete authenticated user graph including profile, global roles, and effective permission list.

---

### 2.6 Update Profile
- **Route:** `PUT /api/v1/auth/me/profile`
- **Header:** `Authorization: Bearer <token>`

#### Request Body
```json
{
  "name": "Sarah PM Updated",
  "phone": "+1-555-0199",
  "job_title": "Director of Product",
  "bio": "Overseeing cross-functional engineering delivery.",
  "theme_preference": "dark",
  "notification_preferences": {
    "email_task_assigned": true,
    "email_task_commented": true,
    "browser_push": false
  }
}
```

#### Protected Fields Guarantee
Ordinary profile updates ignore or reject protected fields (`role_id`, `account_status`, `permissions`, `email_verified_at`).

---

### 2.7 Password Management

#### Forgot Password
- **Route:** `POST /api/v1/auth/forgot-password`
- **Rate Limit:** 5 requests / minute
```json
{
  "email": "user@hirgal.local"
}
```
*Note:* Always returns 200 OK with a generic message even if the email does not exist to eliminate account enumeration risks.

#### Reset Password
- **Route:** `POST /api/v1/auth/reset-password`
```json
{
  "email": "user@hirgal.local",
  "token": "plain-text-reset-token-received-via-email",
  "password": "NewSecurePassword123!",
  "password_confirmation": "NewSecurePassword123!"
}
```
*Security note:* Successfully resetting a password deletes the reset token record and invalidates all existing active Sanctum bearer tokens.

#### Change Password
- **Route:** `POST /api/v1/auth/change-password`
- **Header:** `Authorization: Bearer <token>`
```json
{
  "current_password": "CurrentPassword123!",
  "password": "BrandNewPassword123!",
  "password_confirmation": "BrandNewPassword123!",
  "logout_other_devices": true
}
```
