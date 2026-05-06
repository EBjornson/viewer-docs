# Docs Publishing System

**Primary reader:** Eric (this doc is hidden from the sidebar via `not_in_nav:` and only reachable by URL).
**Job-to-be-done:** Refresher on how a doc edit becomes the live site, and the most common authoring tasks.
**See also:** [CLAUDE.md "Public docs mirror"](https://github.com/EBjornson/BPViewer/blob/main/CLAUDE.md) for the dense architectural digest used by Claude sessions.

## What this is

Two repos collaborate to publish the docs:

- **BPViewer** (this repo, private) holds the source-of-truth docs in `/docs/`, plus the integration-kit source files and the sync tooling.
- **viewer-docs** (public, <https://github.com/EBjornson/viewer-docs>) is the rendered-site mirror — a pure mkdocs-material build target. The published site is <https://ebjornson.github.io/viewer-docs/>.

You edit a doc in BPViewer, push to main, and ~30–60 seconds later the change is live. No manual sync, no manual deploy.

## The flow

```
BPViewer/main                  Sync workflow                     viewer-docs/main
       │                              │                                 │
   [git push]                         │                                 │
       │ ──────────────────────────► [paths filter matches              │
       │                              docs/**, docs/.pages, an          │
       │                              integration-kit source, the       │
       │                              sync script, or the workflow]     │
       │                              │                                 │
       │                              ├─► checkout BPViewer             │
       │                              ├─► checkout viewer-docs          │
       │                              │   (using VIEWER_DOCS_TOKEN)     │
       │                              ├─► node sync-viewer-docs.mjs     │
       │                              │   (wipe + recopy + link rewrite)│
       │                              └─► git push ─────────────────►   │
       │                                                                ├─► deploy-docs.yml fires
       │                                                                ├─► pip install
       │                                                                ├─► mkdocs gh-deploy --force
       │                                                                └─► GitHub Pages serves the site
```

If your push only touched files outside the path filter (e.g. just `src/viewer/...` code), CI doesn't fire and nothing happens. That's intended — keeps the docs CI quiet on code-only commits.

## Common authoring tasks

| You want to… | Do this |
| --- | --- |
| **Add a new doc** | Create `docs/<filename>.md` with `# Title` as the H1. The H1 is the sidebar label. New docs auto-appear at the bottom of the sidebar via the `- ...` rest placeholder in `.pages`. |
| **Slot a new doc into a curated group** | Edit `docs/.pages` to list the filename inside the desired group (Integration / Internals / Authoring / Reference). |
| **Change a doc's sidebar label** | Edit the doc's `# H1` — that's the source of truth (convention: H1 = sidebar label). |
| **Override a sidebar label** (when the H1 must intentionally differ) | In `docs/.pages`, use `Sidebar Label: filename.md` for that entry. Reserved escape hatch — keep `.pages` minimal. |
| **Hide a doc from the sidebar but keep it deployed** | Add `<filename>.md` to the `not_in_nav: \|` block in `docs/.pages`. The page still builds and is reachable at its URL. (This doc itself is an example.) |
| **Remove a doc** | `git rm docs/<filename>.md` and remove any explicit reference from `.pages`. Sync deletes it from the mirror; deploy removes it from the site. The URL 404s. |
| **Rename a doc** (URL change) | Rename the file, update any reference in `.pages`, and add a `redirect_maps:` entry to viewer-docs's `mkdocs.yml` so the old URL keeps working. |
| **Preview before pushing** | `npm run sync-docs -- --no-push` syncs your working tree to your local clone of viewer-docs without pushing. Then `mkdocs serve` in the viewer-docs clone for a live local render. |
| **Trigger a manual sync** (recover from CI failure) | Either `npm run sync-docs` from BPViewer, or re-run via `workflow_dispatch` from the Actions tab of either repo. |

## Files involved

```
BPViewer (this repo, private)
├── docs/
│   ├── .pages                          sidebar nav source-of-truth
│   ├── stylesheets/extra.css           site-wide CSS (synced through)
│   └── *.md                            the docs themselves
├── scripts/sync-viewer-docs.mjs        sync logic
└── .github/workflows/sync-docs.yml     CI trigger (paths-filtered)

viewer-docs (public mirror)
├── docs/                               synced from BPViewer; don't edit here
├── integration-kit/                    synced from BPViewer; don't edit here
├── mkdocs.yml                          build/theme/plugins config
└── .github/workflows/deploy-docs.yml   deploys to GitHub Pages on push

Repo secret (BPViewer side)
└── VIEWER_DOCS_TOKEN                   fine-grained PAT scoped to viewer-docs only,
                                        Contents: Read & Write
```

## One-time setup (already complete; here for credential-rotation reference)

The system was set up on 2026-05-06. If credentials ever need rotating:

**`VIEWER_DOCS_TOKEN` rotation:**

1. Visit <https://github.com/settings/personal-access-tokens/new> (fine-grained PAT, not classic).
2. Resource owner: `EBjornson`. Repository access: **Only select repositories** → `EBjornson/viewer-docs`. Permissions: **Contents: Read and write** (Metadata: Read auto-granted).
3. Set expiration as desired. Generate, copy.
4. Update the secret at <https://github.com/EBjornson/BPViewer/settings/secrets/actions>: edit `VIEWER_DOCS_TOKEN`, paste new value, save.

**macOS Keychain PAT (used for HTTPS pushes from this machine):**

This PAT needs the `workflow` scope so `.github/workflows/*.yml` edits can be pushed locally. To regenerate: <https://github.com/settings/tokens>, regenerate the existing PAT with `workflow` checked, then update the macOS Keychain `github.com` Internet-password entry with the new value.

## Recovery / failure modes

**Sync workflow fails in BPViewer.** Check the Actions tab there. Common causes: `VIEWER_DOCS_TOKEN` expired or insufficient scope (rotate per above); viewer-docs branch protection rejecting the push (rare).

**Deploy workflow fails in viewer-docs.** Check the Actions tab there. Common causes: malformed Markdown or a broken link erroring the mkdocs build; plugin failure (rare — `awesome-pages` and `redirects` are stable).

**Both succeed but the site doesn't update.** Likely GitHub Pages CDN cache — wait a minute, hard-refresh, or check the `gh-pages` branch in viewer-docs to confirm the new build artifact landed.

**You need to ship now and CI is broken.** `npm run sync-docs` from BPViewer with a local clone of viewer-docs at `/Users/eric/viewer-docs` bypasses CI entirely.
