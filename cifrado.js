// Dashboards de Caja MyM: los datos van cifrados en datos.enc (AES-GCM, PBKDF2-SHA256).
// Este script pide la clave, los descifra en el navegador y arranca el dashboard.
(async () => {
  const LS_K = 'mym_caja_clave';
  const b = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const css = `#candado{position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;background:var(--page,#f9f9f7)}
    #candado form{background:var(--card,#fff);border:1px solid var(--ring,#ddd);border-radius:12px;padding:24px;width:min(360px,92vw);font:14px/1.45 system-ui,sans-serif;color:var(--ink,#111)}
    #candado h2{margin:0 0 4px;font-size:18px}#candado p{margin:0 0 14px;color:var(--ink2,#555);font-size:13px}
    #candado input[type=password]{width:100%;box-sizing:border-box;padding:9px;font:inherit;border:1px solid var(--ring,#ccc);border-radius:7px;margin-bottom:10px}
    #candado label{font-size:13px;display:flex;gap:6px;align-items:center;margin-bottom:14px}
    #candado button{width:100%;padding:10px;font:inherit;font-weight:600;border:0;border-radius:7px;background:#2a78d6;color:#fff;cursor:pointer}
    #candado .err{color:#c0392b;font-size:13px;min-height:18px;margin-top:8px}
    #olvidar{position:fixed;right:10px;bottom:10px;z-index:30;font:12px system-ui,sans-serif;padding:4px 10px;border-radius:12px;border:1px solid var(--ring,#ccc);background:var(--card,#fff);color:var(--ink2,#555);cursor:pointer}`;
  document.head.insertAdjacentHTML('beforeend', '<style>' + css + '</style>');

  let enc;
  try { enc = await (await fetch('datos.enc', { cache: 'no-store' })).json(); }
  catch (e) { document.body.insertAdjacentHTML('afterbegin', '<p style="padding:20px">No se pudieron cargar los datos.</p>'); return; }

  async function abrir(clave) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(clave), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b(enc.salt), iterations: enc.it, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const plano = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b(enc.iv) }, key, b(enc.data));
    return JSON.parse(new TextDecoder().decode(plano));
  }
  async function arrancar(d, recordada) {
    window.CRUDO = d.crudo; window.EXTRAIDO = d.extraido;
    const c = document.getElementById('candado'); if (c) c.remove();
    for (const s of [...document.querySelectorAll('script[type="text/x-diferido"]')]) {
      const n = document.createElement('script');
      if (s.dataset.src) { n.src = s.dataset.src; await new Promise((ok, mal) => { n.onload = ok; n.onerror = mal; document.body.appendChild(n); }); }
      else { n.textContent = s.textContent; document.body.appendChild(n); }
    }
    if (recordada) {
      document.body.insertAdjacentHTML('beforeend', '<button id="olvidar" title="Borra la clave guardada en este navegador">Olvidar clave en este equipo</button>');
      document.getElementById('olvidar').onclick = () => { localStorage.removeItem(LS_K); location.reload(); };
    }
  }

  const guardada = localStorage.getItem(LS_K);
  if (guardada) { try { return await arrancar(await abrir(guardada), true); } catch (e) { localStorage.removeItem(LS_K); } }

  document.body.insertAdjacentHTML('afterbegin', `<div id="candado"><form>
    <h2>Gastos de Caja · MyM</h2><p>Los datos están cifrados. Escribe la clave para verlos.</p>
    <input type="password" id="clave" placeholder="Clave" autocomplete="current-password" required autofocus>
    <label><input type="checkbox" id="recordar"> Recordar en este equipo</label>
    <button>Abrir</button><div class="err" id="err"></div></form></div>`);
  document.querySelector('#candado form').onsubmit = async e => {
    e.preventDefault();
    const clave = document.getElementById('clave').value, err = document.getElementById('err');
    err.textContent = 'Abriendo…';
    let d;
    try { d = await abrir(clave); } catch (x) { err.textContent = 'Clave incorrecta.'; return; }
    const rec = document.getElementById('recordar').checked;
    if (rec) localStorage.setItem(LS_K, clave);
    arrancar(d, rec);
  };
})();
