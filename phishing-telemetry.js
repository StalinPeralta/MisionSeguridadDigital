import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore, doc, setDoc, updateDoc, addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC9PxdKbxeym04Q7Qsp6aVtBJ_cn2tJGz8",
  authDomain: "cyber-awareness-analytics-itla.firebaseapp.com",
  projectId: "cyber-awareness-analytics-itla",
  storageBucket: "cyber-awareness-analytics-itla.firebasestorage.app",
  messagingSenderId: "434538990427",
  appId: "1:434538990427:web:b11324f0f4083fc223287e"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const params = new URLSearchParams(location.search);
const campaignId = params.get("campaign") || "PH-2026-DEMO";
const participantId = params.get("participant") || `DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
const participantName = params.get("name") || "Participante de prueba";
const department = params.get("department") || "Sin departamento";
const templateId = params.get("template") || "password-reset";
const sessionId = `phishing-${campaignId}-${participantId}`.replace(/[^a-zA-Z0-9_-]/g, "-");
let ready = false;
let sessionStartedAt = Date.now();
let locationData = {};

function deviceType() {
  const ua = navigator.userAgent;
  return /Mobi|Android|iPhone|iPad/i.test(ua) ? "mobile" : "desktop";
}
function browserName() {
  const ua = navigator.userAgent;
  if (/Edg/i.test(ua)) return "Edge";
  if (/Chrome/i.test(ua)) return "Chrome";
  if (/Firefox/i.test(ua)) return "Firefox";
  if (/Safari/i.test(ua)) return "Safari";
  return "Otro";
}
function osName() {
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return "Windows";
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad|iOS/i.test(ua)) return "iOS";
  if (/Mac/i.test(ua)) return "macOS";
  return "Otro";
}
async function requestApproximateLocation() {
  if (!navigator.geolocation) return {};
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve({
        latitude: Number(pos.coords.latitude.toFixed(3)),
        longitude: Number(pos.coords.longitude.toFixed(3)),
        locationAccuracy: Math.round(pos.coords.accuracy),
        locationSource: "browser-permission"
      }),
      () => resolve({}),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  });
}
async function ensureSession() {
  if (!auth.currentUser) await signInAnonymously(auth);
  locationData = await requestApproximateLocation();
  await setDoc(doc(db, "sessions", sessionId), {
    id: sessionId,
    sessionId,
    sessionUuid: auth.currentUser.uid,
    campaignId,
    campaignType: "phishing",
    module: "PSOC",
    participantId,
    participantName,
    department,
    templateId,
    status: "active",
    screen: "email-preview",
    deviceType: deviceType(),
    browser: browserName(),
    operatingSystem: osName(),
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    resolution: `${screen.width}x${screen.height}`,
    startedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...locationData
  }, { merge: true });
  ready = true;
}
async function track(eventType, eventValue = "", extra = {}) {
  try {
    if (!ready) await ensureSession();
    const payload = {
      campaignId,
      campaignType: "phishing",
      module: "PSOC",
      participantId,
      participantName,
      department,
      templateId,
      sessionId,
      sessionUuid: auth.currentUser.uid,
      eventType,
      eventValue,
      screen: extra.screen || document.body.dataset.screen || "phishing",
      deviceType: deviceType(),
      browser: browserName(),
      operatingSystem: osName(),
      elapsedMs: Date.now() - sessionStartedAt,
      createdAt: serverTimestamp(),
      ...locationData,
      ...extra
    };
    await addDoc(collection(db, "events"), payload);
    await updateDoc(doc(db, "sessions", sessionId), {
      lastEventType: eventType,
      lastEventValue: eventValue,
      screen: payload.screen,
      updatedAt: serverTimestamp(),
      elapsedMs: payload.elapsedMs,
      ...locationData,
      ...extra.sessionUpdate
    });
    window.dispatchEvent(new CustomEvent("psoc:tracked", { detail: payload }));
  } catch (error) {
    console.error("PSOC telemetry error", error);
  }
}

onAuthStateChanged(auth, user => {
  if (user && !ready) ensureSession().then(() => track("phishing_email_opened", templateId, { screen: "email-preview" }));
});
if (!auth.currentUser) signInAnonymously(auth).catch(console.error);

window.PSOC = {
  track,
  sessionId,
  campaignId,
  participantId,
  participantName,
  department,
  templateId,
  completeTutorial: () => track("phishing_tutorial_completed", "completed", { screen: "tutorial", sessionUpdate: { tutorialCompleted: true } }),
  saveQuiz: (score, passed, answers) => track("phishing_quiz_completed", String(score), {
    screen: "quiz-result",
    score,
    passed,
    answers,
    sessionUpdate: {
      quizScore: score,
      quizPassed: passed,
      trainingStatus: passed ? "trained" : "reinforcement_required",
      status: "completed",
      completedAt: serverTimestamp()
    }
  })
};
