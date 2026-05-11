# Firebase Data Management Guide

## Overview
Your application now has a comprehensive data logging and auditing system that tracks all data operations in Firebase Firestore.

## Data Collections

Your application manages the following Firestore collections:

| Collection | Purpose | Documents |
|-----------|---------|-----------|
| `events` | Event listings | Event data |
| `courses` | Course information | Course/action plan data |
| `projects` | Project management | Project tracking |
| `observations` | Observations log | Observation entries |
| `collaborations` | Team collaborations | Collaboration records |
| `news` | News/updates | News articles |
| `team_members` | Team roster | Team member profiles |
| `changemakers` | Changemakers directory | Changemaker entries |
| `gallery` | Image/video gallery | Gallery items |
| `tickets` | Support/issue tickets | Ticket records |
| `settings` | Site configuration | Configuration data |
| `audit_logs` | Operation history | Audit entries (auto-created) |

## How to Seed Initial Data

If you have data in `data/cms-store.json`, seed it to Firestore:

```bash
npm run seed:firestore
```

**What this does:**
- Reads all collections from `data/cms-store.json`
- Creates/updates documents in Firestore
- Logs all operations to `audit_logs` collection
- Provides a summary of what was seeded

## API Endpoints for Data Management

### 1. View All Collections & Document Counts
```
GET /api/data/inventory
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalCollections": 11,
    "totalDocuments": 42,
    "collections": [
      {
        "collectionName": "events",
        "documentCount": 5,
        "lastUpdated": "2026-05-11T10:30:00.000Z",
        "sampleDocuments": [...]
      }
    ]
  }
}
```

### 2. View Documents in a Specific Collection
```
GET /api/data/collection/[name]
```

**Example:**
```bash
curl http://localhost:3000/api/data/collection/events
curl http://localhost:3000/api/data/collection/team_members
```

**Response:**
```json
{
  "success": true,
  "data": {
    "collection": "events",
    "documentCount": 5,
    "documents": [
      {
        "id": "2d280a78-6ecd-4e6e-8489-a372226dd723",
        "title": "tech fest",
        "description": "...",
        "date": "2026-04-23",
        "status": "Ongoing",
        "createdAt": "2026-04-20T13:21:08.500Z",
        "updatedAt": "2026-04-20T13:21:08.500Z",
        "_firestoreId": "2d280a78-6ecd-4e6e-8489-a372226dd723"
      }
    ]
  }
}
```

### 3. View Operation Audit Logs
```
GET /api/data/audit?collection=events&operation=CREATE&limit=50
```

**Query Parameters:**
- `collection` (optional): Filter by collection name (e.g., `events`, `team_members`)
- `operation` (optional): Filter by operation type (`CREATE`, `UPDATE`, `DELETE`, `FETCH`)
- `documentId` (optional): Filter by document ID
- `limit` (optional): Maximum number of logs to return (default: 100)

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 3,
    "logs": [
      {
        "id": "1715427000123",
        "timestamp": "2026-05-11T10:30:00.000Z",
        "operation": "CREATE",
        "collectionName": "events",
        "documentId": "2d280a78-6ecd-4e6e-8489-a372226dd723",
        "dataSnapshot": {
          "id": "2d280a78-6ecd-4e6e-8489-a372226dd723",
          "title": "tech fest",
          "description": "...",
          "createdAt": "2026-04-20T13:21:08.500Z",
          "updatedAt": "2026-04-20T13:21:08.500Z"
        },
        "status": "SUCCESS"
      },
      {
        "id": "1715427005456",
        "timestamp": "2026-05-11T10:31:00.000Z",
        "operation": "UPDATE",
        "collectionName": "events",
        "documentId": "2d280a78-6ecd-4e6e-8489-a372226dd723",
        "dataSnapshot": {
          "id": "2d280a78-6ecd-4e6e-8489-a372226dd723",
          "title": "tech fest updated",
          "description": "...",
          "createdAt": "2026-04-20T13:21:08.500Z",
          "updatedAt": "2026-05-11T10:31:00.000Z"
        },
        "oldDataSnapshot": {
          "id": "2d280a78-6ecd-4e6e-8489-a372226dd723",
          "title": "tech fest",
          "description": "..."
        },
        "status": "SUCCESS"
      }
    ]
  }
}
```

## What Gets Logged

Every operation is automatically logged with:
- **Operation type**: CREATE, UPDATE, DELETE, FETCH
- **Timestamp**: When the operation occurred
- **Collection name**: Which collection was affected
- **Document ID**: Which document was affected
- **Current data**: Full snapshot of the document after operation
- **Previous data**: Full snapshot before update (for UPDATE/DELETE operations)
- **Status**: SUCCESS or FAILURE

## Data Flow

```
User Action
    ↓
API Endpoint (e.g., /api/cms/events)
    ↓
Firestore Database
    ↓
Audit Log Entry Created
    ↓
Data Available via:
- /api/data/inventory (view all collections)
- /api/data/collection/[name] (view specific collection)
- /api/data/audit (view operation history)
```

## Security Notes

- All data endpoints require authentication (session cookie)
- Service account credentials are stored in `secrets/firebase-admin.json` (in `.gitignore`)
- Audit logs permanently track all operations for compliance

## Verifying Data

After seeding or making changes:

```bash
# View what collections you have and their sizes
curl http://localhost:3000/api/data/inventory -H "Cookie: auth_cookie_here"

# Check a specific collection
curl http://localhost:3000/api/data/collection/events -H "Cookie: auth_cookie_here"

# View recent operations
curl http://localhost:3000/api/data/audit?limit=20 -H "Cookie: auth_cookie_here"

# Filter by collection
curl http://localhost:3000/api/data/audit?collection=events&operation=CREATE
```

## Next Steps

1. **Ensure credentials are set**: Verify `FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH` in `.env.local`
2. **Start the dev server**: `npm run dev`
3. **Seed initial data**: `npm run seed:firestore`
4. **Verify data**: Check `/api/data/inventory`
5. **Monitor operations**: Check `/api/data/audit` to see what's being saved

All data is now stored in Firebase and can be queried, audited, and tracked!
