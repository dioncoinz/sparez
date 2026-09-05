# Sparez register upgrade

## Completed locally

- Shunter's local `C:/Dev/shunter/src/app/globals.css` informed the orange/black product treatment. Shared Tailwind tokens and CSS variables now supply the warm canvas, white surfaces, orange actions and accessible dark accent text. Existing installed sans-serif fonts are retained; no external font requests were added.
- `/parts` uses server-side search, 50-row pagination, deterministic sorting and column filters. Search includes all timestamped and legacy notes and treats SQL wildcard characters as literal text. Location and creator options come from organisation-scoped database queries.
- Register state uses URL parameters: `q`, `material`, `description`, `wo`, `location`, `condition`, `status`, `creator`, `notes`, `min`, `max`, `from`, `to`, `sort`, `direction`, `page`; `part` opens the selected record. Native history navigation keeps the register mounted. Saving updates its loaded row without sorting it away or resetting scroll. Reapplying filters reloads the matching result set.
- The same detail component provides the desktop drawer, mobile sheet and direct part page. Existing admin edits/archive and stock removal/reversal remain available. Native dialogs have explicit keyboard boundaries, nested Escape handling and focus restoration.
- Primary photos support a lightbox, zoom/reset, drag pan and pinch zoom. Additional photos, mobile camera capture and private uploads are retained.
- Notes are append-only and show author/time newest-first. Legacy note text is retained in both its original field and the backfilled history; the UI labels its actual note date unknown. Recent dashboard entries show a two-line latest-note preview. Excel includes the full Note History worksheet.
- Duplicate checking uses trimmed, case-insensitive material numbers and normalized description trigrams (minimum eight normalized characters; similarity at least 0.65). At most ten ranked candidates are returned. Users can preview, cancel, explicitly continue as new, or add stock.
- Final creation checks run inside an organisation-serialized transaction. Stock additions lock the item and atomically update its quantity plus insert an immutable audit row. Unquantified records require an administrator to establish a quantity before stock can be added.
- Stale master edits are rejected using `updated_at`; quantity changes cannot invalidate active removal history. Blank quantities now remain unquantified.

## Migration

`supabase/migrations/20260906000000_register_workflow.sql`

This adds `item_notes`, `item_stock_additions`, indexes, RLS policies and member-scoped RPCs. It backfills existing notes without deleting or replacing their source field. It enables `pg_trgm` in Supabase's `extensions` schema. It retains the original photo creation transaction as a private helper and replaces its public entry point with duplicate-aware creation. Direct item insertion is revoked so callers cannot bypass the checked RPC. Direct note/audit writes are not granted.

After explicit user approval, migration `20260906000000` was applied to the connected Supabase project on 6 September 2026. Remote migration history matches the local files. Live read-only verification confirmed that the new relationships resolve, all 279 items remain available, and all 101 nonempty legacy notes have exact preserved history entries. Anonymous access to the new tables and functions is denied as intended. No application deployment or remote repository push was performed.

## Deployment steps for the operator

1. Verify backups and test this migration against a staging copy first. Confirm the target schema matches the initial migration and `pg_trgm` is either absent or installed in `extensions`. The migration stops with an explanation if it is installed elsewhere; do not move a shared extension without reviewing its other consumers.
2. Run both admin and standard-user smoke checks on staging, including a second organisation. Check Auth/session cookies, private photo upload/signing, Excel download and daily export using the staging configuration.
3. Use a short coordinated maintenance window for the database migration and application release. The new app requires the migration. The old app's overwrite-style note editor will be rejected after it, and old creation forms cannot resolve a duplicate warning. Existing `create_item` callers with the old argument set otherwise remain compatible through the new optional argument.
4. Apply the single new migration through the established Supabase migration process, then deploy the application and verify the PostgREST schema cache has reloaded. No new environment variables, storage buckets or Auth settings are needed.
5. Verify concurrent additions and concurrent duplicate-looking creations using **separate PostgreSQL connections** in staging. The SQL uses row locks and a transaction-scoped advisory lock respectively; the local embedded database runs statements on one connection and cannot reproduce true multi-session scheduling.
6. Verify notes, duplicate confirmation, additions, normal removals/reversal, filters, back/forward navigation and mobile photo capture before reopening access. If rollback is necessary, keep the new data tables and history; use a forward fix rather than deleting the migration's data.

Index creation and note backfill occur in one transaction and can briefly block writes on a large catalogue. Measure this against a staging copy before scheduling the production window.

## Verification

The untouched baseline passed lint, TypeScript and production build. No prior automated tests existed.

Run locally:

```text
npm run lint
npm run typecheck
npm test
npm run test:ui
npm run build
```

The database suite runs both real migration files unchanged in PGlite with minimal Supabase platform-schema fixtures. It exercises admin/user permissions, inactive membership, tenant isolation, legacy preservation, note validation, all filters, sorting/pagination, duplicate decisions, stock audit rollback, and existing removal/reversal. Separate tests cover URL validation, blank quantities and complete Excel note export.

The browser suite renders the actual application components in a local fixture harness with mocked services and synthetic records. It checks desktop/tablet/mobile layouts, editing and row refresh, pagination/scroll preservation, back/forward, nested dialog focus/Escape, zoom/pan/pinch, notes and all duplicate actions. It uses installed Microsoft Edge; install Edge or change the Playwright browser channel in `tests/ui/run.mjs` on another platform. Test scripts require Node 22+; this workspace uses Node 24.

Screenshots are generated in `test-results/screenshots/`: dashboard, register, detail drawer, duplicate warning, mobile register/detail and tablet register. They are explicitly synthetic-data previews, not screenshots of a live client account.

## Assumptions and remaining operational checks

- AWST (`Australia/Perth`) follows the existing dashboard greeting and export date convention. Note timestamps and date-filter boundaries use it consistently.
- Both existing roles may add notes and stock; only admins edit/archive master records and reverse removals.
- Existing first-active-organisation selection is retained. An organisation switcher remains outside this work.
- No live Supabase or physical-device checks were run. Staging Auth/Storage, independent-connection concurrency, actual iOS/Android camera behavior and production-scale query timing remain required rollout checks. Docker was unavailable locally, so database verification used embedded PostgreSQL.
- Location/creator selectors load distinct options, not entire item records. Consider remote autocomplete if a tenant grows to thousands of distinct locations.

References consulted for local verification: [PGlite extensions](https://pglite.dev/extensions/) and [PostgreSQL trigram matching](https://www.postgresql.org/docs/17/pgtrgm.html).
