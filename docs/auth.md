# Authentication API

Base path: /api/auth

All POST endpoints require CSRF protection via `GET /api/auth/csrf` and sending `x-csrf-token` header that matches the `csrfToken` cookie.

## POST /api/auth/register/admin
Creates an ADMIN account and centers. Returns JWT access token and refresh token.

Request body:
- `firstName` string
- `lastName` string
- `email` string (email)
- `password` string (min 8)
- `phone` string optional
- `centers` array of objects (min 1)
  - `name` string
  - `addressLine1` string optional
  - `addressLine2` string optional
  - `city` string optional
  - `state` string optional
  - `postalCode` string optional

Response 201:
- `user` object
- `centers` array
- `tokens` object

Example request:
```json
{
  "firstName": "Priya",
  "lastName": "Shah",
  "email": "admin@example.com",
  "password": "StrongPass123",
  "centers": [{ "name": "Downtown Center", "city": "Pune" }]
}
```

## POST /api/auth/register/staff
Creates a STAFF account and assigns centers. Status is `PENDING` unless `invitationCode` is provided.

Request body:
- `firstName` string
- `lastName` string
- `email` string
- `password` string
- `phone` string optional
- `centerIds` string[] (min 1)
- `roleTitle` string
- `invitationCode` string optional

Response 201:
- `user` object (includes `staffStatus`)
- `tokens` object

## POST /api/auth/register/parent
Creates a PARENT account and child records.

Request body:
- `firstName` string
- `lastName` string
- `email` string
- `password` string
- `phone` string optional
- `centerId` string
- `communicationPrefs` object optional
- `children` array (min 1)
  - `firstName` string
  - `lastName` string
  - `dateOfBirth` string (ISO) optional
  - `relationship` string optional

Response 201:
- `user` object
- `children` array
- `tokens` object

## POST /api/auth/login
Authenticates any role and returns JWT access + refresh tokens.

Request body:
- `email` string
- `password` string

Response 200:
- `user` object
- `tokens` object

## POST /api/auth/refresh
Rotates refresh token and returns new access + refresh tokens.

Request body:
- `refreshToken` string

Response 200:
- `tokens` object

## POST /api/auth/logout
Revokes the refresh token.

Request body:
- `refreshToken` string

Response 200:
- `success` boolean

## POST /api/auth/forgot-password
Creates a password reset token and emails the user if the email exists.

Request body:
- `email` string

Response 200:
- `success` boolean

## POST /api/auth/reset-password
Resets password using token.

Request body:
- `email` string
- `token` string
- `password` string

Response 200:
- `success` boolean

## GET /api/auth/csrf
Returns a CSRF token and sets a `csrfToken` cookie.

Response 200:
- `csrfToken` string

## Error format
All error responses:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```