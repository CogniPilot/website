# CogniPilot Website

Marketing site for the CogniPilot Foundation: the open, secure, and concise flight
stack for provably safe autonomy.

**Live site:** <https://cognipilot.github.io/website/>

## How it works

The published site is a single self-contained file, `site/index.html`, with all
styles, scripts, fonts, and imagery inlined. It has no build step and no runtime
dependencies, so it can be served from any static host. Every push to `main`
publishes the contents of `site/` to GitHub Pages via
`.github/workflows/deploy.yml`; the live URL above updates within a minute or so
of each push.

## Repository layout

```
CogniPilot.dc.html    design source (edited with the dc tool)
support.js            runtime used by the design source while editing
assets/               logo art
site/index.html       compiled, self-contained site (this is what gets published)
site/.nojekyll        tells GitHub Pages to serve files as-is
.github/workflows/    Pages deploy workflow
```

## Preview locally

```bash
python3 -m http.server -d site 8080
# or: npx serve site
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
