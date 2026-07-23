import { getApps } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const ADMIN_EMAIL = "stalin.peralta@gmail.com";
let phishingSessions = [];
let authBusy = false;

function openPSOC() {
  window.location.href = "./phishing-admin.html";
}

function authInstance() {
  const apps = getApps();
  return apps.length ? getAuth(apps[0]) : null;
}

function message(text, error = false) {
  const target = document.getElementById("login-error");
  if (!target) return;
  target.textContent = text || "";
  target.style.color = error ? "#ff8994" : "#7fdcff";
  target.style.minHeight = "20px";
}

function buttonState(busy) {
  const button = document.getElementById("login-btn");
  if (!button) return;
  button.disabled = busy;
  button.textContent = busy ? "INICIANDO SESIÓN…" : "ACCEDER CON GOOGLE";
  button.style.opacity = busy ? ".72" : "1";
  button.style.cursor = busy ? "wait" : "pointer";
}

function provider() {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: "select_account", login_hint: ADMIN_EMAIL });
  return p;
}

async function validateResult(result) {
  const user = result?.user;
  if (!user) return false;
  if ((user.email || "").toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    const auth = authInstance();
    if (auth) await signOut(auth);
    message(`La cuenta ${user.email || "seleccionada"} no está autorizada. Usa ${ADMIN_EMAIL}.`, true);
    return false;
  }
  message("Acceso autorizado. Cargando el CAA SOC…");
  return true;
}

async function popupLogin() {
  if (authBusy) return;
  authBusy = true;
  buttonState(true);
  message("Abriendo Google. Selecciona la cuenta administrativa autorizada.");
  const auth = authInstance();
  if (!auth) {
    message("Firebase todavía no ha terminado de cargar. Espera dos segundos y vuelve a intentarlo.", true);
    authBusy = false;
    buttonState(false);
    return;
  }
  try {
    const result = await signInWithPopup(auth, provider());
    await validateResult(result);
  } catch (e) {
    const code = String(e?.code || "");
    if (code === "auth/unauthorized-domain") {
      message("Dominio no autorizado. Agrega stalinperalta.github.io en Firebase Authentication > Configuración > Dominios autorizados.", true);
    } else if (code === "auth/popup-blocked") {
      message("Edge bloqueó la ventana de Google. Usa el botón ACCESO ALTERNATIVO que aparecerá debajo.", true);
      showRedirectButton();
    } else if (code === "auth/popup-closed-by-user") {
      message("La ventana de Google fue cerrada antes de completar el acceso.", true);
    } else {
      message(`Error de acceso: ${e?.message || code || "desconocido"}`, true);
      showRedirectButton();
    }
  } finally {
    authBusy = false;
    buttonState(false);
  }
}

async function redirectLogin() {
  const auth = authInstance();
  if (!auth) {
    message("Firebase todavía está cargando. Intenta nuevamente.", true);
    return;
  }
  sessionStorage.setItem("caaReturnHash", location.hash || "#overview");
  message("Redirigiendo al acceso seguro de Google…");
  await signInWithRedirect(auth, provider());
}

function showRedirectButton() {
  const loginCard = document.querySelector(".login-card");
  if (!loginCard || document.getElementById("redirect-login-btn")) return;
  const button = document.createElement("button");
  button.id = "redirect-login-btn";
  button.type = "button";
  button.className = "outline";
  button.textContent = "ACCESO ALTERNATIVO";
  button.style.cssText = "margin-top:10px;width:100%;padding:13px";
  button.addEventListener("click", redirectLogin);
  loginCard.appendChild(button);
}

async function finishRedirect() {
  const auth = authInstance();
  if (!auth) return;
  try {
    const result = await getRedirectResult(auth);
    if (result && await validateResult(result)) {
      const hash = sessionStorage.getItem("caaReturnHash");
      sessionStorage.removeItem("caaReturnHash");
      if (hash) history.replaceState(null, "", hash);
    }
  } catch (e) {
    message(`No se pudo completar el acceso redirigido: ${e?.message || e?.code || "desconocido"}`, true);
    showRedirectButton();
  }
}

function installAuthHotfix() {
  const button = document.getElementById("login-btn");
  if (!button || button.dataset.hotfix === "true") return;
  button.dataset.hotfix = "true";
  button.onclick = null;
  button.addEventListener("click", e => {
    e.preventDefault();
    e.stopImmediatePropagation();
    popupLogin();
  }, true);
  message("Acceso de Google listo.");
  finishRedirect();
}

// Captura el clic antes de cualquier manejador antiguo del archivo principal.
document.addEventListener("click", e => {
  const button = e.target.closest?.("#login-btn");
  if (!button) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  popupLogin();
}, true);

function ensureNavButton() {
  const nav = document.getElementById("nav");
  if (!nav || document.getElementById("psoc-nav-button")) return;
  const button = document.createElement("button");
  button.id = "psoc-nav-button";
  button.className = "nav-item purple";
  button.type = "button";
  button.innerHTML = "🎣 PHISHING OPERATIONS";
  button.addEventListener("click", openPSOC);
  nav.appendChild(button);
}

function ensureThreatCard() {
  const container = document.getElementById("threat-modules");
  if (!container) return;
  let card = document.getElementById("psoc-threat-card");
  if (!card) {
    card = document.createElement("div");
    card.id = "psoc-threat-card";
    card.className = "module";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.style.cssText = "cursor:pointer;border-color:rgba(168,85,247,.42);box-shadow:0 0 22px rgba(168,85,247,.09)";
    card.addEventListener("click", openPSOC);
    card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") openPSOC(); });
    container.appendChild(card);
  }
  const clicked = phishingSessions.filter(s => s.linkClicked).length;
  const passed = phishingSessions.filter(s => s.quizPassed === true).length;
  card.innerHTML = `<div>🎣</div><h4>PHISHING</h4><small>Operativo · ${clicked} clic${clicked === 1 ? "" : "s"} · ${passed} aprobado${passed === 1 ? "" : "s"}</small><div class="module-value" style="color:var(--purple)">${phishingSessions.length}</div>`;
}

function ensureSettingsCard() {
  const settings = document.querySelector("#view-settings .module-grid");
  if (!settings || document.getElementById("psoc-settings-card")) return;
  const card = document.createElement("div");
  card.id = "psoc-settings-card";
  card.className = "module";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.style.cssText = "cursor:pointer;border-color:rgba(168,85,247,.38);box-shadow:0 0 22px rgba(168,85,247,.08)";
  card.innerHTML = '<h4>MÓDULO PHISHING</h4><small>Formación individual · Abrir PSOC</small><div class="module-value" style="font-size:18px;color:var(--green)">OPERATIVO</div>';
  card.addEventListener("click", openPSOC);
  card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") openPSOC(); });
  settings.appendChild(card);
}

function refreshUI() {
  installAuthHotfix();
  ensureNavButton();
  ensureThreatCard();
  ensureSettingsCard();
}

function connectFirestore() {
  const apps = getApps();
  if (!apps.length) return setTimeout(connectFirestore, 500);
  const db = getFirestore(apps[0]);
  onSnapshot(collection(db, "sessions"), snapshot => {
    phishingSessions = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.campaignType === "phishing");
    refreshUI();
  });
}

const observer = new MutationObserver(refreshUI);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("DOMContentLoaded", () => { refreshUI(); connectFirestore(); });
refreshUI();
connectFirestore();