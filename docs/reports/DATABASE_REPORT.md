# DATABASE REPORT

## Findings
VEIL uses PostgreSQL in production (via Supabase) and local SQLite (`dev.db`) in development. High-frequency queries were identified that did not have database indexing, leading to sequential table scans:
1.  **Post Feed Querying**: Loading category-specific, non-deleted posts sorted by date.
2.  **User Feed Querying**: Retrieving posts written by a specific user sorted by date.
3.  **Comments Thread Querying**: Fetching comment replies for a post sorted chronologically.
4.  **Security Auditing**: Fetching security event logs sorted by date for user profiles.

Additionally, nullable fields inside Prisma compound unique constraints (`[userId, postId, commentId, reactionType]`) permit duplicates when one of the keys is NULL (e.g. `commentId`), which SQLite and PostgreSQL permit.

## Risk Level
*   Lack of database indices: **MEDIUM** (degrades to **HIGH** in production scale)
*   Nullable unique constraint duplicate reaction: **LOW** (handled by application checks)

## Affected Files
*   `backend/prisma/schema.prisma` (Index optimizations)

## Code Changes
Added composite indices on the following tables:
```prisma
model SecurityEvent {
  // ...
  @@index([userId, createdAt(sort: Desc)])
}

model Post {
  // ...
  @@index([category, isDeleted, createdAt(sort: Desc)])
  @@index([userId, createdAt(sort: Desc)])
}

model Comment {
  // ...
  @@index([postId, isDeleted, createdAt(sort: Asc)])
}
```

## Verification Result
*   Executed `npx prisma db push` successfully on the PostgreSQL Supabase instance.
*   Verified index placement on the postgres schema.
*   Database responsiveness is verified by integration tests.

## Remaining Issues
*   Reaction duplicate reactions on nullable columns: Because SQL standard allows duplicates when elements of a unique index are null (e.g. `commentId`), application logic is used to enforce uniqueness before write. This is a normal design pattern.

## Recommendation
*   Run weekly `VACUUM` and `ANALYZE` commands on the Supabase database.
*   Configure Prisma Query logs in production to trace queries exceeding 100ms.
