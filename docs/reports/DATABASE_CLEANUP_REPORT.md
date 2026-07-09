# DATABASE CLEANUP REPORT

## Findings
The repository contained a local SQLite database (`backend/prisma/dev.db`) used during early prototyping and testing. It was populated with old sample posts, reactions, comments, and test users containing mock bcrypt-style hashes. 

To prepare the codebase for clean production handoff, a database cleanup was requested. However, because the main Prisma provider is PostgreSQL (configured in `schema.prisma`), standard Prisma Client commands failed on the local SQLite file due to provider type checks.

To resolve this:
1.  **Backup**: Created a backup of `dev.db` to `dev.db.bak` in the same directory.
2.  **Ignored Backups**: Added `*.bak` to `.gitignore` to prevent the backup database (which holds raw dev data) from being pushed to git.
3.  **SQL Direct Truncation**: Wrote a Node.js utility utilizing Node's built-in `node:sqlite` module to execute raw SQL delete statements, bypassing Prisma.

## Risk Level
*   Sample and test data in repository: **LOW** (compromises repository cleanliness, raises leakage risk if unencrypted)

## Affected Files
*   `backend/prisma/dev.db` (Cleaned database)
*   `backend/prisma/dev.db.bak` (Backup database - local only, git-ignored)
*   `.gitignore` (Updated to ignore backups)

## Code Changes
Created a DB cleanup utility executing raw SQLite commands directly:
```javascript
import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync("prisma/dev.db");
db.exec("PRAGMA foreign_keys = OFF;");
db.exec('DELETE FROM "User";');
db.exec("PRAGMA foreign_keys = ON;");
db.exec("VACUUM;");
```

## Verification Result
*   Successfully ran the direct SQL cleaner.
*   The script reported successful deletion of entries in `Reaction`, `Comment`, `ModerationLog`, `Post`, `Message`, `ThreadParticipant`, `Thread`, and `User`.
*   Obsolete tables that were never migrated on SQLite (such as `Media`, `Passkey`, etc.) were skipped gracefully.
*   Database file shrank successfully via `VACUUM`.
*   `.gitignore` rule was verified. `git status` shows `dev.db.bak` is properly hidden.

## Remaining Issues
*   None.

## Recommendation
*   Avoid committing `dev.db` or database files to production source repositories.
*   Enforce migrations strictly via `prisma migrate deploy` in CD pipelines.
