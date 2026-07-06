# API Specification - Veil Shine

## 1. Introduction

This document provides the RESTful API specification for the Veil Shine backend services. It outlines the available endpoints, expected request and response formats, authentication mechanisms, and common error codes. The API is designed to be consumed by the Veil Shine web frontend and potentially other anonymous client applications, prioritizing security, anonymity, and ease of integration.

## 2. API Design Principles

*   **RESTful**: Adheres to REST principles for resource-oriented design.
*   **Stateless**: Each request from a client to the server must contain all the information needed to understand the request.
*   **JSON-centric**: All request and response bodies are in JSON format.
*   **Secure**: All communication is over HTTPS, and authentication is token-based.
*   **Anonymous**: No PII is ever transmitted or required by the API.
*   **Versioned**: API endpoints are versioned (e.g., `/v1/`) to allow for future changes without breaking existing clients.

## 3. Authentication

All API requests, except for anonymous account creation, require authentication. Veil Shine uses anonymous JWT (JSON Web Token) based authentication.

*   **Mechanism**: Bearer Token in the `Authorization` header.
*   **Token Acquisition**: After anonymous account creation, the Auth Service issues a short-lived access token and a longer-lived refresh token.
*   **Token Refresh**: Clients are responsible for refreshing access tokens using the refresh token before they expire.

**Example Request Header**:

```
Authorization: Bearer <your_anonymous_access_token>
Content-Type: application/json
```

## 4. Error Handling

API errors are returned with appropriate HTTP status codes and a standardized JSON error response body.

**Standard Error Response Body**:

```json
{
  "status": "error",
  "message": "A human-readable error message.",
  "code": "ERROR_CODE_ENUM",
  "details": { /* Optional: specific validation errors or additional context */ }
}
```

**Common HTTP Status Codes**:

| Status Code | Description                                   |
|-------------|-----------------------------------------------|
| `200 OK`    | Request successful.                           |
| `201 Created` | Resource successfully created.                |
| `204 No Content` | Request successful, no content to return.     |
| `400 Bad Request` | Invalid request payload or parameters.        |
| `401 Unauthorized` | Authentication required or failed.            |
| `403 Forbidden` | Authenticated, but not authorized to access.  |
| `404 Not Found` | Resource not found.                           |
| `409 Conflict` | Resource already exists or conflicts.         |
| `429 Too Many Requests` | Rate limit exceeded.                          |
| `500 Internal Server Error` | Unexpected server error.                      |

## 5. API Endpoints

All endpoints are prefixed with `/v1`.

### 5.1. Authentication Endpoints

#### `POST /v1/auth/register`
*   **Description**: Creates a new anonymous user account.
*   **Request Body**:
    ```json
    {
      "handle": "string", // Unique anonymous handle, e.g., "ShadowWhisper"
      "recovery_passphrase": "string" // Optional: User-chosen passphrase for account recovery
    }
    ```
*   **Response Body (201 Created)**:
    ```json
    {
      "status": "success",
      "message": "Anonymous account created successfully.",
      "data": {
        "user_id": "uuid",
        "handle": "string",
        "access_token": "string", // JWT
        "refresh_token": "string" // JWT
      }
    }
    ```
*   **Error Codes**: `HANDLE_TAKEN`, `INVALID_INPUT`

#### `POST /v1/auth/login`
*   **Description**: Authenticates an existing anonymous user and issues new tokens.
*   **Request Body**:
    ```json
    {
      "handle": "string",
      "recovery_passphrase": "string" // Required if recovery_passphrase was set during registration
    }
    ```
*   **Response Body (200 OK)**:
    ```json
    {
      "status": "success",
      "message": "Login successful.",
      "data": {
        "user_id": "uuid",
        "handle": "string",
        "access_token": "string",
        "refresh_token": "string"
      }
    }
    ```
*   **Error Codes**: `INVALID_CREDENTIALS`, `USER_BANNED`

#### `POST /v1/auth/refresh`
*   **Description**: Refreshes an expired access token using a valid refresh token.
*   **Request Body**:
    ```json
    {
      "refresh_token": "string"
    }
    ```
*   **Response Body (200 OK)**:
    ```json
    {
      "status": "success",
      "message": "Token refreshed successfully.",
      "data": {
        "access_token": "string",
        "refresh_token": "string"
      }
    }
    ```
*   **Error Codes**: `INVALID_REFRESH_TOKEN`, `EXPIRED_REFRESH_TOKEN`

### 5.2. User Profile Endpoints

#### `GET /v1/users/me`
*   **Description**: Retrieves the authenticated anonymous user's profile.
*   **Response Body (200 OK)**:
    ```json
    {
      "status": "success",
      "data": {
        "user_id": "uuid",
        "handle": "string",
        "avatar_url": "string",
        "created_at": "datetime"
      }
    }
    ```

#### `PUT /v1/users/me/avatar`
*   **Description**: Updates the authenticated anonymous user's avatar.
*   **Request Body**:
    ```json
    {
      "avatar_url": "string" // URL to a new anonymous avatar image
    }
    ```
*   **Response Body (200 OK)**:
    ```json
    {
      "status": "success",
      "message": "Avatar updated successfully.",
      "data": {
        "avatar_url": "string"
      }
    }
    ```
*   **Error Codes**: `INVALID_AVATAR_URL`

### 5.3. Post Endpoints

#### `POST /v1/posts`
*   **Description**: Creates a new anonymous post.
*   **Request Body**:
    ```json
    {
      "content": "string", // Max 500 characters
      "category": "string", // e.g., "Confession", "Question", "Story"
      "media_url": "string", // Optional: URL to AI-modified image/audio
      "is_ai_modified_media": "boolean" // Required if media_url is provided
    }
    ```
*   **Response Body (201 Created)**:
    ```json
    {
      "status": "success",
      "message": "Post created successfully.",
      "data": {
        "post_id": "uuid",
        "user_id": "uuid",
        "content": "string",
        "category": "string",
        "created_at": "datetime",
        "media_url": "string",
        "is_ai_modified_media": "boolean",
        "sentiment_analysis": { /* AI-generated sentiment */ }
      }
    }
    ```
*   **Error Codes**: `INVALID_CONTENT`, `INVALID_CATEGORY`, `MEDIA_TYPE_MISMATCH`

#### `GET /v1/posts/{post_id}`
*   **Description**: Retrieves a single anonymous post by its ID.
*   **Response Body (200 OK)**:
    ```json
    {
      "status": "success",
      "data": {
        "post_id": "uuid",
        "user_id": "uuid",
        "handle": "string", // Creator's handle
        "avatar_url": "string", // Creator's avatar
        "content": "string",
        "category": "string",
        "created_at": "datetime",
        "media_url": "string",
        "is_ai_modified_media": "boolean",
        "sentiment_analysis": { /* AI-generated sentiment */ },
        "reaction_counts": { "upvote": 10, "heart": 5 },
        "comment_count": 15
      }
    }
    ```
*   **Error Codes**: `POST_NOT_FOUND`

#### `GET /v1/posts/feed`
*   **Description**: Retrieves a personalized feed of anonymous posts.
*   **Query Parameters**:
    *   `limit`: `integer` (default: 20, max: 100)
    *   `offset`: `integer` (default: 0)
    *   `category`: `string` (Optional: filter by category)
    *   `sort_by`: `string` (Optional: `latest`, `trending`, `sentiment`)
*   **Response Body (200 OK)**:
    ```json
    {
      "status": "success",
      "data": [
        { /* Post Object (same as GET /v1/posts/{post_id}) */ },
        // ... more posts
      ],
      "meta": {
        "total": 100,
        "limit": 20,
        "offset": 0
      }
    }
    ```

#### `DELETE /v1/posts/{post_id}`
*   **Description**: Deletes an anonymous post (soft delete).
*   **Response Body (204 No Content)**:
    ```json
    // No content
    ```
*   **Error Codes**: `POST_NOT_FOUND`, `NOT_POST_OWNER`

### 5.4. Comment Endpoints

#### `POST /v1/posts/{post_id}/comments`
*   **Description**: Adds a new anonymous comment to a post.
*   **Request Body**:
    ```json
    {
      "content": "string", // Max 250 characters
      "parent_comment_id": "uuid" // Optional: for replies to comments
    }
    ```
*   **Response Body (201 Created)**:
    ```json
    {
      "status": "success",
      "message": "Comment added successfully.",
      "data": {
        "comment_id": "uuid",
        "post_id": "uuid",
        "user_id": "uuid",
        "content": "string",
        "created_at": "datetime"
      }
    }
    ```
*   **Error Codes**: `POST_NOT_FOUND`, `INVALID_CONTENT`, `PARENT_COMMENT_NOT_FOUND`

#### `GET /v1/posts/{post_id}/comments`
*   **Description**: Retrieves all comments for a specific post.
*   **Query Parameters**:
    *   `limit`: `integer` (default: 20, max: 100)
    *   `offset`: `integer` (default: 0)
*   **Response Body (200 OK)**:
    ```json
    {
      "status": "success",
      "data": [
        {
          "comment_id": "uuid",
          "post_id": "uuid",
          "user_id": "uuid",
          "handle": "string",
          "avatar_url": "string",
          "parent_comment_id": "uuid",
          "content": "string",
          "created_at": "datetime",
          "reaction_counts": { "upvote": 5 }
        },
        // ... more comments
      ],
      "meta": {
        "total": 50,
        "limit": 20,
        "offset": 0
      }
    }
    ```
*   **Error Codes**: `POST_NOT_FOUND`

#### `DELETE /v1/comments/{comment_id}`
*   **Description**: Deletes an anonymous comment (soft delete).
*   **Response Body (204 No Content)**:
    ```json
    // No content
    ```
*   **Error Codes**: `COMMENT_NOT_FOUND`, `NOT_COMMENT_OWNER`

### 5.5. Reaction Endpoints

#### `POST /v1/posts/{post_id}/reactions`
*   **Description**: Adds an anonymous reaction to a post.
*   **Request Body**:
    ```json
    {
      "reaction_type": "string" // e.g., "upvote", "heart", "laugh"
    }
    ```
*   **Response Body (201 Created)**:
    ```json
    {
      "status": "success",
      "message": "Reaction added successfully.",
      "data": {
        "reaction_id": "uuid",
        "post_id": "uuid",
        "user_id": "uuid",
        "reaction_type": "string",
        "created_at": "datetime"
      }
    }
    ```
*   **Error Codes**: `POST_NOT_FOUND`, `INVALID_REACTION_TYPE`, `ALREADY_REACTED`

#### `POST /v1/comments/{comment_id}/reactions`
*   **Description**: Adds an anonymous reaction to a comment.
*   **Request Body**:
    ```json
    {
      "reaction_type": "string" // e.g., "upvote", "heart", "laugh"
    }
    ```
*   **Response Body (201 Created)**:
    ```json
    {
      "status": "success",
      "message": "Reaction added successfully.",
      "data": {
        "reaction_id": "uuid",
        "comment_id": "uuid",
        "user_id": "uuid",
        "reaction_type": "string",
        "created_at": "datetime"
      }
    }
    ```
*   **Error Codes**: `COMMENT_NOT_FOUND`, `INVALID_REACTION_TYPE`, `ALREADY_REACTED`

#### `DELETE /v1/reactions/{reaction_id}`
*   **Description**: Removes an anonymous reaction.
*   **Response Body (204 No Content)**:
    ```json
    // No content
    ```
*   **Error Codes**: `REACTION_NOT_FOUND`, `NOT_REACTION_OWNER`

### 5.6. Moderation Endpoints (Admin Only)

These endpoints require elevated administrator privileges.

#### `GET /v1/admin/moderation/queue`
*   **Description**: Retrieves the moderation queue (AI-flagged and user-reported content).
*   **Query Parameters**:
    *   `status`: `string` (Optional: `pending`, `reviewed`)
    *   `type`: `string` (Optional: `post`, `comment`)
*   **Response Body (200 OK)**:
    ```json
    {
      "status": "success",
      "data": [
        {
          "log_id": "uuid",
          "target_type": "string", // "post" or "comment"
          "target_id": "uuid",
          "content_snapshot": "string",
          "ai_flags": { /* AI flags */ },
          "reported_by_user_id": "uuid", // Optional
          "created_at": "datetime"
        },
        // ... more moderation items
      ]
    }
    ```
*   **Error Codes**: `UNAUTHORIZED_ADMIN`

#### `POST /v1/admin/moderation/{log_id}/action`
*   **Description**: Performs a moderation action on a flagged item.
*   **Request Body**:
    ```json
    {
      "action": "string", // e.g., "approve", "remove", "ban_user"
      "reason": "string" // Optional: reason for the action
    }
    ```
*   **Response Body (200 OK)**:
    ```json
    {
      "status": "success",
      "message": "Moderation action recorded."
    }
    ```
*   **Error Codes**: `LOG_ITEM_NOT_FOUND`, `INVALID_ACTION`, `UNAUTHORIZED_ADMIN`

## 6. References

*   [OpenAPI Specification 3.0](https://swagger.io/specification/)
*   [JSON Web Tokens (JWT)](https://jwt.io/introduction/)
*   [HTTP Status Codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)
