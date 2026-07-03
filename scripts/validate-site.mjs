#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'site/index.html',
  'site/.nojekyll',
  'site/assets/cognipilot-logo-dark.png',
  'site/assets/nxp-logo.svg',
  'site/assets/purdue-university-logo.svg',
  'site/events/index.html',
  'site/membership/index.html',
  'site/blog/index.html',
  'site/blog/rumoca-naca-pde.html',
  'site/blog/rumoca-guide-widget.js',
  'site/blog/rumoca-live.js',
  'site/blog/rumoca-live.css',
  'site/blog/rumoca-naca-manifest.json',
  'site/blog/assets/airfoil-flow.mo',
  'site/blog/assets/airfoil-flow-viz.js',
  'site/blog/assets/rumoca_naca_blog.webm',
  'site/blog/assets/rumoca_naca_blog_poster.jpg',
];

function fail(message) {
  throw new Error(message);
}

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    fail(`Fetch failed for ${url}: HTTP ${response.status}`);
  }
  return response.json();
}

async function checkHead(url) {
  const response = await fetch(url, { method: 'HEAD' });
  if (!response.ok) {
    fail(`HEAD failed for ${url}: HTTP ${response.status}`);
  }
  return response;
}

for (const file of requiredFiles) {
  if (!exists(file)) fail(`Missing required file: ${file}`);
}

if (exists('site/vendor')) {
  fail('site/vendor should not be committed; blog examples must pin npm versions instead.');
}

const manifest = JSON.parse(read('site/blog/rumoca-naca-manifest.json'));
if (manifest.schema !== 'rumoca-guide-widget-v1') fail('Unexpected Rumoca manifest schema.');
if (manifest.packageName !== '@cognipilot/rumoca') fail('Unexpected Rumoca package name.');
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(manifest.rumocaVersion || '')) {
  fail('Rumoca version must be an exact npm semver, not a range or latest tag.');
}
if (!manifest.packageIntegrity || !manifest.packageShasum) {
  fail('Rumoca manifest must include npm package integrity and shasum.');
}

const post = read('site/blog/rumoca-naca-pde.html');
const blogIndex = read('site/blog/index.html');
const eventsIndex = read('site/events/index.html');
const membershipIndex = read('site/membership/index.html');
if (!blogIndex.includes('../assets/cognipilot-logo-dark.png')) {
  fail('Blog index header must use the CogniPilot logo asset.');
}
if (!post.includes('../assets/cognipilot-logo-dark.png')) {
  fail('Blog post header must use the CogniPilot logo asset.');
}
if (!post.includes('data-rumoca-guide-widget')) fail('Blog post is missing the Rumoca guide widget mount.');
if (!post.includes('rumoca-guide-widget.js')) fail('Blog post is missing the guide widget loader.');
if (!post.includes('rumoca-live.css')) fail('Blog post is missing the guide widget stylesheet.');
if (!post.includes('rumoca-naca-manifest.json')) fail('Blog post is missing the Rumoca manifest reference.');
if (!post.includes('assets/rumoca_naca_blog.webm')) fail('Blog post is missing the recorded NACA preview video.');
if (!post.includes('around 10 seconds')) fail('Blog post should warn about first compile/setup time.');
if (!post.includes('first-order motor model') || !post.includes('cross-domain optimization')) {
  fail('Blog post should foreground the coupled differentiable motor/shape/PDE point.');
}
if (post.includes('Synthetic field preview') || post.includes('blog-rumoca-live-v1')) {
  fail('Blog post still contains the old fake/custom widget.');
}
for (const [name, page] of [
  ['Blog index', blogIndex],
  ['Events page', eventsIndex],
  ['Membership page', membershipIndex],
]) {
  if (!page.includes('radial-gradient(1100px 620px') || !page.includes('max-width: 1240px')) {
    fail(`${name} must use the Mission visual shell.`);
  }
  if (!page.includes('cognipilot-logo-dark.png') || !page.includes('github-link')) {
    fail(`${name} is missing the shared top-level navigation shell.`);
  }
}
if (!eventsIndex.includes('calendar.google.com/calendar/embed')) fail('Events page is missing the Google Calendar embed.');
if (!membershipIndex.includes('assets/nxp-logo.svg') || !membershipIndex.includes('assets/purdue-university-logo.svg')) {
  fail('Membership page is missing founding Platinum member logos.');
}

const home = read('site/index.html');
const bootScript = home.match(/<script>([\s\S]*?)<\/script>/i);
if (!bootScript) fail('Published homepage is missing its boot script.');
new Function(bootScript[1]);
if (!home.includes('installHomepageAdditions')) fail('Published homepage is missing the post-render navigation hook.');
if (!home.includes('Three principles') || !home.includes('REACHABILITY ANALYSIS') || !home.includes('PROVEN FLOW TUBE')) {
  fail('Published homepage is missing rich Mission page content.');
}
if (!home.includes('width:min(100%,1320px)')) fail('Mission page header normalization is missing.');
if (!home.includes("membership.href = 'membership/'") || !home.includes("events.href = 'events/'")) {
  fail('Mission page must link to the top-level Membership and Events pages.');
}
if (!home.includes("document.getElementById('summit')") || !home.includes('summit.remove()')) {
  fail('Mission page should remove the old embedded summit/calendar section; Events owns the calendar.');
}
if (!home.includes('rumoca-naca-pde.html')) fail('Published homepage is missing the blog post link.');

const source = read('site/blog/assets/airfoil-flow.mo');
if (!source.includes('model AirfoilFlow ')) fail('NACA Modelica source has the wrong model name.');
if (!source.includes('Real u[NX, NY]')) fail('NACA Modelica source should preserve array variables.');
if (!source.includes('annotation(__rumoca(Solver(FixedStep = 0.005))')) {
  fail('NACA Modelica source is missing the guide GPU solver annotation.');
}
const viz = read('site/blog/assets/airfoil-flow-viz.js');
if (!viz.includes("api.addTuner('aoa'")) fail('NACA visualization is missing the guide AoA tuner.');
if (!viz.includes('Streamlines')) fail('NACA visualization is missing the guide streamline control.');
const guideRunner = read('site/blog/rumoca-live.js');
if (!guideRunner.includes('Rumoca live example runner for the mdBook guides')) {
  fail('rumoca-live.js is not the user-guide live runner.');
}

const registryPackage = encodeURIComponent(manifest.packageName);
const registry = await fetchJson(`https://registry.npmjs.org/${registryPackage}`);
const version = registry.versions?.[manifest.rumocaVersion];
if (!version) fail(`${manifest.packageName}@${manifest.rumocaVersion} was not found on npm.`);
if (version.dist?.integrity !== manifest.packageIntegrity) {
  fail('Manifest packageIntegrity does not match npm registry metadata.');
}
if (version.dist?.shasum !== manifest.packageShasum) {
  fail('Manifest packageShasum does not match npm registry metadata.');
}

if (!Array.isArray(manifest.runtimeBases) || manifest.runtimeBases.length < 1) {
  fail('Rumoca manifest must include at least one runtime base URL.');
}
if (!manifest.monacoBase || !manifest.monacoBase.includes('monaco-editor@0.45.0')) {
  fail('Rumoca manifest must pin the Monaco editor base to monaco-editor@0.45.0.');
}
await checkHead(new URL('vs/loader.js', manifest.monacoBase).href);
if (!manifest.languageModule || !manifest.languageModule.includes(`${manifest.packageName}@${manifest.rumocaVersion}/modelica_language.js`)) {
  fail('Rumoca manifest must pin the Modelica language module to the exact Rumoca npm package.');
}
await checkHead(manifest.languageModule);
for (const base of manifest.runtimeBases) {
  if (base.includes('@latest') || !base.includes(`${manifest.packageName}@${manifest.rumocaVersion}`)) {
    fail(`Runtime base is not pinned to the exact package version: ${base}`);
  }
  await checkHead(new URL('rumoca_bind_wasm.js', base).href);
  const wasm = await checkHead(new URL('rumoca_bind_wasm_bg.wasm', base).href);
  const contentType = wasm.headers.get('content-type') || '';
  if (!contentType.includes('application/wasm')) {
    fail(`WASM asset has unexpected content-type at ${base}: ${contentType}`);
  }
}

console.log(`Site validation passed for ${manifest.packageName}@${manifest.rumocaVersion}.`);
