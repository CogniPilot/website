const widget = document.querySelector('[data-rumoca-live]');

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function appendLog(text) {
  const log = document.getElementById('rumoca-log');
  if (!log) return;
  const line = document.createElement('div');
  line.textContent = text;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

function countKeys(value) {
  return value && typeof value === 'object' ? Object.keys(value).length : 0;
}

async function loadManifest() {
  const url = widget?.dataset.manifest || 'rumoca-naca-manifest.json';
  const response = await fetch(url);
  if (!response.ok) throw new Error(`manifest fetch failed (${response.status})`);
  const manifest = await response.json();
  const sourceUrl = new URL(manifest.modelSource, response.url);
  const sourceResponse = await fetch(sourceUrl);
  if (!sourceResponse.ok) throw new Error(`model fetch failed (${sourceResponse.status})`);
  return { manifest, source: await sourceResponse.text() };
}

function runtimeBasesFromManifest(manifest) {
  if (Array.isArray(manifest.runtimeBases) && manifest.runtimeBases.length > 0) {
    return manifest.runtimeBases;
  }
  if (manifest.runtimeBase) {
    return [manifest.runtimeBase];
  }
  const pkg = manifest.packageName || '@cognipilot/rumoca';
  return [`https://cdn.jsdelivr.net/npm/${pkg}@${manifest.rumocaVersion}/`];
}

async function loadRumoca(runtimeBases) {
  const bases = Array.isArray(runtimeBases) ? runtimeBases : [runtimeBases];
  let lastError = null;
  for (const runtimeBase of bases) {
    try {
      appendLog(`loading runtime from ${runtimeBase}`);
      const base = new URL(runtimeBase, import.meta.url);
      const wasm = await import(new URL('rumoca_bind_wasm.js', base).href);
      await wasm.default({ module_or_path: new URL('rumoca_bind_wasm_bg.wasm', base) });
      const gpu = await import(new URL('rumoca_gpu.js', base).href);
      return { wasm, gpu, base: base.href };
    } catch (error) {
      lastError = error;
      appendLog(`runtime load failed from ${runtimeBase}: ${error.message}`);
    }
  }
  throw lastError || new Error('no Rumoca runtime base configured');
}

function summarizeDae(envelope) {
  const dae = envelope.dae_native || envelope.dae || {};
  const vars = dae.variables || dae;
  const states = countKeys(vars.states || dae.x);
  const algebraics = countKeys(vars.algebraics || dae.y);
  const parameters = countKeys(vars.parameters || dae.p);
  const fx = Array.isArray(dae.fx) ? dae.fx.length : countKeys(dae.f_x);
  return { states, algebraics, parameters, fx };
}

async function main() {
  if (!widget) return;
  const runCompile = document.getElementById('rumoca-compile');
  const runGpuPrep = document.getElementById('rumoca-gpu-prep');
  const runGpu = document.getElementById('rumoca-gpu-run');
  const { manifest, source } = await loadManifest();
  const packageName = manifest.packageName || '@cognipilot/rumoca';
  const runtimeBases = runtimeBasesFromManifest(manifest);
  setText('rumoca-pin', `${packageName} ${manifest.rumocaVersion}`);
  setText('rumoca-model', manifest.modelName);
  appendLog(`manifest loaded: ${manifest.schema}`);
  appendLog(`runtime pin: ${packageName}@${manifest.rumocaVersion}`);
  if (manifest.packageShasum) appendLog(`npm shasum: ${manifest.packageShasum}`);
  appendLog(`model source loaded: ${source.length.toLocaleString()} bytes`);

  let runtime = null;
  let prep = null;
  let adapter = null;

  async function ensureRuntime() {
    if (!runtime) {
      setText('rumoca-runtime-status', 'Loading pinned WASM runtime...');
      runtime = await loadRumoca(runtimeBases);
      runtime.wasm.init();
      setText('rumoca-runtime-status', `Runtime ready: ${runtime.wasm.get_version()} (${runtime.wasm.get_git_commit().slice(0, 8)})`);
      appendLog(`runtime base: ${runtime.base}`);
      appendLog(`runtime build: ${runtime.wasm.get_build_time_utc()}`);
    }
    return runtime;
  }

  runCompile?.addEventListener('click', async () => {
    try {
      const { wasm } = await ensureRuntime();
      setText('rumoca-result', 'Compiling to DAE...');
      const t0 = performance.now();
      const envelope = JSON.parse(wasm.compile(source, manifest.modelName));
      const s = summarizeDae(envelope);
      const ms = Math.round(performance.now() - t0);
      setText('rumoca-result', `DAE ready in ${ms} ms: ${s.states} states, ${s.algebraics} algebraics, ${s.parameters} parameters, ${s.fx} residual rows.`);
      appendLog(`DAE compile ok: ${JSON.stringify(s)}`);
    } catch (error) {
      setText('rumoca-result', `Compile failed: ${error.message}`);
      appendLog(`compile error: ${error.stack || error.message}`);
    }
  });

  runGpuPrep?.addEventListener('click', async () => {
    try {
      const { wasm } = await ensureRuntime();
      setText('rumoca-result', 'Lowering to Solve IR and rendering WGSL...');
      const t0 = performance.now();
      prep = JSON.parse(wasm.prepare_gpu_simulation(source, manifest.modelName));
      const ms = Math.round(performance.now() - t0);
      setText('rumoca-result', `GPU prep ready in ${ms} ms: ${prep.n_states} states, ${(prep.wgsl || '').length.toLocaleString()} WGSL chars.`);
      appendLog(`gpu prep ok: n_states=${prep.n_states}, y0=${(prep.y0 || []).length}, p0=${(prep.p0 || []).length}`);
    } catch (error) {
      setText('rumoca-result', `GPU prep failed: ${error.message}`);
      appendLog(`gpu prep error: ${error.stack || error.message}`);
    }
  });

  runGpu?.addEventListener('click', async () => {
    try {
      const { wasm, gpu } = await ensureRuntime();
      if (!prep) prep = JSON.parse(wasm.prepare_gpu_simulation(source, manifest.modelName));
      setText('rumoca-result', 'Requesting WebGPU adapter...');
      if (!adapter) adapter = await gpu.probeGpu();
      const phase = (message, fraction) => {
        setText('rumoca-result', fraction == null ? message : `${message} ${Math.round(fraction * 100)}%`);
      };
      const result = await gpu.runGpuSimulation(adapter, prep, phase);
      const payload = result.payload || {};
      setText('rumoca-result', `WebGPU run complete: ${payload.names?.length || 0} variables, ${payload.allData?.[0]?.length || 0} samples.`);
      appendLog(`gpu run ok: ${JSON.stringify(result.metrics || {})}`);
    } catch (error) {
      setText('rumoca-result', `WebGPU run failed: ${error.message}`);
      appendLog(`gpu run error: ${error.stack || error.message}`);
    }
  });
}

main().catch((error) => {
  setText('rumoca-runtime-status', `Pinned runtime failed to load: ${error.message}`);
  appendLog(error.stack || error.message);
});
