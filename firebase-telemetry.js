import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore, doc, setDoc, addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC9PxdKbxeym04Q7Qsp6aVtBJ_cn2tJGz8",
  authDomain: "cyber-awareness-analytics-itla.firebaseapp.com",
  projectId: "cyber-awareness-analytics-itla",
  storageBucket: "cyber-awareness-analytics-itla.firebasestorage.app",
  messagingSenderId: "434538990427",
  appId: "1:434538990427:web:b11324f0f4083fc223287e"
};

const CAMPAIGN_ID = "mision-seguridad-digital-videojuegos";
const CAMPAIGN_TYPE = "gaming-awareness";
const CAMPAIGN_LOCATION = {
  label: "ITLA Caleta · Sede Central",
  city: "Boca Chica",
  province: "Santo Domingo",
  country: "República Dominicana",
  latitude: 18.451,
  longitude: -69.665,
  source: "campaign"
};
const SCHEMA_VERSION = 3;
const sessionId = crypto.randomUUID ? crypto.randomUUID() : `caa-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const startedAtMs = Date.now();
let authUser = null;
let db = null;
let lastScreen = "start-screen";
let selectedGame = null;
let sessionReady = false;
let locationData = { ...CAMPAIGN_LOCATION };
let locationRequested = false;
let locationPromise = null;

function getDeviceType() {
  const ua = navigator.userAgent || "";
  if (/tablet|ipad/i.test(ua)) return "tablet";
  if (/mobile|iphone|android/i.test(ua)) return "mobile";
  return "desktop";
}

function getBrowser() {
  const ua = navigator.userAgent || "";
  if (/edg/i.test(ua)) return "Edge";
  if (/opr|opera/i.test(ua)) return "Opera";
  if (/chrome|crios/i.test(ua)) return "Chrome";
  if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) return "Safari";
  if (/firefox|fxios/i.test(ua)) return "Firefox";
  return "Other";
}

function getOS() {
  const ua = navigator.userAgent || "";
  if (/windows nt 10/i.test(ua)) return "Windows";
  if (/android/i.test(ua)) return "Android";
  if (/iphone|ipad|ipod/i.test(ua)) return "iOS";
  if (/mac os x/i.test(ua)) return "macOS";
  if (/linux/i.test(ua)) return "Linux";
  return "Other";
}

function locationFields() {
  return {
    location: locationData,
    locationLabel: locationData.label || "Ubicación aproximada",
    city: locationData.city || null,
    province: locationData.province || null,
    country: locationData.country || "República Dominicana",
    latitude: Number(locationData.latitude),
    longitude: Number(locationData.longitude),
    locationSource: locationData.source || "campaign",
    locationAccuracyMeters: locationData.accuracyMeters || null
  };
}

function environment() {
  return {
    deviceType: getDeviceType(),
    browser: getBrowser(),
    os: getOS(),
    language: navigator.language || "unknown",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown",
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    screenResolution: `${screen.width}x${screen.height}`,
    online: navigator.onLine,
    ...locationFields()
  };
}

async function updateSession(fields) {
  if (!db || !authUser || !sessionReady) return;
  try {
    await setDoc(doc(db, "sessions", sessionId), {
      sessionUid: authUser.uid,
      sessionId,
      campaignId: CAMPAIGN_ID,
      campaignType: CAMPAIGN_TYPE,
      lastSeenAt: serverTimestamp(),
      ...fields
    }, { merge: true });
  } catch (error) {
    console.warn("CAA session not updated:", error?.code || error);
  }
}

function requestApproximateLocation({ prompt = false } = {}) {
  if (!navigator.geolocation) return Promise.resolve(locationData);
  if (locationPromise) return locationPromise;

  locationPromise = new Promise(async (resolve) => {
    try {
      if (!prompt && navigator.permissions) {
        const permission = await navigator.permissions.query({ name: "geolocation" });
        if (permission.state !== "granted") {
          locationPromise = null;
          resolve(locationData);
          return;
        }
      }

      navigator.geolocation.getCurrentPosition(async (position) => {
        locationData = {
          label: "Ubicación aproximada autorizada",
          city: null,
          province: "Santo Domingo",
          country: "República Dominicana",
          latitude: Number(position.coords.latitude.toFixed(4)),
          longitude: Number(position.coords.longitude.toFixed(4)),
          accuracyMeters: Math.round(position.coords.accuracy || 0),
          source: "device-permission"
        };
        await updateSession({
          ...locationFields(),
          lastEventType: "location_enriched",
          lastEventAt: serverTimestamp()
        });
        await track("location_enriched", locationData.source, lastScreen, { skipLocationRequest: true });
        resolve(locationData);
      }, () => {
        locationPromise = null;
        resolve(locationData);
      }, {
        enableHighAccuracy: false,
        maximumAge: 300000,
        timeout: 7000
      });
    } catch (_) {
      locationPromise = null;
      resolve(locationData);
    }
  });

  return locationPromise;
}

function baseEvent(eventType, eventValue = null, screenName = null) {
  return {
    sessionUid: authUser?.uid || null,
    sessionId,
    campaignId: CAMPAIGN_ID,
    campaignType: CAMPAIGN_TYPE,
    eventType,
    eventValue,
    screen: screenName,
    ...environment(),
    createdAt: serverTimestamp(),
    elapsedMs: Date.now() - startedAtMs,
    schemaVersion: SCHEMA_VERSION
  };
}

async function track(eventType, eventValue = null, screenName = null, options = {}) {
  if (!db || !authUser) return;
  try {
    const eventDocument = baseEvent(eventType, eventValue, screenName);
    await addDoc(collection(db, "events"), eventDocument);
    if (sessionReady) {
      await updateSession({
        ...locationFields(),
        lastEventType: eventType,
        lastEventValue: eventValue,
        lastEventScreen: screenName,
        lastEventAt: serverTimestamp()
      });
    }
  } catch (error) {
    console.warn("CAA telemetry event not recorded:", error?.code || error);
  }
}

async function createSession() {
  if (!db || !authUser || sessionReady) return;
  await setDoc(doc(db, "sessions", sessionId), {
    sessionUid: authUser.uid,
    sessionId,
    campaignId: CAMPAIGN_ID,
    campaignType: CAMPAIGN_TYPE,
    startedAt: serverTimestamp(),
    lastSeenAt: serverTimestamp(),
    status: "active",
    selectedGame: null,
    currentScreen: "start-screen",
    lastEventType: "session_started",
    ...environment(),
    schemaVersion: SCHEMA_VERSION
  });
  sessionReady = true;
  await track("session_started", null, "start-screen");
  requestApproximateLocation({ prompt: false });
}

function requestLocationFromUserGesture() {
  if (locationRequested) return;
  locationRequested = true;
  requestApproximateLocation({ prompt: true });
}

function bindExperienceEvents() {
  document.querySelectorAll(".game").forEach((game) => {
    game.addEventListener("click", async () => {
      requestLocationFromUserGesture();
      const label = (game.textContent || "")
        .replace(/EN ESPERA|ANALIZANDO\.\.\.|ANALIZANDO COMPATIBILIDAD\.\.\.|✓ COMPATIBLE/g, "")
        .trim();
      selectedGame = label || "unknown";
      await track("game_selected", selectedGame, "start-screen");
      await updateSession({ selectedGame });
    }, { capture: true });
  });

  document.getElementById("continue-btn")?.addEventListener("click", async () => {
    requestLocationFromUserGesture();
    await track("continue_clicked", selectedGame, "start-screen");
    await updateSession({ status: "in_progress" });
  }, { capture: true });

  document.getElementById("restart-btn")?.addEventListener("click", () => {
    track("restart_clicked", selectedGame, "final-screen");
  }, { capture: true });

  const screenEvents = {
    "verify-screen": "verification_started",
    "cmd-screen": "terminal_simulation_viewed",
    "analysis-screen": "analysis_started",
    "graph-screen": "correlation_map_viewed",
    "consolidate-screen": "risk_consolidation_viewed",
    "danger-screen": "educational_reveal_viewed",
    "reflection-screen": "reflection_viewed",
    "final-screen": "simulation_completed"
  };

  const observer = new MutationObserver(async () => {
    const active = document.querySelector(".screen.active");
    if (!active || active.id === lastScreen) return;
    lastScreen = active.id;
    const eventType = screenEvents[active.id] || "screen_viewed";
    await track(eventType, selectedGame, active.id);
    await updateSession({
      currentScreen: active.id,
      status: active.id === "final-screen" ? "completed" : "in_progress",
      ...(active.id === "final-screen"
        ? { completedAt: serverTimestamp(), durationMs: Date.now() - startedAtMs }
        : {})
    });
  });

  document.querySelectorAll(".screen").forEach((screenElement) => {
    observer.observe(screenElement, { attributes: true, attributeFilter: ["class"] });
  });
}

async function initializeCAA() {
  try {
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    db = getFirestore(app);
    const credential = await signInAnonymously(auth);
    authUser = credential.user;
    await createSession();
    bindExperienceEvents();
  } catch (error) {
    console.warn("CAA telemetry unavailable:", error?.code || error);
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    track("session_hidden", selectedGame, lastScreen || "start-screen");
    updateSession({ status: "inactive", currentScreen: lastScreen || "start-screen" });
  } else if (sessionReady) {
    track("session_resumed", selectedGame, lastScreen || "start-screen");
    updateSession({ status: "active", currentScreen: lastScreen || "start-screen" });
  }
});

window.addEventListener("online", () => track("connectivity_restored", null, lastScreen || "start-screen"));
window.addEventListener("offline", () => track("connectivity_lost", null, lastScreen || "start-screen"));

initializeCAA();