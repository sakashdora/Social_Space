# Database Schema - Veil Shine

## 1. Introduction

This document details the PostgreSQL database schema for Veil Shine, an AI-powered anonymous social platform. The schema is designed to support the core functionalities of anonymous posting, commenting, reacting, and AI-driven moderation, while strictly adhering to the principle of architectural anonymity. All user-identifiable information is minimized and abstracted to prevent linking activities to real-world identities.

## 2. Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    USER ||--o{ POST : "has"
    USER ||--o{ COMMENT : "has"
    USER ||--o{ REACTION : "has"
    POST ||--o{ COMMENT : "contains"
    POST ||--o{ REACTION : "receives"
    COMMENT ||--o{ REACTION : "receives"
    COMMENT ||--o{ COMMENT : "replies_to"
    POST ||--o{ MODERATION_LOG : "is_moderated"
    COMMENT ||--o{ MODERATION_LOG : "is_moderated"
    ADMIN_USER ||--o{ MODERATION_LOG : "performs"

    USER {
        UUID user_id PK
        VARCHAR(50) handle UNIQUE
        TIMESTAMP created_at
        TIMESTAMP updated_at
        BOOLEAN is_banned
        TEXT recovery_hash
        TEXT avatar_url
    }

    POST {
        UUID post_id PK
        UUID user_id FK
        TEXT content
        VARCHAR(50) category
        JSONB ai_labels
        TIMESTAMP created_at
        TIMESTAMP updated_at
        BOOLEAN is_deleted
        BOOLEAN is_ai_modified_media
        TEXT media_url
        JSONB sentiment_analysis
    }

    COMMENT {
        UUID comment_id PK
        UUID post_id FK
        UUID user_id FK
        UUID parent_comment_id FK "Optional: for threaded comments"
        TEXT content
        TIMESTAMP created_at
        TIMESTAMP updated_at
        BOOLEAN is_deleted
    }

    REACTION {
        UUID reaction_id PK
        UUID user_id FK
        UUID post_id FK "Optional: for post reactions"
        UUID comment_id FK "Optional: for comment reactions"
        VARCHAR(20) reaction_type
        TIMESTAMP created_at
    }

    MODERATION_LOG {
        UUID log_id PK
        UUID target_post_id FK "Optional: if moderating a post"
        UUID target_comment_id FK "Optional: if moderating a comment"
        UUID admin_user_id FK "Optional: if action by admin"
        VARCHAR(50) action_taken
        TEXT reason
        TIMESTAMP created_at
        JSONB ai_flags
        TEXT original_content_snapshot
    }

    ADMIN_USER {
        UUID admin_user_id PK
        VARCHAR(100) username UNIQUE
        TEXT password_hash
        VARCHAR(50) role
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }
```

## 3. Table Definitions

### 3.1. `users` Table

Stores anonymous user profiles. No PII is stored here. `user_id` is the primary identifier for all user-related actions, but it is not traceable to a real person.

| Column Name     | Data Type | Constraints           | Description                                                               |
|-----------------|-----------|-----------------------|---------------------------------------------------------------------------|
| `user_id`       | `UUID`    | `PRIMARY KEY`         | Unique identifier for the anonymous user.                                 |
| `handle`        | `VARCHAR(50)` | `UNIQUE`, `NOT NULL`  | User-chosen anonymous handle.                                             |
| `created_at`    | `TIMESTAMP` | `NOT NULL`, `DEFAULT NOW()` | Timestamp when the user account was created.                              |
| `updated_at`    | `TIMESTAMP` | `NOT NULL`, `DEFAULT NOW()` | Last timestamp when the user account was updated.                         |
| `is_banned`     | `BOOLEAN` | `NOT NULL`, `DEFAULT FALSE` | Flag indicating if the user is banned from the platform.                  |
| `recovery_hash` | `TEXT`    | `NULLABLE`            | Hash of the client-side recovery passphrase. Never stores the passphrase itself. |
| `avatar_url`    | `TEXT`    | `NULLABLE`            | URL to the user's anonymous avatar image.                                 |

### 3.2. `posts` Table

Stores all anonymous posts created by users.

| Column Name             | Data Type | Constraints           | Description                                                               |
|-------------------------|-----------|-----------------------|---------------------------------------------------------------------------|
| `post_id`               | `UUID`    | `PRIMARY KEY`         | Unique identifier for the post.                                           |
| `user_id`               | `UUID`    | `FOREIGN KEY (users.user_id)`, `NOT NULL` | Anonymous user who created the post.                                      |
| `content`               | `TEXT`    | `NOT NULL`            | The main text content of the post.                                        |
| `category`              | `VARCHAR(50)` | `NOT NULL`            | Category of the post (e.g., "Confession", "Question", "Story").       |
| `ai_labels`             | `JSONB`   | `NULLABLE`            | AI-generated labels or tags for the post content.                         |
| `created_at`            | `TIMESTAMP` | `NOT NULL`, `DEFAULT NOW()` | Timestamp when the post was created.                                      |
| `updated_at`            | `TIMESTAMP` | `NOT NULL`, `DEFAULT NOW()` | Last timestamp when the post was updated.                                 |
| `is_deleted`            | `BOOLEAN` | `NOT NULL`, `DEFAULT FALSE` | Flag indicating if the post has been soft-deleted.                        |
| `is_ai_modified_media`  | `BOOLEAN` | `NOT NULL`, `DEFAULT FALSE` | Flag indicating if the post includes AI-modified media.                   |
| `media_url`             | `TEXT`    | `NULLABLE`            | URL to any attached AI-modified image or audio.                           |
| `sentiment_analysis`    | `JSONB`   | `NULLABLE`            | AI-generated sentiment analysis results for the post.                     |

### 3.3. `comments` Table

Stores all anonymous comments on posts and replies to other comments.

| Column Name         | Data Type | Constraints           | Description                                                               |
|---------------------|-----------|-----------------------|---------------------------------------------------------------------------|
| `comment_id`        | `UUID`    | `PRIMARY KEY`         | Unique identifier for the comment.                                        |
| `post_id`           | `UUID`    | `FOREIGN KEY (posts.post_id)`, `NOT NULL` | The post to which this comment belongs.                                   |
| `user_id`           | `UUID`    | `FOREIGN KEY (users.user_id)`, `NOT NULL` | Anonymous user who created the comment.                                   |
| `parent_comment_id` | `UUID`    | `FOREIGN KEY (comments.comment_id)`, `NULLABLE` | For threaded comments, refers to the parent comment.                      |
| `content`           | `TEXT`    | `NOT NULL`            | The text content of the comment.                                          |
| `created_at`        | `TIMESTAMP` | `NOT NULL`, `DEFAULT NOW()` | Timestamp when the comment was created.                                   |
| `updated_at`        | `TIMESTAMP` | `NOT NULL`, `DEFAULT NOW()` | Last timestamp when the comment was updated.                              |
| `is_deleted`        | `BOOLEAN` | `NOT NULL`, `DEFAULT FALSE` | Flag indicating if the comment has been soft-deleted.                     |

### 3.4. `reactions` Table

Stores anonymous user reactions to posts and comments.

| Column Name     | Data Type | Constraints           | Description                                                               |
|-----------------|-----------|-----------------------|---------------------------------------------------------------------------|
| `reaction_id`   | `UUID`    | `PRIMARY KEY`         | Unique identifier for the reaction.                                       |
| `user_id`       | `UUID`    | `FOREIGN KEY (users.user_id)`, `NOT NULL` | Anonymous user who made the reaction.                                     |
| `post_id`       | `UUID`    | `FOREIGN KEY (posts.post_id)`, `NULLABLE` | The post to which this reaction applies (if not a comment reaction).      |
| `comment_id`    | `UUID`    | `FOREIGN KEY (comments.comment_id)`, `NULLABLE` | The comment to which this reaction applies (if not a post reaction).      |
| `reaction_type` | `VARCHAR(20)` | `NOT NULL`            | Type of reaction (e.g., "upvote", "heart", "laugh").                  |
| `created_at`    | `TIMESTAMP` | `NOT NULL`, `DEFAULT NOW()` | Timestamp when the reaction was created.                                  |
| `post_id` and `comment_id` should have a `CHECK` constraint to ensure only one is set. |

### 3.5. `moderation_logs` Table

Records all moderation actions, whether automated by AI or performed by an administrator.

| Column Name               | Data Type | Constraints           | Description                                                               |
|---------------------------|-----------|-----------------------|---------------------------------------------------------------------------|
| `log_id`                  | `UUID`    | `PRIMARY KEY`         | Unique identifier for the moderation log entry.                           |
| `target_post_id`          | `UUID`    | `FOREIGN KEY (posts.post_id)`, `NULLABLE` | The post that was moderated.                                              |
| `target_comment_id`       | `UUID`    | `FOREIGN KEY (comments.comment_id)`, `NULLABLE` | The comment that was moderated.                                           |
| `admin_user_id`           | `UUID`    | `FOREIGN KEY (admin_users.admin_user_id)`, `NULLABLE` | The administrator who performed the action (if manual).                   |
| `action_taken`            | `VARCHAR(50)` | `NOT NULL`            | Action performed (e.g., "flagged", "removed", "approved", "banned_user"). |
| `reason`                  | `TEXT`    | `NULLABLE`            | Detailed reason for the moderation action.                                |
| `created_at`              | `TIMESTAMP` | `NOT NULL`, `DEFAULT NOW()` | Timestamp when the moderation action was logged.                          |
| `ai_flags`                | `JSONB`   | `NULLABLE`            | AI-generated flags or scores that triggered the moderation.               |
| `original_content_snapshot` | `TEXT`    | `NULLABLE`            | Snapshot of the content before moderation (for review/auditing).          |

### 3.6. `admin_users` Table

Stores credentials for platform administrators. This table is separate and highly secured, with strict access controls.

| Column Name     | Data Type | Constraints           | Description                                                               |
|-----------------|-----------|-----------------------|---------------------------------------------------------------------------|
| `admin_user_id` | `UUID`    | `PRIMARY KEY`         | Unique identifier for the administrator.                                  |
| `username`      | `VARCHAR(100)` | `UNIQUE`, `NOT NULL`  | Administrator's username.                                                 |
| `password_hash` | `TEXT`    | `NOT NULL`            | Hashed password for the administrator.                                    |
| `role`          | `VARCHAR(50)` | `NOT NULL`            | Role of the administrator (e.g., "super_admin", "moderator").           |
| `created_at`    | `TIMESTAMP` | `NOT NULL`, `DEFAULT NOW()` | Timestamp when the admin account was created.                             |
| `updated_at`    | `TIMESTAMP` | `NOT NULL`, `DEFAULT NOW()` | Last timestamp when the admin account was updated.                        |

## 4. Indexes

To optimize query performance, the following indexes should be considered:

*   `posts`: `CREATE INDEX idx_posts_user_id ON posts (user_id);`
*   `posts`: `CREATE INDEX idx_posts_category ON posts (category);`
*   `posts`: `CREATE INDEX idx_posts_created_at ON posts (created_at DESC);`
*   `comments`: `CREATE INDEX idx_comments_post_id ON comments (post_id);`
*   `comments`: `CREATE INDEX idx_comments_user_id ON comments (user_id);`
*   `comments`: `CREATE INDEX idx_comments_parent_comment_id ON comments (parent_comment_id);`
*   `reactions`: `CREATE INDEX idx_reactions_user_id ON reactions (user_id);`
*   `reactions`: `CREATE INDEX idx_reactions_post_id ON reactions (post_id);`
*   `reactions`: `CREATE INDEX idx_reactions_comment_id ON reactions (comment_id);`
*   `moderation_logs`: `CREATE INDEX idx_moderation_logs_target_post_id ON moderation_logs (target_post_id);`
*   `moderation_logs`: `CREATE INDEX idx_moderation_logs_target_comment_id ON moderation_logs (target_comment_id);`
*   `moderation_logs`: `CREATE INDEX idx_moderation_logs_admin_user_id ON moderation_logs (admin_user_id);`

## 5. Relationships and Constraints

*   **One-to-Many**: A `USER` can have many `POST`s, `COMMENT`s, and `REACTION`s.
*   **One-to-Many**: A `POST` can have many `COMMENT`s and `REACTION`s.
*   **One-to-Many**: A `COMMENT` can have many `REACTION`s.
*   **Self-Referencing**: A `COMMENT` can have a `parent_comment_id` referencing another `COMMENT` for threading.
*   **Conditional Foreign Keys**: `REACTION` and `MODERATION_LOG` tables use nullable foreign keys to `posts` and `comments`, with application-level logic or database constraints to ensure only one is populated per record.
*   **Uniqueness**: `handle` in `users` and `username` in `admin_users` are unique.

## 6. References

*   [PostgreSQL Documentation](https://www.postgresql.org/docs/current/)
*   [Mermaid ER Diagram Syntax](https://mermaid.js.org/syntax/entityRelationshipDiagram.html)
*   [Supabase PostgreSQL](https://supabase.com/docs/guides/database/tables)
