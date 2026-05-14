# Pre-deployment checklist (template)

Generic pre-launch items for a Vite + React + Supabase CustomApp consuming the Viewer bundle. **Copy into your repo and adapt.** Your CustomApp will almost certainly need additional items not listed here — domain-specific smoke tests, third-party integrations, customer-data handling specific to your business. Extend; don't treat the list as exhaustive.

## Auth & sign-in

- [ ] **Custom SMTP configured.** Supabase's default shared SMTP rate-limits magic-link sends to ~3-4 per hour project-wide — fine for dev, fatal in production. Configure Resend, SendGrid, Mailgun, or Postmark in **Supabase Dashboard → Project Settings → Auth → SMTP Settings**. Free tier of any of those covers small-business volume.
- [ ] **Email templates branded.** Default magic-link emails look generic (`noreply@mail.supabase.io` → many spam folders). In **Auth → Email Templates**, customize the "Magic Link" template with your CustomApp's branding and a clear sender name.
- [ ] **Auth → URL Configuration** updated for the production domain. Site URL → `https://<your-prod-domain>`; Redirect URLs whitelist includes `https://<your-prod-domain>/**`. Remove localhost entries if you don't want dev sign-in pointing at prod.

## Supabase project

- [ ] **All SQL migrations applied** to the production Supabase project (which may be a fresh project distinct from dev), in order. Each migration's verification SELECT at the bottom confirms the policies + columns landed.
- [ ] **RLS audit.** Walk every table's policies and confirm they match your intended access model. Multi-tenant apps need tenant-scoping; single-tenant apps with team-shared data need authenticated-user-sees-all; per-user-private apps need owner-only. The default Supabase policies (none — RLS off) are wide-open; explicit policies are the gate.
- [ ] **Backup policy reviewed.** Supabase free tier includes daily point-in-time recovery for ~7 days. For real customer data, consider a paid plan with longer retention. **User-uploaded blobs in Storage are NOT covered by PITR** — set up periodic Storage exports if losing those would matter.
- [ ] **Storage CORS** verified for the production domain. Test that signed URLs load from your production origin without browser CORS errors.

## Hosting & domain

- [ ] **Production hosting picked.** A Vite static bundle deploys cleanly to Vercel, Netlify, Cloudflare Pages, or any static host. Pick one, point it at the GitHub repo for auto-deploy on push to `main`.
- [ ] **Environment variables set in the hosting platform**: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Same shape as `.env.local`, but configured in the hosting platform's env-vars UI (NOT committed). The values should point at the **production** Supabase project, not dev. **Use the publishable / anon key only** — `sb_secret_*` (service_role) bypasses RLS and must never ship to the client.
- [ ] **Domain + SSL.** Point your domain at the hosting service. SSL is automatic with every major host.
- [ ] **Share-link URL matches production.** If your App generates share/invite links, they typically use `window.location.origin` — works automatically once the production domain is live, but verify by generating a link from prod and opening it in a clean browser.

## Code & runtime

- [ ] **Viewer bundle pinning decision.** Currently pinned at `https://cdn.jsdelivr.net/gh/EBjornson/viewer-dist@v1/viewer.js` (the major-version float — auto-upgrades on patch/minor). For maximum production stability, pin to a specific `@v1.X.Y` in your entry-point. Trade-off: pinned = no automatic improvements but no surprise regressions; float = inherit fixes but also inherit changes. `@v1` is API-stable per the Viewer's versioning, so the float is usually safe.
- [ ] **Dev fixtures removed** (or kept intentionally). Test models, sample data, debug routes — anything that exists for dev convenience but shouldn't ship. Check `public/` and any feature-flagged debug UI.
- [ ] **Production build smoke test.** `npm run build && npm run preview`, then walk through the full session manually (sign-in, create entity, capture state, exercise sharing, exercise reports, etc.). Production behaves differently from dev: no React StrictMode double-invocation, different bundle structure, different timing — catch regressions before customers do.

## Quality & ops

- [ ] **Error tracking** considered. Production errors land in customer browsers and you never see them by default. Sentry's free tier (or similar) covers small volume and is a one-line install. Genuinely useful when a customer reports "it broke" with no other detail.
- [ ] **External-network test of any share flow.** Generate a share link on production, open it on a phone over cellular (not your home Wi-Fi). Confirm everything loads. Catches CORS, signed-URL TTL, and bandwidth issues invisible on localhost.
- [ ] **Privacy / terms of service** in place if you're storing customer data (you almost certainly are — emails, uploaded files, user-generated content). Out of scope for this technical checklist, but worth flagging to a lawyer or boilerplate generator before going live.

## Your CustomApp's additions

(Replace this section with items specific to your business — domain workflows to verify, third-party integrations to test, customer-communication channels to confirm, etc.)

- [ ] **(Add your own items here.)**
