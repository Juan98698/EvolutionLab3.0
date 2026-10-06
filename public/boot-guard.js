/**
 * boot-guard.js — red de seguridad contra la "pantalla en blanco permanente".
 *
 * Es un script CLÁSICO (no módulo) y vive en /public a propósito: tiene que
 * ejecutarse incluso cuando el bundle principal de la app NO carga o lanza un
 * error antes de montar React (por ejemplo, un service worker que sirve una
 * combinación vieja/rota de archivos, o un módulo que falla al importarse).
 *
 * Qué hace:
 *  1. Registra el último error global (JS, promesas rechazadas y recursos que
 *     no cargaron) para poder mostrarlo.
 *  2. Si pasados BLANK_AFTER_MS la app no está "lista" o #root está vacío,
 *     muestra un aviso con dos salidas:
 *       - "Reparar": desregistra el service worker y borra las cachés.
 *         NO toca localStorage/IndexedDB, así que no pierde sesión ni datos.
 *       - "Borrar datos locales": limpia todo (equivale a "borrar datos del
 *         sitio"). Último recurso; cierra la sesión.
 *  3. Si la app termina cargando bien, el aviso desaparece solo.
 *
 * Señal de "app lista": la clase `auth-ready` en <body> (la agrega
 * SupabaseContext cuando termina de resolver la sesión).
 */
(function () {
  'use strict';

  var BLANK_AFTER_MS = 8000;
  var CHECK_EVERY_MS = 1000;
  var OVERLAY_ID = 'evolab-boot-guard';

  var startedAt = Date.now();
  var lastError = '';

  function record(message) {
    if (!message) return;
    lastError = String(message).slice(0, 300);
  }

  // Capture = true para enterarnos también de <script>/<link> que no cargaron
  // (esos errores no burbujean hasta window).
  window.addEventListener(
    'error',
    function (event) {
      if (!event) return;
      var target = event.target;
      if (target && target !== window && (target.src || target.href)) {
        record('No se pudo cargar: ' + (target.src || target.href));
        return;
      }
      record(event.message || (event.error && event.error.message));
    },
    true
  );

  window.addEventListener('unhandledrejection', function (event) {
    var reason = event && event.reason;
    record(reason && reason.message ? reason.message : reason);
  });

  function isAppHealthy() {
    var root = document.getElementById('root');
    var ready = !!(document.body && document.body.classList.contains('auth-ready'));
    var hasContent = !!root && root.childElementCount > 0;
    return ready && hasContent;
  }

  function settle(tasks) {
    // Cada tarea se ejecuta aislada: si una falla, las demás siguen.
    return Promise.all(
      tasks.map(function (task) {
        try {
          return Promise.resolve(task()).catch(function () {});
        } catch (e) {
          return Promise.resolve();
        }
      })
    );
  }

  function unregisterServiceWorkers() {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.getRegistrations) {
      return Promise.resolve();
    }
    return navigator.serviceWorker.getRegistrations().then(function (regs) {
      return Promise.all(
        regs.map(function (reg) {
          return reg.unregister();
        })
      );
    });
  }

  function clearCaches() {
    if (!('caches' in window)) return Promise.resolve();
    return caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          return caches.delete(key);
        })
      );
    });
  }

  function clearIndexedDb() {
    if (!window.indexedDB || typeof indexedDB.databases !== 'function') return Promise.resolve();
    return indexedDB.databases().then(function (dbs) {
      return Promise.all(
        dbs.map(function (db) {
          return new Promise(function (resolve) {
            if (!db || !db.name) return resolve();
            var req = indexedDB.deleteDatabase(db.name);
            req.onsuccess = req.onerror = req.onblocked = function () {
              resolve();
            };
          });
        })
      );
    });
  }

  function clearWebStorage() {
    try {
      localStorage.clear();
    } catch (e) {}
    try {
      sessionStorage.clear();
    } catch (e) {}
  }

  function reloadSoon() {
    window.location.reload();
  }

  /**
   * hard=false → solo service worker + cachés (conserva sesión y datos).
   * hard=true  → además localStorage, sessionStorage e IndexedDB.
   */
  function repair(hard) {
    var tasks = [unregisterServiceWorkers, clearCaches];
    if (hard) {
      clearWebStorage();
      tasks.push(clearIndexedDb);
    }
    // Si algo se cuelga, recargamos igual a los 4 s para no dejar al usuario atrapado.
    var fallback = window.setTimeout(reloadSoon, 4000);
    settle(tasks).then(function () {
      window.clearTimeout(fallback);
      reloadSoon();
    });
  }

  function makeButton(label, primary, onClick) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.style.cssText =
      'display:block;width:100%;margin-top:10px;padding:12px 16px;border-radius:12px;' +
      'font-size:13px;font-weight:700;cursor:pointer;font-family:system-ui,sans-serif;' +
      (primary
        ? 'background:rgba(0,212,255,.15);border:1px solid rgba(0,212,255,.5);color:#00d4ff;'
        : 'background:transparent;border:1px solid rgba(255,255,255,.18);color:rgba(255,255,255,.65);');
    btn.addEventListener('click', onClick);
    return btn;
  }

  function showOverlay() {
    if (document.getElementById(OVERLAY_ID) || !document.body) return;

    var overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.setAttribute('role', 'alert');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;' +
      'justify-content:center;padding:24px;background:rgba(11,15,25,.94);color:#fff;' +
      'font-family:system-ui,sans-serif;text-align:center;';

    var card = document.createElement('div');
    card.style.cssText = 'max-width:340px;width:100%;';

    var title = document.createElement('div');
    title.textContent = 'La app no terminó de cargar';
    title.style.cssText = 'font-size:16px;font-weight:800;margin-bottom:8px;';

    var text = document.createElement('div');
    text.textContent =
      'Puede ser una versión guardada que quedó dañada. Reparar no borra tu sesión ni tus datos.';
    text.style.cssText = 'font-size:12px;opacity:.65;line-height:1.5;margin-bottom:6px;';

    card.appendChild(title);
    card.appendChild(text);

    if (lastError) {
      var detail = document.createElement('div');
      detail.textContent = lastError;
      detail.style.cssText =
        'font-size:10px;opacity:.4;word-break:break-word;margin:8px 0 4px;font-family:monospace;';
      card.appendChild(detail);
    }

    card.appendChild(
      makeButton('Reparar y recargar', true, function () {
        repair(false);
      })
    );
    card.appendChild(
      makeButton('Borrar datos locales (cierra sesión)', false, function () {
        var ok = window.confirm(
          'Esto borra los datos guardados en este dispositivo y cierra tu sesión. ' +
            'Las sesiones de entrenamiento sin sincronizar se perderán. ¿Continuar?'
        );
        if (ok) repair(true);
      })
    );

    overlay.appendChild(card);
    document.body.appendChild(overlay);
  }

  function hideOverlay() {
    var overlay = document.getElementById(OVERLAY_ID);
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  function tick() {
    if (isAppHealthy()) {
      hideOverlay();
      return;
    }
    if (Date.now() - startedAt >= BLANK_AFTER_MS) showOverlay();
  }

  window.setInterval(tick, CHECK_EVERY_MS);

  // API mínima para depurar desde chrome://inspect y para los tests.
  window.__evolabBootGuard = {
    getLastError: function () {
      return lastError;
    },
    repair: repair
  };
})();
