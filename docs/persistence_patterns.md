# Persistence Patterns for CustomApps

**Primary reader:** CustomApp developer building beyond DemoApp's localStorage-only model
**Job-to-be-done:** Decide how to persist projects, captures, user-uploaded models, and photos in a real CustomApp
**Next doc:** [Integration Guide](integration.md) for the contract surface · [DemoApp](demoapp.md) for the localStorage reference pattern

---

## Why DemoApp's localStorage pattern doesn't generalize

DemoApp persists capture metadata to `localStorage` keyed by model ID (`demoapp_v3_${modelId}`). This works for the demo because:

- Manifest models live in `public/models/` and are loaded by URL (no upload needed)
- Captures (poses, presentation snapshots, visibility lists) are small JSON — kilobytes
- Per-model snapshots fit comfortably in browser quotas (~5MB per origin in most browsers)

A real CustomApp typically has different needs:

- **User-uploaded models** that must survive page reloads. A typical `.glb` is multi-MB to multi-tens-of-MB; localStorage's ~5MB cap chokes on the first upload.
- **Photos / images per section** (the TestPoint pattern). Even compressed JPEGs eat the quota fast.
- **Cross-device sync** so a user can open their work on another machine — localStorage is per-browser.
- **Sharing with end users** — read-only links emailed to customers/clients require server-side state.

Any one of these breaks the localStorage-only pattern.

## Recommended shape: storage abstraction

Whatever backend you pick, **wrap it in a small interface** so you can swap implementations without touching consumers. This is the single most important pattern — start with it on day one even if v0.1 uses localStorage or IndexedDB. v0.2's swap to a backend then touches one file.

```js
// storage.js — interface, swap implementations under it
export async function getProject(id)         { /* impl */ }
export async function listProjects()         { /* impl */ }
export async function saveProject(project)   { /* impl */ }
export async function deleteProject(id)      { /* impl */ }
export async function uploadBlob(blob, name) { /* returns a stable URL or ID */ }
export async function fetchBlob(idOrUrl)     { /* returns Blob */ }
```

Consumers (`<App>`, `<ProjectView>`, etc.) `await` these without caring whether the impl is IndexedDB, OPFS, Supabase, S3, or Firebase. The Viewer doesn't care either — it just receives a `modelUrl` (which can be a `blob:` URL from `URL.createObjectURL(fetchedBlob)` for local impls, or an HTTPS URL for server-side impls).

### Previewing generated blobs in-app — React 19 StrictMode trap

If your CustomApp lets users preview a generated blob (a PDF report, screenshot bundle, image export) before saving, watch out for a blob-URL lifecycle bug that's specific to **React 19 StrictMode** (the default in fresh `create vite` scaffolds). The natural React pattern — `useMemo(() => URL.createObjectURL(blob), [blob])` paired with a `useEffect` cleanup that revokes — quietly fails in dev mode: StrictMode double-invocation runs the cleanup once *between* the first setup and the second, silently revoking the URL while the iframe is still rendering from it. The iframe survives (it already has the blob bytes in memory), so the preview *looks* fine. But a subsequent `<a href={url} download>.click()` on the same URL navigates to the now-revoked URL, and Chrome surfaces this as **"Check Internet Connection"** with nothing useful in the console. The first encounter typically costs 30–60 minutes of chasing wrong leads (cache, CORS, the bundle's network requests).

**Safe pattern** — two parts:

1. **Create the iframe URL inside an effect, not a memo.** Store it via `useState`; the effect's cleanup then fires only on real unmount, not on StrictMode's dev-mode double-invoke.
   ```jsx
   const [previewUrl, setPreviewUrl] = useState(null)
   useEffect(() => {
     if (!blob) return
     const url = URL.createObjectURL(blob)
     setPreviewUrl(url)
     return () => URL.revokeObjectURL(url)
   }, [blob])
   // <iframe src={previewUrl} />
   ```

2. **Mint a separate blob URL on each download click**, revoked after a short `setTimeout`. Isolates the download URL from the iframe URL's lifecycle entirely.
   ```jsx
   function handleDownload() {
     const url = URL.createObjectURL(blob)
     const a = document.createElement('a')
     a.href = url
     a.download = filename
     a.click()
     setTimeout(() => URL.revokeObjectURL(url), 1000)
   }
   ```

Production builds are unaffected — StrictMode double-invocation is dev-only — so the bug only surfaces during local verification. Adopt the safe pattern from day one and the dev/prod parity issue never arises.

## Three viable backends

### 1. IndexedDB (recommended for local-first POCs)

The browser's structured storage. Quota is much larger (typically 50% of free disk) and supports binary blobs natively. The raw API is verbose; **`idb-keyval`** wraps it in a `localStorage`-like key/value API.

```js
import { get, set, del, keys } from 'idb-keyval'

export async function getProject(id) {
  return get(`project:${id}`)
}
export async function saveProject(project) {
  await set(`project:${project.id}`, project)
}
export async function uploadBlob(blob, name) {
  const id = crypto.randomUUID()
  await set(`blob:${id}`, blob)
  return id  // consumers fetchBlob(id) → URL.createObjectURL(blob)
}
export async function fetchBlob(id) {
  return get(`blob:${id}`)  // returns Blob; caller decides createObjectURL or arrayBuffer
}
```

**Use for**: v0.1 POCs, single-user local apps, or as the offline-cache layer in front of a server-side backend.
**Don't use for**: cross-device sync, sharing with end users.

### 2. Origin Private File System (OPFS)

A newer browser API (Chrome 102+, Safari 15.2+, Firefox 111+) for storing actual files origin-private. Higher quotas than IndexedDB on some platforms; native file handles for streaming reads/writes. No library required — but the API is verbose, and the ecosystem is less mature than IDB. Worth considering if you need to handle very large `.glb` files (~100MB+) or want a file-tree mental model.

```js
const root = await navigator.storage.getDirectory()
const fileHandle = await root.getFileHandle('project.json', { create: true })
const writable = await fileHandle.createWritable()
await writable.write(JSON.stringify(project))
await writable.close()
```

**Use for**: very-large-blob storage (multi-hundred MB), apps that benefit from a file-tree model.
**Don't use for**: anything that needs cross-device or sharing — same limitation as IDB.

### 3. Server-side (Supabase / Firebase / S3 + auth)

When you need cross-device sync, multi-user access, or sharing with end users, you need a server. Two clean shapes:

**Supabase (recommended for solo/small-team CustomApps):** Postgres for project metadata, Storage for blobs, Auth for users, Edge Functions if you need server-side logic. Single vendor, generous free tier.

```js
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(URL, ANON_KEY)

export async function saveProject(project) {
  const { error } = await supabase.from('projects').upsert(project)
  if (error) throw error
}
export async function uploadBlob(blob, name) {
  const path = `${crypto.randomUUID()}-${name}`
  const { error } = await supabase.storage.from('user-uploads').upload(path, blob)
  if (error) throw error
  const { data } = supabase.storage.from('user-uploads').getPublicUrl(path)
  return data.publicUrl  // consumers: pass directly to viewerInput.model.modelUrl
}
```

**Firebase**: similar shape (Firestore + Storage + Auth). Best-in-class auth integration with Google ecosystem.

**S3 + your own API**: more flexible, more setup. Worth it only when you've outgrown the BaaS options.

## Sharing patterns

When end users (customers, reviewers) need read-only access to a CustomApp's project without an account:

| Pattern | How | When |
|---|---|---|
| **Public URL with unguessable UUID** (recommended for POCs) | Project ID is `crypto.randomUUID()`; share URL is `app.com/share/<id>`; backend exposes a read-only fetch by ID | Magic-link-equivalent; no end-user auth needed; trade-off is anyone with the URL can view |
| **Magic-link auth for end users** | Email magic-link mints a short-lived session token scoped to one project | Stronger access control; requires email infrastructure |
| **Tenant accounts** | End users sign in to your app | When you need per-user state for the end users themselves |

The unguessable-UUID pattern is the sweet spot for a "send a link to a customer by email" workflow. Combine with Supabase row-level security (RLS): the public-share path uses an anon-role policy that allows `SELECT` only when the project's `is_public_shared = true` flag is set; the project owner toggles that flag when they generate the share link.

### Storage RLS for shared private-bucket reads — `SECURITY DEFINER` pattern

The above is straightforward when the share-flag check is on the **same** table the policy targets. It gets subtle when the flag lives in a **different** table than `storage.objects` — typical for blobs (model files, photos, generated reports) stored under a private bucket where the owning project's `is_public_shared` flag lives in a sibling Postgres table.

The natural Postgres RLS for the storage bucket reads cleanly:

```sql
-- DON'T USE — silently fails for anon callers
create policy "user_uploads_select_shared" on storage.objects
  for select using (
    bucket_id = 'user-uploads'
    and exists (
      select 1 from public.projects p
      where p.id::text = (storage.foldername(name))[2]
        and p.is_public_shared = true
    )
  );
```

**It looks right and silently doesn't work.** Supabase Storage's `createSignedUrl` endpoint returns `StorageApiError: Object not found` (HTTP 400) for shared paths — same error you'd get for a non-existent file or a true permission denial. Nothing distinguishes "object missing" from "RLS evaluated false" from "subquery couldn't resolve under the anon role." The same anon caller can `SELECT` the project row directly via a symmetrically-shaped `projects_select_shared` policy on `public.projects`, so you'd expect the `exists()` to evaluate consistently. It doesn't — appears to be an RLS-in-RLS evaluation quirk specific to how the Storage API path executes the policy under the anon role.

**Safe pattern**: extract the cross-table lookup into a `SECURITY DEFINER` helper function and call it from the policy. The function bypasses RLS on the inner read but only returns a boolean, so nothing sensitive leaks (the "is this project shared" fact is implicit in the share link existing).

```sql
create or replace function public.is_project_publicly_shared(project_uuid uuid)
  returns boolean
  language sql
  security definer
  set search_path = public
  stable
as $$
  select coalesce(
    (select is_public_shared from public.projects where id = project_uuid),
    false
  );
$$;
revoke execute on function public.is_project_publicly_shared(uuid) from public;
grant  execute on function public.is_project_publicly_shared(uuid) to anon, authenticated;

create policy "user_uploads_select_shared" on storage.objects
  for select using (
    bucket_id = 'user-uploads'
    and public.is_project_publicly_shared(
      ((storage.foldername(name))[2])::uuid
    )
  );
```

Storage RLS now consistently allows anon `SELECT` for shared paths. The `SECURITY DEFINER` sidestep is a well-known Postgres pattern for cross-table RLS but invisible to a first-time Supabase adopter; the failure mode (`Object not found` instead of "permission denied" or "RLS rejected") provides no diagnostic breadcrumb.

## Migrating from localStorage (DemoApp pattern → real backend)

If you start with DemoApp's localStorage pattern and later swap to Supabase or similar:

1. **Wrap localStorage behind the storage interface above** on day one. Easy to do retroactively but easier upfront.
2. **First-auth migration**: when a user first signs in, scan localStorage for any `demoapp_v3_*` keys (or whatever your prefix is), upload each to the backend, mark localStorage as migrated. After that, the backend is canonical and localStorage becomes a stale-cache fallback.
3. **Don't try to support both stores indefinitely** — pick a canonical source and treat the other as cache.

## Glossary

See [Overview](overview.md#glossary) for the canonical glossary.
