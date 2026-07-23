import { getApps } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const ADMIN_EMAIL = "stalin.peralta@gmail.com";
let phishingSessions = [];

function openPSOC() {
  window.location.href = "./phishing-admin.html";
}

function getPrimaryAuth() {
  const apps = getApps();
  return apps.length ? getAuth(apps[0]) : null;
}

function setLoginMessage(message, isError = false) {
  const target = document.getElementById("login-error");
  if (!target) return;
  target.textContent = message || "";
  target.style.color = isError ? "#ff8994" : "#7fdcff";
}

function restoreLoginButton() {
  const button = document.getElementById("login-btn");
  if (!button) return;
  button.disabled = false;
  button.textContent = "ACCEDER CON GOOGLE";
  button.style.opacity = "1";
}

async function completeAuthorizedLogin(result) {
  const user = result?.user;
  if (!user) return false;
  if ((user.email || "").toLowerCase() !== ADMIN_EMAIL) {
    const auth = getPrimaryAuth();
    if (auth) await signOut(auth);
    setLoginMessage(`La cuenta ${user.email || "seleccionada"} no está autorizada para administrar el CAA SOC.`, true);
    restoreLoginButton();
    return false;
  }
  setLoginMessage("Acceso autorizado. Cargando el centro de operaciones…");
  return true;
}

async function loginWithGoogle() {
  const auth = getPrimaryAuth();
  const button = document.getElementById("login-btn");
  if (!auth || !button) {
    setLoginMessage("Firebase todavía está inicializando. Intenta nuevamente en unos segundos.", true);
    return;
  }

  button.disabled = true;
  button.textContent = "ABRIENDO ACCESO SEGURO…";
  button.style.opacity = ".78";
  setLoginMessage("Selecciona la cuenta administrativa autorizada.");

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: "select_account",
    login_hint: ADMIN_EMAIL
  });

  try {
    const result = await signInWithPopup(auth, provider);
    await completeAuthorizedLogin(result);
  } catch (error) {
    const code = String(error?.code || "");
    const redirectCodes = [
      "auth/popup-blocked",
      "auth/cancelled-popup-request",
      "auth/web-storage-unsupported",
      "auth/operation-not-supported-in-this-environment"
    ];

    if (redirectCodes.includes(code)) {
      try {
        sessionStorage.setItem("caaReturnHash", location.hash || "#overview");
        setLoginMessage("El navegador bloqueó la ventana emergente. Continuando mediante acceso redirigido…");
        await signInWithRedirect(auth, provider);
        return;
      } catch (redirectError) {
        setLoginMessage(`No se pudo iniciar el acceso redirigido: ${redirectError.message}`, true);
      }
    } else if (code === "auth/popup-closed-by-user") {
      setLoginMessage("La ventana de acceso fue cerrada antes de completar la autenticación.", true);
    } else if (code === "auth/unauthorized-domain") {
      setLoginMessage("Este dominio no está autorizado en Firebase Authentication. Agrega stalinperalta.github.io en Dominios autorizados.", true);
    } else {
      setLoginMessage(`No se pudo iniciar sesión: ${error?.message || code || "error desconocido"}`, true);
    }
    restoreLoginButton();
  }
}

async function processRedirectResult() {
  const auth = getPrimaryAuth();
  if (!auth) return;
  try {
    const result = await getRedirectResult(auth);
    if (!result) return;
    const allowed = await completeAuthorizedLogin(result);
    if (allowed) {
      const hash = sessionStorage.getItem("caaReturnHash");
      sessionStorage.removeItem("caaReturnHash");
      if (hash && location.hash !== hash) history.replaceState(null, "", hash);
    }
  } catch (error) {
    setLoginMessage(`No se pudo completar el acceso: ${error?.message || error?.code || "error desconocido"}`, true);
    restoreLoginButton();
  }
}

function patchAuthentication() {
  const button = document.getElementById("login-btn");
  if (!button || button.dataset.authPatched === "true") return;
  button.dataset.authPatched = "true";
  button.onclick = event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    loginWithGoogle();
  };
  processRedirectResult();
}

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
    card.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") openPSOC();
    });
    container.appendChild(card);
  }
  const clicked = phishingSessions.filter(session => session.linkClicked).length;
  const passed = phishingSessions.filter(session => session.quizPassed === true).length;
  card.innerHTML = `
    <div>🎣</div>
    <h4>PHISHING</h4>
    <small>Operativo · ${clicked} clic${clicked === 1 ? "" : "s"} · ${passed} aprobado${passed === 1 ? "" : "s"}</small>
    <div class="module-value" style="color:var(--purple)">${phishingSessions.length}</div>
  `;
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
  card.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") openPSOC();
  });
  settings.appendChild(card);
}

function refreshUI() {
  patchAuthentication();
  ensureNavButton();
  ensureThreatCard();
  ensureSettingsCard();
}

function connectFirestore() {
  const apps = getApps();
  if (!apps.length) {
    setTimeout(connectFirestore, 500);
    return;
  }
  const db = getFirestore(apps[0]);
  onSnapshot(collection(db, "sessions"), snapshot => {
    phishingSessions = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(session => session.campaignType === "phishing");
    refreshUI();
  });
}

const observer = new MutationObserver(refreshUI);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("DOMContentLoaded", () => {
  refreshUI();
  connectFirestore();
});
refreshUI();
connectFirestore();