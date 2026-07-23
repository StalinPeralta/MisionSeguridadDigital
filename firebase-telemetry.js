import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore, doc, setDoc, addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const firebaseConfig={apiKey:"AIzaSyC9PxdKbxeym04Q7Qsp6aVtBJ_cn2tJGz8",authDomain:"cyber-awareness-analytics-itla.firebaseapp.com",projectId:"cyber-awareness-analytics-itla",storageBucket:"cyber-awareness-analytics-itla.firebasestorage.app",messagingSenderId:"434538990427",appId:"1:434538990427:web:b11324f0f4083fc223287e"};
const CAMPAIGN_ID="mision-seguridad-digital-videojuegos";
const CAMPAIGN_TYPE="gaming-awareness";
const DEFAULT_LOCATION={label:"ITLA Caleta · Sede Central",city:"Boca Chica",province:"Santo Domingo",country:"República Dominicana",latitude:18.451,longitude:-69.665,source:"campaign"};
const SCHEMA_VERSION=4;
const sessionId=crypto.randomUUID?.()||`caa-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const startedAtMs=Date.now();
let authUser=null,db=null,sessionReady=false,lastScreen="start-screen",selectedGame=null,locationData={...DEFAULT_LOCATION},locationRequested=false;

const deviceType=()=>/tablet|ipad/i.test(navigator.userAgent)?"tablet":/mobile|iphone|android/i.test(navigator.userAgent)?"mobile":"desktop";
const browser=()=>/edg/i.test(navigator.userAgent)?"Edge":/opr|opera/i.test(navigator.userAgent)?"Opera":/chrome|crios/i.test(navigator.userAgent)?"Chrome":/safari/i.test(navigator.userAgent)&&!/chrome|crios/i.test(navigator.userAgent)?"Safari":/firefox|fxios/i.test(navigator.userAgent)?"Firefox":"Other";
const os=()=>/windows nt 10/i.test(navigator.userAgent)?"Windows":/android/i.test(navigator.userAgent)?"Android":/iphone|ipad|ipod/i.test(navigator.userAgent)?"iOS":/mac os x/i.test(navigator.userAgent)?"macOS":/linux/i.test(navigator.userAgent)?"Linux":"Other";
const locationFields=()=>({location:locationData,locationLabel:locationData.label||"Ubicación aproximada",city:locationData.city||null,province:locationData.province||null,country:locationData.country||"República Dominicana",latitude:Number(locationData.latitude),longitude:Number(locationData.longitude),locationSource:locationData.source||"campaign",locationAccuracyMeters:locationData.accuracyMeters||null});
const environment=()=>({deviceType:deviceType(),browser:browser(),os:os(),language:navigator.language||"unknown",timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||"unknown",viewport:`${innerWidth}x${innerHeight}`,screenResolution:`${screen.width}x${screen.height}`,online:navigator.onLine,...locationFields()});

async function updateSession(fields){if(!db||!authUser||!sessionReady)return;try{await setDoc(doc(db,"sessions",sessionId),{sessionUid:authUser.uid,sessionId,campaignId:CAMPAIGN_ID,campaignType:CAMPAIGN_TYPE,lastSeenAt:serverTimestamp(),...fields},{merge:true})}catch(e){console.warn("CAA session update:",e?.code||e)}}
async function track(eventType,eventValue=null,screenName=null){if(!db||!authUser)return;try{await addDoc(collection(db,"events"),{sessionUid:authUser.uid,sessionId,campaignId:CAMPAIGN_ID,campaignType:CAMPAIGN_TYPE,eventType,eventValue,screen:screenName,...environment(),createdAt:serverTimestamp(),elapsedMs:Date.now()-startedAtMs,schemaVersion:SCHEMA_VERSION});if(sessionReady)await updateSession({lastEventType:eventType,lastEventValue:eventValue,lastEventScreen:screenName,lastEventAt:serverTimestamp()})}catch(e){console.warn("CAA telemetry:",e?.code||e)}}

async function requestLocation(){if(locationRequested||!navigator.geolocation)return;locationRequested=true;navigator.geolocation.getCurrentPosition(async p=>{locationData={label:"Ubicación aproximada autorizada",city:null,province:"Santo Domingo",country:"República Dominicana",latitude:Number(p.coords.latitude.toFixed(4)),longitude:Number(p.coords.longitude.toFixed(4)),accuracyMeters:Math.round(p.coords.accuracy||0),source:"device-permission"};await updateSession({...locationFields()});await track("location_enriched",locationData.source,lastScreen)},()=>{}, {enableHighAccuracy:false,maximumAge:300000,timeout:7000})}

async function createSession(){await setDoc(doc(db,"sessions",sessionId),{sessionUid:authUser.uid,sessionId,campaignId:CAMPAIGN_ID,campaignType:CAMPAIGN_TYPE,startedAt:serverTimestamp(),lastSeenAt:serverTimestamp(),status:"active",game:null,selectedGame:null,currentScreen:"start-screen",lastEventType:"session_started",...environment(),schemaVersion:SCHEMA_VERSION});sessionReady=true;await track("session_started",null,"start-screen")}

function cleanGameLabel(game){return (game.querySelector("strong")?.textContent||game.childNodes[0]?.textContent||game.textContent||"").replace(/EN ESPERA|ANALIZANDO\.\.\.|ANALIZANDO COMPATIBILIDAD\.\.\.|✓ COMPATIBLE/g,"").trim()||"unknown"}
function bindEvents(){
 document.querySelectorAll(".game").forEach(game=>game.addEventListener("click",async()=>{requestLocation();selectedGame=cleanGameLabel(game);await track("game_selected",selectedGame,"start-screen");await updateSession({game:selectedGame,selectedGame})},{capture:true}));
 document.getElementById("continue-btn")?.addEventListener("click",async()=>{requestLocation();await track("continue_clicked",selectedGame,"start-screen");await updateSession({game:selectedGame,selectedGame,status:"in_progress"})},{capture:true});
 document.getElementById("restart-btn")?.addEventListener("click",()=>track("restart_clicked",selectedGame,"final-screen"),{capture:true});
 const screenEvents={"verify-screen":"verification_started","cmd-screen":"terminals_started","analysis-screen":"analysis_started","graph-screen":"correlation_map_viewed","consolidate-screen":"risk_consolidation_viewed","danger-screen":"educational_reveal_viewed","reflection-screen":"reflection_viewed","final-screen":"simulation_completed"};
 const observer=new MutationObserver(async()=>{const active=document.querySelector(".screen.active");if(!active||active.id===lastScreen)return;lastScreen=active.id;const eventType=screenEvents[active.id]||"screen_viewed";await track(eventType,selectedGame,active.id);await updateSession({game:selectedGame,selectedGame,currentScreen:active.id,status:active.id==="final-screen"?"completed":"in_progress",...(active.id==="final-screen"?{completedAt:serverTimestamp(),durationMs:Date.now()-startedAtMs}:{})})});
 document.querySelectorAll(".screen").forEach(el=>observer.observe(el,{attributes:true,attributeFilter:["class"]}));
}

async function initialize(){try{const app=initializeApp(firebaseConfig);const auth=getAuth(app);db=getFirestore(app);authUser=(await signInAnonymously(auth)).user;await createSession();bindEvents()}catch(e){console.warn("CAA telemetry unavailable:",e?.code||e)}}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden"){track("session_hidden",selectedGame,lastScreen);updateSession({status:"inactive",currentScreen:lastScreen,game:selectedGame,selectedGame})}else if(sessionReady){track("session_resumed",selectedGame,lastScreen);updateSession({status:"active",currentScreen:lastScreen,game:selectedGame,selectedGame})}});
addEventListener("online",()=>track("connectivity_restored",null,lastScreen));
addEventListener("offline",()=>track("connectivity_lost",null,lastScreen));
initialize();