# Sparez

Sparez is a mobile-first spare-parts catalogue and laydown-yard management application for Valeron. It captures photographed parts quickly in the field, makes them searchable, records auditable stock removals, and exports a client-owned Excel register.

## What is included

- Supabase email/password authentication with invitation-only access
- Organisation memberships with `admin` and `user` roles
- Mobile camera capture, multi-photo previews, private Storage uploads and ordered photo metadata
- Dashboard totals and recent activity
- Responsive catalogue: mobile cards and desktop table
- Search across WO number, material number, description and location
- Item detail, admin editing, soft archiving and movement history
- Partial-quantity removals and manual removal for unquantified items
- Admin-only auditable reversal of movements
- Admin invitation/access management and organisation settings
- Complete `.xlsx` export with formatting and time-limited photo hyperlinks
- Tenant-aware PostgreSQL schema, indexes, RLS policies, Storage policies and security-definer transaction functions

## Local setup

Requirements: Node.js 20.9 or newer, a Supabase project, and the Supabase CLI if applying migrations locally.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and supply:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

   The service-role key is used only by the server-side admin invitation action. Never expose it with a `NEXT_PUBLIC_` prefix.

3. Apply [the initial migration](supabase/migrations/20260824000000_initial_sparez.sql) through the Supabase SQL editor or CLI:

   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   ```

4. In Supabase Authentication, set the Site URL to the deployed application URL and add these redirect URLs:

   - `http://localhost:3000/auth/callback`
   - `https://your-production-domain/auth/callback`

5. Bootstrap the first administrator. Create that user in Supabase Authentication, then run this in the SQL editor with the real user UUID:

   ```sql
   insert into public.profiles (id, full_name, email)
   select id, coalesce(raw_user_meta_data ->> 'full_name', split_part(email, '@', 1)), email
   from auth.users where id = 'YOUR_USER_UUID'
   on conflict (id) do nothing;

   with new_org as (
     insert into public.organisations (name, slug)
     values ('Your Organisation', 'your-organisation')
     returning id
   )
   insert into public.memberships (organisation_id, user_id, role)
   select id, 'YOUR_USER_UUID', 'admin' from new_org;
   ```

6. Optionally edit the UUID in [the seed file](supabase/seed.sql), then run it to insert the three realistic demonstration parts.

7. Start the application:

   ```bash
   npm run dev
   ```

## Database and security design

Operational tables are `items`, `item_photos`, and `item_movements`; each has a mandatory `organisation_id`. Supporting tables are `organisations`, `profiles`, and `memberships`.

RLS enforcement includes:

- Members can select only rows associated with an active membership in the row's organisation.
- Both roles can create items and photo metadata for their own organisation.
- Only admins can update/archive item master records, update organisation settings, or change membership access.
- Direct movement inserts/updates are not granted. `remove_item_stock` locks the item, recomputes active removals, prevents over-removal and writes the audit record atomically.
- `reverse_item_movement` is admin-gated and marks the original record reversed without deleting history.
- Profile visibility is limited to colleagues who share an organisation.
- The `item-photos` bucket is private. Storage paths begin with `organisation_id`, and Storage RLS checks that segment against active membership.
- Item creation is centralised in `create_item`, allowing the minimum-information rule to safely support photo-only records after the object upload.

Important ownership and tenant fields are protected by triggers. Items use soft archive; movement records are never deleted by the application.

## Routes

| Route | Access | Purpose |
| --- | --- | --- |
| `/login` | Public | Invited-user sign in |
| `/dashboard` | Member | Summary and recently added parts |
| `/parts` | Member | Searchable responsive register |
| `/parts/new` | Member | Field-first photo and part capture |
| `/parts/[id]` | Member | Detail, gallery and removals |
| `/parts/[id]/edit` | Admin | Edit master data |
| `/export` | Admin | Complete Excel export |
| `/users` | Admin | Invitations, roles and access |
| `/settings` | Admin | Organisation settings |

## Production configuration

- Configure SMTP in Supabase Auth so invitation emails are reliable and branded.
- Supabase's default SMTP only delivers to members of the Supabase organisation. Configure custom SMTP before inviting arbitrary email addresses.
- Set `NEXT_PUBLIC_APP_URL` to the public production domain, and do not protect that production domain with Vercel Authentication. Protected preview/deployment URLs are restricted to Vercel organisation members.
- To prevent corporate email scanners from consuming one-time invitation links, set the Supabase **Invite user** email template button URL to `{{ .SiteURL }}/accept-invite?token_hash={{ .TokenHash }}&type=invite`. The acceptance page verifies the token only after the recipient presses its button.
- Set the Supabase **Reset password** email template button URL to `{{ .SiteURL }}/accept-invite?token_hash={{ .TokenHash }}&type=recovery`. Existing Auth users receive this setup link when an administrator restores their organisation access.
- Keep leaked-password protection enabled and choose an appropriate password policy.
- Add the production callback URL to the Auth redirect allow-list.
- Store `SUPABASE_SERVICE_ROLE_KEY` only in server-side deployment secrets.
- Apply the migration before first deployment. It creates the private bucket and its policies.
- Configure platform request/body limits if field teams routinely upload images near the 15 MB per-file bucket limit.

### Daily emailed export

Vercel calls `/api/cron/daily-export` every day at `09:00 UTC`, which is `17:00 AWST`. The endpoint generates the same Excel workbook as the manual admin export and sends it as an attachment through Resend.

Configure these production environment variables in Vercel:

- `RESEND_API_KEY`: a Resend API key permitted to send email.
- `RESEND_FROM_EMAIL`: a sender on a verified Resend domain, such as `Sparez <no-reply@example.com>`.
- `CRON_SECRET`: a random value at least 16 characters long; Vercel includes it as the cron request bearer token.
- `DAILY_EXPORT_EMAIL`: defaults to `philippe.isard@greatland.com.au` when omitted.
- `DAILY_EXPORT_ORGANISATION_ID`: optional while the database has exactly one organisation, but required if more organisations are added.

## Known MVP limitations

- The schema supports multiple organisation memberships, but the UI currently opens the first active membership; an organisation switcher is the next multi-client enhancement.
- Register queries are capped at 250 records pending cursor pagination. Search is server-side within that result query.
- Item photos can be arranged/removed before initial save; post-save photo management is not yet exposed in the admin edit form.
- Excel photo URLs are signed for seven days because the Storage bucket is private. This keeps tenant isolation intact but means the links are not permanent archives.
- Invitations rely on Supabase's configured email provider and redirect allow-list.
- The included seed records do not include stock photography; real field images are expected through the capture workflow.
- No live Supabase project credentials are committed, so end-to-end Auth/RLS/Storage checks must be run against the target project after configuration.

## Verification

```bash
npm run typecheck
npm run lint
npm run build
```

The project uses strict TypeScript and currently installs with no reported npm audit vulnerabilities.

## Login troubleshooting

If a local browser previously stored several chunked Supabase sessions for `localhost`, it may show HTTP 431 before application code can run. Clear cookies/site data for the local Sparez origin once, restart the dev server and sign in again. Sparez uses its own `sparez-auth` cookie namespace and clears stale cookies for the configured Supabase project during future sign-ins.
