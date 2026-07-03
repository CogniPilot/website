#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'site/index.html',
  'site/.nojekyll',
  'site/blog/index.html',
  'site/blog/rumoca-naca-pde.html',
  'site/blog/blog-rumoca-live-v1.js',
  'site/blog/rumoca-naca-manifest.json',
  'site/blog/assets/rumoca-naca-airfoil.mo',
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
if (manifest.schema !== 'blog-rumoca-live-v1') fail('Unexpected Rumoca manifest schema.');
if (manifest.packageName !== '@cognipilot/rumoca') fail('Unexpected Rumoca package name.');
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(manifest.rumocaVersion || '')) {
  fail('Rumoca version must be an exact npm semver, not a range or latest tag.');
}
if (!manifest.packageIntegrity || !manifest.packageShasum) {
  fail('Rumoca manifest must include npm package integrity and shasum.');
}

const post = read('site/blog/rumoca-naca-pde.html');
if (!post.includes('data-rumoca-live')) fail('Blog post is missing the Rumoca runtime panel.');
if (!post.includes('blog-rumoca-live-v1.js')) fail('Blog post is missing the Rumoca runtime wrapper.');
if (!post.includes('rumoca-naca-manifest.json')) fail('Blog post is missing the Rumoca manifest reference.');

const home = read('site/index.html');
const bootScript = home.match(/<script>([\s\S]*?)<\/script>/i);
if (!bootScript) fail('Published homepage is missing its boot script.');
new Function(bootScript[1]);
if (!home.includes('rumoca-naca-pde.html')) fail('Published homepage is missing the blog post link.');

const source = read('site/blog/assets/rumoca-naca-airfoil.mo');
if (!source.includes('model AirfoilFlowBlog')) fail('NACA Modelica source has the wrong model name.');
if (!source.includes('Real u[NX, NY]')) fail('NACA Modelica source should preserve array variables.');

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
