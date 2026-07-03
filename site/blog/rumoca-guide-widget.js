const host = document.querySelector('[data-rumoca-guide-widget]');

function appendLog(message) {
  const log = document.querySelector('[data-rumoca-guide-log]');
  if (log) log.textContent = message;
}

function makeCodeBlock(languageClass, source) {
  const pre = document.createElement('pre');
  const code = document.createElement('code');
  code.className = languageClass;
  code.textContent = source.replace(/\n$/, '');
  pre.appendChild(code);
  return pre;
}

function loadClassicScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`failed to load ${src}`));
    document.head.appendChild(script);
  });
}

function installGuideCompatibility() {
  // The guide runner keys Monaco's theme off mdBook theme classes.
  document.documentElement.classList.add('navy');
  if ('liveCheck' in window) return;
  Object.defineProperty(window, 'liveCheck', {
    configurable: true,
    get() {
      return [...document.querySelectorAll('.rumoca-live-gpu input[type="checkbox"]')]
        .find((input) => input.parentElement?.textContent?.includes('Interactive'))
        || { checked: false };
    },
  });
}

async function loadText(url, label) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${label} failed to load (${response.status})`);
  }
  return response.text();
}

async function main() {
  if (!host) return;
  const manifestUrl = new URL(host.dataset.manifest || 'rumoca-naca-manifest.json', import.meta.url);
  const manifestResponse = await fetch(manifestUrl);
  if (!manifestResponse.ok) {
    throw new Error(`manifest failed to load (${manifestResponse.status})`);
  }
  const manifest = await manifestResponse.json();
  const runtimeBase = manifest.runtimeBases?.[0];
  if (!runtimeBase) {
    throw new Error('manifest does not define a pinned runtime base');
  }

  window.RUMOCA_LIVE_PKG_BASE = runtimeBase;
  if (manifest.monacoBase) {
    window.RUMOCA_LIVE_MONACO_BASE = manifest.monacoBase;
  }

  const modelUrl = new URL(manifest.modelSource, manifestUrl);
  const vizUrl = new URL(manifest.vizSource, manifestUrl);
  const [modelSource, vizSource] = await Promise.all([
    loadText(modelUrl, 'Modelica source'),
    loadText(vizUrl, 'Visualization source'),
  ]);

  host.replaceChildren(
    makeCodeBlock('language-modelica interactive gpu', modelSource),
    makeCodeBlock('language-js rumoca-viz', vizSource),
  );
  appendLog(`${manifest.packageName}@${manifest.rumocaVersion} · exact user-guide widget loaded`);

  installGuideCompatibility();
  await loadClassicScript(new URL('rumoca-live.js', import.meta.url).href);
}

main().catch((error) => {
  appendLog(`Rumoca guide widget failed: ${error.message}`);
  if (host) {
    const pre = document.createElement('pre');
    pre.className = 'rumoca-live-error';
    pre.textContent = error.stack || error.message;
    host.replaceChildren(pre);
  }
});
