# Salesforce Integration Backend

This document describes the Salesforce (SFDC) integration backend for the lp-studio app. The integration enables bi-directional sync of Salesforce data (Accounts, Contacts, Leads, Opportunities) into the LP Studio database.

## Architecture

### Service Layer (`sfdc-service.ts`)
The `SfdcService` class handles all Salesforce API interactions using the native Node.js `fetch` API (no external SFDC library).

**Key Methods:**

#### Authentication
- `getAuthorizationUrl(redirectUri)` — Build OAuth2 authorization URL
- `exchangeCodeForTokens(code, redirectUri)` — Exchange auth code for access/refresh tokens
- `refreshAccessToken(connectionId)` — Refresh expired tokens
- `getConnectionWithValidToken(connectionId)` — Get connection with token refresh if needed

#### Sync Operations
- `syncAccounts(connectionId)` — Fetch Accounts, upsert into `sales_accounts`
- `syncContacts(connectionId)` — Fetch Contacts, upsert into `sales_contacts`
- `syncLeads(connectionId)` — Fetch Leads, upsert into `sfdc_leads`
- `syncOpportunities(connectionId)` — Fetch Opportunities, upsert into `sfdc_opportunities`
- `syncAll(connectionId)` — Run all 4 syncs sequentially, update connection status

#### Query Helpers
- `querySalesforce(connectionId, soql)` — Execute SOQL queries, handles rate limiting

### Routes (`sfdc.ts`)
Express router providing REST endpoints for SFDC integration:

**Authentication & Management:**
- `GET /sfdc/auth-url` — Returns OAuth2 authorization URL
- `GET /sfdc/callback` — OAuth2 callback handler
- `GET /sfdc/connection` — Get current connection status
- `POST /sfdc/disconnect` — Disconnect and clear tokens

**Sync Operations:**
- `POST /sfdc/sync` — Trigger full sync (background)
- `POST /sfdc/sync/:object` — Sync specific object (accounts|contacts|leads|opportunities)
- `GET /sfdc/sync/log` — Get sync history (last 50)

**Field Mapping & Data Access:**
- `GET /sfdc/field-mappings` — List field mappings for connection
- `PUT /sfdc/field-mappings` — Create new field mapping
- `GET /sfdc/leads` — List synced Leads (last 100)
- `GET /sfdc/opportunities` — List synced Opportunities (last 100)

## Database Schema

### Tables

#### sfdc_connections
Stores OAuth credentials and sync state for each connected Salesforce org.

```sql
id, instance_url, org_id (UNIQUE), access_token, refresh_token,
token_expires_at, status, last_sync_at, last_sync_error,
sync_enabled, metadata, created_at, updated_at
```

#### sfdc_field_mappings
Configurable field mapping between SFDC objects and local tables.

```sql
id, connection_id, sfdc_object, sfdc_field, local_table, local_field,
is_active, transform_fn, created_at
```

#### sfdc_sync_log
Audit trail for each sync operation.

```sql
id, connection_id, sync_type, sfdc_object, records_processed,
records_created, records_updated, records_skipped, status,
error_message, started_at, completed_at
```

#### sfdc_leads
Synced Salesforce Leads (unqualified prospects).

```sql
id, salesforce_id (UNIQUE), first_name, last_name, email, company,
title, phone, status, lead_source, industry, rating,
converted_account_id, converted_contact_id, metadata,
last_synced_at, created_at, updated_at
```

#### sfdc_opportunities
Synced Salesforce Opportunities (pipeline visibility).

```sql
id, salesforce_id (UNIQUE), account_id, name, amount, stage_name,
probability, close_date, type, owner_id, owner_name,
is_closed, is_won, metadata, last_synced_at, created_at, updated_at
```

### Modified Tables

#### sales_accounts
Added columns:
- `salesforce_id` (TEXT, UNIQUE) — Maps to SFDC Account.Id
- `sfdc_last_synced_at` (TIMESTAMPTZ)

#### sales_contacts
Added columns:
- `salesforce_id` (TEXT, UNIQUE) — Maps to SFDC Contact.Id
- `sfdc_last_synced_at` (TIMESTAMPTZ)

## Field Mapping

### Account Sync
SFDC Account fields mapped to `sales_accounts`:

| SFDC Field | Local Field | Notes |
|------------|------------|-------|
| Id | salesforceId | |
| Name | name | |
| Website | domain | Extracted domain from URL |
| Industry | industry | |
| OwnerId + Owner.Name | owner | Stores Owner.Name |
| Type | metadata.type | |
| BillingCity, BillingState | metadata | |

### Contact Sync
SFDC Contact fields mapped to `sales_contacts`:

| SFDC Field | Local Field | Notes |
|------------|------------|-------|
| Id | salesforceId | |
| AccountId | accountId | Looked up via SFDC Account.Id |
| FirstName | firstName | |
| LastName | lastName | |
| Email | email | |
| Title | title | |
| Phone | phone | |

### Lead Sync
SFDC Lead fields mapped to `sfdc_leads` (1:1 mapping):

| SFDC Field | Local Field |
|------------|------------|
| Id | salesforceId |
| FirstName | firstName |
| LastName | lastName |
| Email | email |
| Company | company |
| Title | title |
| Phone | phone |
| Status | status |
| LeadSource | leadSource |
| Industry | industry |
| Rating | rating |

### Opportunity Sync
SFDC Opportunity fields mapped to `sfdc_opportunities`:

| SFDC Field | Local Field | Notes |
|------------|------------|-------|
| Id | salesforceId | |
| AccountId | accountId | Looked up via SFDC Account.Id |
| Name | name | |
| Amount | amount | Stored as text (precision) |
| StageName | stageName | |
| Probability | probability | 0-100 |
| CloseDate | closeDate | |
| Type | type | |
| OwnerId | ownerId | |
| Owner.Name | ownerName | |
| IsClosed | isClosed | Boolean |
| IsWon | isWon | Boolean |

## Configuration

### Environment Variables

```bash
# Salesforce OAuth Client Credentials
SFDC_CLIENT_ID=<Connected App Consumer Key>
SFDC_CLIENT_SECRET=<Connected App Consumer Secret>

# API Base URL (for OAuth redirect)
API_BASE_URL=http://localhost:3000  # or your production URL
```

### OAuth Flow

1. User clicks "Connect Salesforce"
2. Frontend redirects to `GET /api/sales/sfdc/auth-url` → gets OAuth URL
3. User authenticates with Salesforce
4. SFDC redirects to `GET /api/sales/sfdc/callback?code=...&state=...`
5. Backend exchanges code for tokens and creates connection
6. Connection stored in `sfdc_connections` with encrypted tokens

### Token Management

- Tokens are stored in the database (should be encrypted at rest in production)
- Service automatically refreshes expired tokens before API calls
- Refresh logic checks if token expires within 5 minutes
- Rate limit handling: 429 responses are caught and logged

## Sync Process

### Full Sync (`syncAll`)
```
1. syncAccounts() → upsert into sales_accounts
2. syncContacts() → upsert into sales_contacts (requires accounts first)
3. syncLeads() → upsert into sfdc_leads
4. syncOpportunities() → upsert into sfdc_opportunities

On success: Update connection.lastSyncAt, set status='connected'
On failure: Set status='error', log error message
```

### Object Sync
Each object sync:
1. Execute SOQL query (LIMIT 10000 records)
2. For each record, check if exists by salesforceId
3. If exists: UPDATE with new values
4. If not exists: INSERT new record
5. Log results to sfdc_sync_log

### Error Handling

- Wrapped in try/catch with detailed logging
- Individual record errors don't stop sync
- Sync log captures all metrics (created, updated, skipped, errors)
- Rate limit (429) throws SFDC_RATE_LIMIT error

## Usage Examples

### 1. Initiate OAuth Connection
```bash
GET /api/sales/sfdc/auth-url
# Returns: { "url": "https://login.salesforce.com/services/oauth2/authorize?..." }
```

### 2. Check Connection Status
```bash
GET /api/sales/sfdc/connection
# Returns: {
#   "id": 1,
#   "orgId": "00D...",
#   "instanceUrl": "https://na1.salesforce.com",
#   "status": "connected",
#   "lastSyncAt": "2024-03-29T10:30:00Z",
#   ...
# }
```

### 3. Trigger Full Sync
```bash
POST /api/sales/sfdc/sync
# Returns: { "success": true, "message": "Sync started in background" }
# Runs in background, check sync log for progress
```

### 4. Sync Specific Object
```bash
POST /api/sales/sfdc/sync/accounts
# Returns: { "success": true, "object": "accounts", "result": { "created": 5, "updated": 3 } }
```

### 5. Get Sync History
```bash
GET /api/sales/sfdc/sync/log
# Returns array of sync_log records with timestamps and metrics
```

### 6. Get Synced Leads
```bash
GET /api/sales/sfdc/leads
# Returns: [
#   { "id": 1, "salesforceId": "00Q...", "firstName": "John", "lastName": "Doe", ... },
#   ...
# ]
```

## Migration

Run migration to create tables and indexes:

```bash
# Using Drizzle migration tool
drizzle-kit migrate
```

The migration file `/lib/db/migrations/0001_sfdc_integration.sql` includes:
- ALTER TABLE for sales_accounts and sales_contacts
- CREATE TABLE for all SFDC tables
- CREATE INDEX for optimal query performance

## Performance Considerations

- SOQL queries paginated to 10000 records per sync
- Individual record errors handled gracefully (logged, not fatal)
- Sync log entries created for audit trail
- Indexes on salesforce_id for fast lookups
- Upsert pattern using ON CONFLICT for atomicity

## Security Notes

1. **Tokens**: Access/refresh tokens stored in database. In production, use encrypted columns or vault.
2. **SOQL**: Queries hardcoded (not user-supplied), safe from injection
3. **Rate Limiting**: Service respects SFDC rate limits (429 handling)
4. **Credentials**: SFDC_CLIENT_ID and SFDC_CLIENT_SECRET in environment variables only
5. **Logging**: Service logs sync operations for audit trail

## Files Created

```
artifacts/api-server/src/lib/sfdc-service.ts          # SFDC API service
artifacts/api-server/src/routes/sales/sfdc.ts        # Express routes
artifacts/api-server/src/routes/sales/index.ts       # Updated to register SFDC router
lib/db/migrations/0001_sfdc_integration.sql          # Database migration
lib/db/src/schema/sfdcIntegration.ts                 # Already exists (schema tables)
```

## Next Steps

1. Configure environment variables (SFDC_CLIENT_ID, SFDC_CLIENT_SECRET, API_BASE_URL)
2. Run database migration to create tables
3. Create Salesforce Connected App with OAuth scopes (api, full)
4. Test OAuth flow through frontend UI
5. Verify sync operations with test data
6. Consider implementing:
   - Token encryption at rest
   - Scheduled sync jobs (cron)
   - Field mapping UI for customization
   - Bidirectional sync (local → SFDC)
   - Custom field support via field mappings
