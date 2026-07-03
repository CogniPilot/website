# CogniPilot Website

Marketing site for the CogniPilot Foundation: the open, secure, and concise flight
stack for provably safe autonomy.

**Live site:** <https://cognipilot.github.io/website/>

## How it works

The published landing page is a single self-contained file, `site/index.html`,
with all styles, scripts, fonts, and imagery inlined. Blog pages under
`site/blog/` are normal static HTML and may load exact-version browser packages
from npm-backed CDNs for interactive examples. Every push to `main`
publishes the contents of `site/` to GitHub Pages via
`.github/workflows/deploy.yml`. The workflow validates the static site and
interactive example pins before the Pages artifact is uploaded, so a failing
check prevents publication.

## Repository layout

```
CogniPilot.dc.html    design source (edited with the dc tool)
support.js            runtime used by the design source while editing
assets/               logo art
site/index.html       compiled, self-contained site (this is what gets published)
site/blog/            static blog index, posts, assets, and example manifests
site/.nojekyll        tells GitHub Pages to serve files as-is
.github/workflows/    Pages deploy workflow
```

## Preview locally

Use a local HTTP server for blog examples; module and WebAssembly imports will
not work reliably from `file://`.

```bash
python3 -m http.server -d site 8080
# or: npx serve site
```

Interactive blog examples should pin exact npm package versions in a per-post
manifest rather than using `latest`. This keeps old posts reproducible without
checking old runtime builds into the repository. Include the npm tarball
integrity/shasum in the manifest when the example is meant to be archival.
When a post mirrors a Rumoca user-guide example, keep the widget runner and
example source aligned with the guide instead of rebuilding a blog-specific
approximation.

Run the same validation that gates GitHub Pages locally with:

```bash
node --check site/blog/rumoca-guide-widget.js
node --check site/blog/rumoca-live.js
node scripts/validate-site.mjs
```

## Editing

`CogniPilot.dc.html` is the design source, and `site/index.html` is compiled
from it with the dc bundler. The bundler is not part of this repo, so for text
and style edits made directly here, apply the same change to both files to keep
them in sync.

The compiled file also carries head content the bundler does not emit: the page
metadata (title, description, favicon, social tags) and the dark boot-splash
styling. If the site is ever recompiled from scratch, reapply those to the
fresh `site/index.html`.

## Custom domain

Add a `CNAME` file to `site/` containing the domain (e.g. `www.cognipilot.com`)
and configure the DNS records GitHub shows under **Settings → Pages**.
