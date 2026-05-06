# CI sanity test page

Temporary file. Created 2026-05-06 to validate the new CI auto-sync workflow ([.github/workflows/sync-docs.yml](https://github.com/EBjornson/BPViewer/blob/main/.github/workflows/sync-docs.yml)) end-to-end. Will be deleted in the next push.

If you can read this on the rendered site, the BPViewer → viewer-docs CI sync is working. Whether it appears in the left nav is the separate "auto-nav-from-filesystem" question — by default it should NOT, since `mkdocs.yml`'s `nav:` is explicit and doesn't list this file.
