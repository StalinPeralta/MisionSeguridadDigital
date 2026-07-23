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
let authBusy = false;
let firestoreConnected = false;
let bootstrapTimer = null;

function openPSOC() {
  window.location.href = "./phishing-admin.html";
}

function authInstance() {
  const apps = getApps();
  return apps.length ? getAuth(apps[0]) : null;
}

function setLoginMessage(text, isError = false) {
  const target = document.getElementById("login-error");
  if (!target) return;
  target.textContent = text || "";
  target.style.color = isError ? "#ff8994" : "#7fdcff";
  target.style.minHeight = "20px";
}

function setLoginButton(busy) {
  const button = document.getElementById("login-btn");
  if (!button) return;
  button.disabled = busy;
  button.textContent = busy ? "INICIANDO SESIÓN…" : "ACCEDER CON GOOGLE";
  button.style.opacity = busy ? ".72" : "1";
  button.style.cursor = busy ? "wait" : "pointer";
}

function googleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: "select_account",
    login_hint: ADMIN_EMAIL
  });
  return provider;
}

async function validateUser(result) {
  const user = result?.user;
  if (!user) return false;

  if ((user.email || "").toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    const auth = authInstance();
    if (auth) await signOut(auth);
    setLoginMessage(`La cuenta ${user.email || "seleccionada"} no está autorizada. Usa ${ADMIN_EMAIL}.`, true);
    return false;
  }

  setLoginMessage("Acceso autorizado. Cargando el CAA SOC…");
  return true;
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

async function popupLogin() {
  if (authBusy) return;

  const auth = authInstance();
  if (!auth) {
    setLoginMessage("Firebase todavía está inicializando. Espera dos segundos y vuelve a intentarlo.", true);
    return;
  }

  authBusy = true;
  setLoginButton(true);
  setLoginMessage("Abriendo Google. Selecciona la cuenta administrativa autorizada.");

  try {
    const result = await signInWithPopup(auth, googleProvider());
    await validateUser(result);
  } catch (error) {
    const code = String(error?.code || "");

    if (code === "auth/unauthorized-domain") {
      setLoginMessage("El dominio stalinperalta.github.io no está autorizado en Firebase Authentication.", true);
    } else if (code === "auth/popup-blocked" || code === "auth/cancelled-popup-request") {
      setLoginMessage("Edge bloqueó la ventana de Google. Utiliza ACCESO ALTERNATIVO.", true);
      showRedirectButton();
    } else if (code === "auth/popup-closed-by-user") {
      setLoginMessage("La ventana de Google fue cerrada antes de completar el acceso.", true);
    } else {
      setLoginMessage(`Error de acceso: ${error?.message || code || "desconocido"}`, true);
      showRedirectButton();
    }
  } finally {
    authBusy = false;
    setLoginButton(false);
  }
}

async function redirectLogin() {
  const auth = authInstance();
  if (!auth) {
    setLoginMessage("Firebase todavía está cargando. Intenta nuevamente.", true);
    return;
  }

  sessionStorage.setItem("caaReturnHash", location.hash || "#overview");
  setLoginMessage("Redirigiendo al acceso seguro de Google…");
  await signInWithRedirect(auth, googleProvider());
}

async function finishRedirect() {
  const auth = authInstance();
  if (!auth) return;

  try {
    const result = await getRedirectResult(auth);
    if (result && await validateUser(result)) {
      const hash = sessionStorage.getItem("caaReturnHash");
      sessionStorage.removeItem("caaReturnHash");
      if (hash) history.replaceState(null, "", hash);
    }
  } catch (error) {
    setLoginMessage(`No se pudo completar el acceso: ${error?.message || error?.code || "desconocido"}`, true);
    showRedirectButton();
  }
}

function installAuthentication() {
  const button = document.getElementById("login-btn");
  if (!button || button.dataset.psocAuthInstalled === "true") return;

  button.dataset.psocAuthInstalled = "true";
  button.onclick = null;
  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    popupLogin();
  }, true);

  setLoginMessage("Acceso de Google listo.");
  finishRedirect();
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
  const html = `<div>🎣</div><h4>PHISHING</h4><small>Operativo · ${clicked} clic${clicked === 1 ? "" : "s"} · ${passed} aprobado${passed === 1 ? "" : "s"}</small><div class="module-value" style="color:var(--purple)">${phishingSessions.length}</div>`;

  if (card.innerHTML !== html) card.innerHTML = html;
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
  installAuthentication();
  ensureNavButton();
  ensureThreatCard();
  ensureSettingsCard();
}

function connectFirestore() {
  if (firestoreConnected) return;

  const apps = getApps();
  if (!apps.length) {
    setTimeout(connectFirestore, 500);
    return;
  }

  firestoreConnected = true;
  const db = getFirestore(apps[0]);

  onSnapshot(collection(db, "sessions"), snapshot => {
    phishingSessions = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(session => session.campaignType === "phishing");
    refreshUI();
  }, error => {
    console.error("PSOC integration Firestore error:", error);
  });
}

function bootstrap() {
  refreshUI();
  connectFirestore();

  // Reintentos breves mientras Firebase y el estado de autenticación terminan de cargar.
  let attempts = 0;
  bootstrapTimer = window.setInterval(() => {
    attempts += 1;
    refreshUI();
    if (attempts >= 15) {
      window.clearInterval(bootstrapTimer);
      bootstrapTimer = null;
    }
  }, 1000);
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", bootstrap, { once: true });
} else {
  bootstrap();
}
