import { getApps } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

let phishingSessions = [];

function openPSOC() {
  window.location.href = "./phishing-admin.html";
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
