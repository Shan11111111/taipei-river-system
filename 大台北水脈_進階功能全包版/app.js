let map, riversData, selectedRiver = null, watchId = null, walkTimer = null, dangerTimer = null; let riverLayers = {}, poiLayers = {}, riskLayers = [], oldRiverLayer = null, userMarker = null, walkMarker = null; let currentRoute = [], walkIndex = 0, isPaused = false; const INTRO_SECONDS = 30, THRESHOLD = 900; const introScenes = [["淡水河：城市入海口", "淡水河串起台北盆地與海洋，是貿易、移民與城市發展的重要通道。"], ["大漢溪：山城水源與聚落", "大漢溪見證灌溉、防洪與城市擴張，也串起山區與都會。"], ["新店溪：生活與休憩", "新店溪連結碧潭與台北南側生活圈，是重要親水觀光空間。"], ["景美溪：日常城市走廊", "景美溪穿越文教與住宅區，呈現河流與居民生活的關係。"], ["基隆河：防災與治理", "基隆河的整治歷程，呈現台北在防洪與都市發展之間的平衡。"]]; const state = { badges: JSON.parse(localStorage.getItem("riverBadges") || "{}"), stats: JSON.parse(localStorage.getItem("riverStats") || '{"visitedRivers":{},"quizScore":0,"warnings":0}'), water: {} }; document.addEventListener("DOMContentLoaded", () => { id("startBtn").onclick = startIntro; id("directMapBtn").onclick = enterApp; id("skipIntroBtn").onclick = enterApp; id("voiceIntroBtn").onclick = () => speak("五條河流從山到海，串起台北的歷史、生活、防災與觀光記憶。"); id("gpsBtn").onclick = enableGPS; id("demoLocationBtn").onclick = useDemoLocation; id("backToMapBtn").onclick = backToMainMap; id("profileBtn").onclick = openProfile; id("layerBtn").onclick = () => id("layerPanel").classList.toggle("hidden"); id("simulateDangerBtn").onclick = () => simulateDanger(true); id("refreshWaterBtn").onclick = refreshWater; id("pauseWalkBtn").onclick = () => isPaused = true; id("resumeWalkBtn").onclick = () => isPaused = false; id("streetModeBtn").onclick = () => openStreetHeritagePanel(); id("closeStreetBtn").onclick = () => id("streetViewPanel").classList.add("hidden"); id("exportBtn").onclick = exportRecord; id("clearBadgesBtn").onclick = clearRecord;["toggleRivers", "togglePoi", "toggleRisk", "toggleOldRiver"].forEach(x => { id(x).onchange = applyLayerToggles }); document.querySelectorAll("[data-close]").forEach(b => b.onclick = () => closeModal(b.dataset.close)); if ("serviceWorker" in navigator) { navigator.serviceWorker.register("sw.js").catch(() => { }) } }); function id(x) { return document.getElementById(x) } function startIntro() { id("coverPage").classList.add("hidden"); id("introPage").classList.remove("hidden"); let start = Date.now(), last = -1; const t = setInterval(() => { let p = Math.min((Date.now() - start) / 1000 / INTRO_SECONDS, 1); id("introProgress").style.width = `${p * 100}%`; let idx = Math.min(Math.floor(p * introScenes.length), introScenes.length - 1); if (idx !== last) { last = idx; id("introTitle").textContent = introScenes[idx][0]; id("introText").textContent = introScenes[idx][1] } if (p >= 1) { clearInterval(t); enterApp() } }, 200) } async function enterApp() { id("introPage").classList.add("hidden"); id("coverPage").classList.add("hidden"); id("appPage").classList.remove("hidden"); if (!map) await initMap() } async function initMap() { map = L.map("map").setView([25.055, 121.525], 11); L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(map); riversData = await fetch("data/rivers.geojson").then(r => r.json()); riversData.features.forEach(f => state.water[f.properties.name] = { current: f.properties.currentWaterLevel, warning: f.properties.warningWaterLevel, danger: f.properties.dangerWaterLevel }); renderAll(); drawRivers(); drawRiskLayers(); drawOldRiverLayer(); startMonitor() } function renderAll() { renderRiverButtons(); renderWater(); renderBadges(); renderMissions() } function renderRiverButtons(active = "") { id("riverList").innerHTML = ""; riversData.features.forEach(f => { let p = f.properties, b = document.createElement("button"); b.className = `river-btn ${active === p.name ? "active" : ""}`; b.innerHTML = `<strong style="color:${p.color}">●</strong> ${p.name}<br><small>${p.short}</small>`; b.onclick = () => openRiver(p.name); id("riverList").appendChild(b) }) } function renderWater() { id("waterStatusList").innerHTML = ""; Object.entries(state.water).forEach(([n, w]) => { let safe = w.current < w.warning, row = document.createElement("div"); row.className = "water-row"; row.innerHTML = `<span>${safe ? "✅" : "⚠️"} ${n}</span><span>${w.current.toFixed(1)}m / ${w.warning.toFixed(1)}m</span>`; id("waterStatusList").appendChild(row) }) } function renderBadges() { let arr = Object.values(state.badges), b = id("badgeBoard"); b.innerHTML = arr.length ? "" : `<span class="empty-badge">尚未取得徽章。</span>`; arr.forEach(x => { let d = document.createElement("div"); d.className = "badge"; d.style.background = x.color; d.title = x.name; d.textContent = "🏅"; b.appendChild(d) }) } function renderMissions() { let total = 0; riversData?.features.forEach(f => total += f.properties.pois.length); let got = Object.keys(state.badges).length; id("missionList").innerHTML = `<div class="mission-row"><span>收集景點徽章</span><span>${got}/${total}</span></div><div class="mission-row"><span>已探索河流</span><span>${Object.keys(state.stats.visitedRivers).length}/5</span></div><div class="mission-row"><span>文化問答分數</span><span>${state.stats.quizScore}</span></div>` } function drawRivers() { L.geoJSON(riversData, { style: f => ({ color: f.properties.color, weight: 6, opacity: .95, className: "river-flow" }), onEachFeature: (f, l) => { let n = f.properties.name; riverLayers[n] = l; l.on("mouseover", () => { l.setStyle({ weight: 10, opacity: 1 }); l.bindTooltip(`<b>${n}</b><br>${f.properties.short}`, { sticky: true }).openTooltip() }); l.on("mouseout", () => { if (selectedRiver !== n) l.setStyle({ weight: 6, opacity: .95 }); l.closeTooltip() }); l.on("click", () => openRiver(n)) } }).addTo(map) } function drawRiskLayers() { riskLayers.forEach(x => map.removeLayer(x)); riskLayers = []; riversData.features.forEach(f => { let w = state.water[f.properties.name], danger = w.current >= w.warning; let coords = f.geometry.coordinates.map(c => [c[1], c[0]]); let circle = L.circle(coords[Math.floor(coords.length / 2)], { radius: danger ? 900 : 420, color: danger ? "#ef4444" : "#22c55e", fillColor: danger ? "#ef4444" : "#22c55e", fillOpacity: danger ? .14 : .06, weight: 1 }).addTo(map); riskLayers.push(circle) }) } function drawOldRiverLayer() { let old = { type: "FeatureCollection", features: riversData.features.map(f => ({ type: "Feature", properties: { name: f.properties.name + "古河道示意" }, geometry: { type: "LineString", coordinates: f.geometry.coordinates.map(c => [c[0] + .008, c[1] + .006]) } })) }; oldRiverLayer = L.geoJSON(old, { style: { color: "#facc15", weight: 3, opacity: .0, dashArray: "6 10" } }).addTo(map) } function applyLayerToggles() { Object.values(riverLayers).forEach(l => id("toggleRivers").checked ? l.addTo(map) : map.removeLayer(l)); Object.values(poiLayers).forEach(l => id("togglePoi").checked ? l.addTo(map) : map.removeLayer(l)); riskLayers.forEach(l => id("toggleRisk").checked ? l.addTo(map) : map.removeLayer(l)); if (oldRiverLayer) { oldRiverLayer.setStyle({ opacity: id("toggleOldRiver").checked ? .65 : 0 }) } } function enableGPS() { if (!navigator.geolocation) { setLoc("瀏覽器不支援定位，請使用示範位置。"); return } setLoc("正在取得 GPS，請允許定位。"); if (watchId) navigator.geolocation.clearWatch(watchId); watchId = navigator.geolocation.watchPosition(p => updateUserLocation(p.coords.latitude, p.coords.longitude, "GPS"), e => setLoc("定位失敗，請使用示範位置。"), { enableHighAccuracy: true, timeout: 12000, maximumAge: 8000 }) } function useDemoLocation() { updateUserLocation(25.0569, 121.5082, "示範位置") } function updateUserLocation(lat, lng, src) { if (!userMarker) { userMarker = L.marker([lat, lng], { icon: L.divIcon({ className: "", html: `<div class="user-dot"></div>`, iconSize: [28, 28], iconAnchor: [14, 14] }) }).addTo(map) } else userMarker.setLatLng([lat, lng]); let near = findNearestRiver(lat, lng); highlightRiver(near.riverName); setLoc(`${src}：目前接近「${near.riverName}」，距離約 ${Math.round(near.distance)} 公尺。`); map.setView([lat, lng], 14, { animate: true }); if (near.distance < THRESHOLD) checkPoiReal(lat, lng, near.riverName); checkLocationDanger(near.riverName) } function setLoc(t) { id("locationText").textContent = t } function findNearestRiver(lat, lng) { let best = { riverName: "", distance: Infinity }; riversData.features.forEach(f => { let cs = f.geometry.coordinates; for (let i = 0; i < cs.length - 1; i++) { let d = distancePointToSegmentMeters([lat, lng], [cs[i][1], cs[i][0]], [cs[i + 1][1], cs[i + 1][0]]); if (d < best.distance) best = { riverName: f.properties.name, distance: d } } }); return best } function highlightRiver(n) { selectedRiver = n; renderRiverButtons(n); Object.entries(riverLayers).forEach(([rn, l]) => { if (rn === n) { l.setStyle({ weight: 10, opacity: 1 }); l.bringToFront() } else l.setStyle({ weight: 4, opacity: .25 }) }); id("currentMode").textContent = `目前接近：${n}` } function openRiver(n) { selectedRiver = n; let f = riversData.features.find(x => x.properties.name === n), p = f.properties, w = state.water[n]; id("riverModalTitle").textContent = n; id("riverModalDesc").textContent = p.history; let box = id("riverSafetyBox"); if (w.current >= w.warning) { box.className = "safety-box safety-danger"; box.innerHTML = `⚠️ 目前水位 ${w.current.toFixed(1)}m，已達警戒水位 ${w.warning.toFixed(1)}m。請避免靠近河岸低窪區、親水步道與橋下空間。` } else { box.className = "safety-box safety-safe"; box.innerHTML = `✅ 目前水位 ${w.current.toFixed(1)}m，低於警戒水位 ${w.warning.toFixed(1)}m。祝你玩得愉快，也請留意現場告示。` } id("riverCultureBox").innerHTML = `<b>河流視角：</b>${p.culture}`; id("enterRiverBtn").onclick = () => { closeModal("riverModal"); enterWalk(n) }; id("speakRiverBtn").onclick = () => speak(`${n}。${p.history}`); openModal("riverModal") } function enterWalk(n) { selectedRiver = n; state.stats.visitedRivers[n] = Date.now(); saveStats(); renderMissions(); id("currentMode").textContent = `${n}｜河流視角導覽`; id("backToMapBtn").classList.remove("hidden"); id("walkPanel").classList.remove("hidden"); id("walkRiverName").textContent = `${n} 導覽中`; let f = riversData.features.find(x => x.properties.name === n), coords = f.geometry.coordinates.map(c => [c[1], c[0]]); currentRoute = interpolateRoute(coords, 160); walkIndex = 0; map.fitBounds(coords, { padding: [80, 80] }); Object.values(riverLayers).forEach(l => l.setStyle({ opacity: .18, weight: 4 })); riverLayers[n].setStyle({ opacity: 1, weight: 10 }); drawPoi(f.properties.pois); if (walkMarker) map.removeLayer(walkMarker); walkMarker = L.marker(currentRoute[0], { icon: L.divIcon({ className: "", html: `<div class="walk-marker"></div>`, iconSize: [28, 28], iconAnchor: [14, 14] }) }).addTo(map); isPaused = false; if (walkTimer) clearInterval(walkTimer); walkTimer = setInterval(() => { if (isPaused) return; walkIndex++; if (walkIndex >= currentRoute.length) { id("walkNarration").textContent = "本段河流導覽已完成。"; clearInterval(walkTimer); return } let pos = currentRoute[walkIndex]; walkMarker.setLatLng(pos); map.panTo(pos, { animate: true, duration: .7 }); id("walkNarration").textContent = `沿著 ${n} 前進中。靠近景點時會震動提醒並可取得徽章。`; checkPoiWalk(pos) }, 620) } function drawPoi(pois) { Object.values(poiLayers).forEach(l => map.removeLayer(l)); poiLayers = {}; pois.forEach(p => { let m = L.marker([p.lat, p.lng], { icon: L.divIcon({ className: "", html: `<div id="poi-${p.id}" class="poi-marker" style="background:${p.badgeColor}"></div>`, iconSize: [30, 30], iconAnchor: [15, 15] }) }).addTo(map); m.on("click", () => openPoi(p)); m.bindTooltip(p.name); poiLayers[p.id] = m }); applyLayerToggles() } function checkPoiWalk(pos) { let f = riversData.features.find(x => x.properties.name === selectedRiver); if (!f) return; f.properties.pois.forEach(p => updatePoiState(p, distanceMeters(pos[0], pos[1], p.lat, p.lng))) } function checkPoiReal(lat, lng, river) { let f = riversData.features.find(x => x.properties.name === river); if (!f) return; drawPoi(f.properties.pois); f.properties.pois.forEach(p => updatePoiState(p, distanceMeters(lat, lng, p.lat, p.lng))) } function updatePoiState(p, d) { let el = id(`poi-${p.id}`); if (d <= p.radius) { if (el) el.classList.add("nearby"); if (navigator.vibrate) navigator.vibrate(120); let r = tryBadge(p); if (r.acquired) id("walkNarration").textContent = `抵達 ${p.name} 附近，取得景點徽章！` } else if (el) el.classList.remove("nearby") } function openPoi(p) { id("poiModalTitle").textContent = p.name; id("poiModalStory").textContent = p.riverStory; let r = tryBadge(p); id("poiBadgeResult").innerHTML = r.acquired ? `🎉 取得景點徽章：<b style="color:${p.badgeColor}">${p.name}</b>` : `🏅 此景點徽章已取得。規則：同一景點 24 小時內只能取得一次。`; renderQuiz(p); openModal("poiModal"); openStreetHeritagePanel(p) } function renderQuiz(p) { id("quizBox").innerHTML = `<b>文化小問答：</b><p>${p.quiz.q}</p>${p.quiz.options.map((o, i) => `<button class="quiz-option" onclick="answerQuiz(${i},${p.quiz.answer})">${o}</button>`).join("")}<div id="quizResult"></div>` } function answerQuiz(i, a) { if (i === a) { state.stats.quizScore += 10; id("quizResult").textContent = "答對了！+10 分"; saveStats(); renderMissions() } else id("quizResult").textContent = "答錯了，可以再看看景點故事。" } function tryBadge(p) { let now = Date.now(), old = state.badges[p.id]; if (old && now - old.acquiredAt < 86400000) return { acquired: false }; if (!old) { state.badges[p.id] = { id: p.id, name: p.name, color: p.badgeColor, acquiredAt: now }; localStorage.setItem("riverBadges", JSON.stringify(state.badges)); renderBadges(); renderMissions(); return { acquired: true } } return { acquired: false } } function checkLocationDanger(river) { let w = state.water[river]; if (w && w.current >= w.warning) showDanger(river, w) } function refreshWater() { Object.values(state.water).forEach(w => w.current = Math.max(.7, w.current + (Math.random() - .45) * .35)); renderWater(); drawRiskLayers() } function simulateDanger(force = false) { let names = Object.keys(state.water), n = names[Math.floor(Math.random() * names.length)], w = state.water[n]; if (force || Math.random() < .35) { w.current = w.warning + Math.random() * 1.2; renderWater(); drawRiskLayers(); showDanger(n, w) } else refreshWater() } function showDanger(n, w) { state.stats.warnings++; saveStats(); id("dangerText").textContent = `${n} 目前水位升高至 ${w.current.toFixed(1)}m，已超過警戒水位 ${w.warning.toFixed(1)}m。請避免靠近河岸、低窪步道與親水區域。`; openModal("dangerModal"); if (navigator.vibrate) navigator.vibrate([200, 100, 200]) } function startMonitor() { if (dangerTimer) clearInterval(dangerTimer); dangerTimer = setInterval(() => simulateDanger(false), 20000) } function backToMainMap() { id("currentMode").textContent = "主地圖模式"; id("backToMapBtn").classList.add("hidden"); id("walkPanel").classList.add("hidden"); id("streetViewPanel").classList.add("hidden"); if (walkTimer) clearInterval(walkTimer); if (walkMarker) { map.removeLayer(walkMarker); walkMarker = null } Object.values(poiLayers).forEach(l => map.removeLayer(l)); poiLayers = {}; Object.values(riverLayers).forEach(l => l.setStyle({ opacity: .95, weight: 6 })); selectedRiver = null; renderRiverButtons(); map.setView([25.055, 121.525], 11) } function openProfile() { let b = id("profileBadgeBoard"), arr = Object.values(state.badges); b.innerHTML = arr.length ? "" : `<span class="empty-badge">尚未取得徽章。</span>`; arr.forEach(x => { let d = document.createElement("div"); d.className = "badge"; d.style.background = x.color; d.title = x.name; d.textContent = "🏅"; b.appendChild(d) }); id("profileStats").innerHTML = `<p>已取得徽章：${arr.length}</p><p>已探索河流：${Object.keys(state.stats.visitedRivers).length}</p><p>文化問答分數：${state.stats.quizScore}</p><p>水位警示次數：${state.stats.warnings}</p>`; openModal("profileModal") } function exportRecord() { let data = { badges: state.badges, stats: state.stats, exportedAt: new Date().toISOString() }; let blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), url = URL.createObjectURL(blob), a = id("downloadAnchor"); a.href = url; a.download = "taipei_river_journey_record.json"; a.click(); URL.revokeObjectURL(url) } function clearRecord() { state.badges = {}; state.stats = { visitedRivers: {}, quizScore: 0, warnings: 0 }; localStorage.removeItem("riverBadges"); saveStats(); renderAll(); openProfile() } function saveStats() { localStorage.setItem("riverStats", JSON.stringify(state.stats)) } function speak(t) { if (!("speechSynthesis" in window)) return; speechSynthesis.cancel(); let u = new SpeechSynthesisUtterance(t); u.lang = "zh-TW"; u.rate = 1; speechSynthesis.speak(u) } function interpolateRoute(points, steps) { let r = []; for (let i = 0; i < points.length - 1; i++) { let a = points[i], b = points[i + 1], c = Math.ceil(steps / (points.length - 1)); for (let s = 0; s < c; s++) { let t = s / c; r.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]) } } r.push(points[points.length - 1]); return r } function distanceMeters(lat1, lng1, lat2, lng2) { const R = 6371000, dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1), a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2; return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) } function distancePointToSegmentMeters(p, a, b) { let lat0 = p[0] * Math.PI / 180, x = lng => lng * Math.cos(lat0) * 111320, y = lat => lat * 110540, px = x(p[1]), py = y(p[0]), ax = x(a[1]), ay = y(a[0]), bx = x(b[1]), by = y(b[0]), dx = bx - ax, dy = by - ay; if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay); let t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy); t = Math.max(0, Math.min(1, t)); return Math.hypot(px - (ax + t * dx), py - (ay + t * dy)) } function toRad(v) { return v * Math.PI / 180 } function openModal(x) { id(x).classList.remove("hidden") } function closeModal(x) { id(x).classList.add("hidden") }


/* =========================
   真實水位 API 串接區
   資料來源：經濟部水利署 Open Data
========================= */
const WRA_REALTIME_WATER_URL =
  "https://opendata.wra.gov.tw/api/v2/73c4c3de-4045-4765-abeb-89f9f9cd5ff0?format=JSON&sort=_importdate+asc";
const WRA_STATION_STATUS_URL =
  "https://opendata.wra.gov.tw/api/v2/c4acc691-7416-40ca-9464-292c0c00da92?format=JSON&sort=_importdate+asc";

function normalizeWraRows(raw) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw?.Data)) return raw.Data;
  if (Array.isArray(raw?.records)) return raw.records;
  if (Array.isArray(raw?.Records)) return raw.Records;
  if (Array.isArray(raw?.result?.records)) return raw.result.records;
  if (Array.isArray(raw?.responseData)) return raw.responseData;
  if (Array.isArray(raw?.responseData?.data)) return raw.responseData.data;
  if (raw && typeof raw === "object") {
    for (const key of Object.keys(raw)) {
      if (Array.isArray(raw[key])) return raw[key];
    }
  }
  return [];
}

function getField(row, names) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null && row[name] !== "") return row[name];
    const foundKey = Object.keys(row).find(k => k.toLowerCase() === name.toLowerCase());
    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && row[foundKey] !== "") return row[foundKey];
  }
  return null;
}

function toNumberOrNull(v) {
  if (v === null || v === undefined) return null;
  const n = Number(String(v).replace(",", "").trim());
  return Number.isFinite(n) ? n : null;
}

function sameRiverName(sourceName, targetName) {
  if (!sourceName || !targetName) return false;
  const s = String(sourceName).trim();
  const t = String(targetName).trim();
  if (s.includes(t) || t.includes(s)) return true;
  const aliases = {
    "淡水河": ["淡水河", "淡水河系"],
    "大漢溪": ["大漢溪"],
    "新店溪": ["新店溪"],
    "景美溪": ["景美溪"],
    "基隆河": ["基隆河"]
  };
  return (aliases[targetName] || [targetName]).some(a => s.includes(a));
}

async function fetchRealWraWaterLevels() {
  const [stationRaw, realtimeRaw] = await Promise.all([
    fetch(WRA_STATION_STATUS_URL, { cache: "no-store" }).then(r => {
      if (!r.ok) throw new Error("測站站況 API 回應失敗：" + r.status);
      return r.json();
    }),
    fetch(WRA_REALTIME_WATER_URL, { cache: "no-store" }).then(r => {
      if (!r.ok) throw new Error("即時水位 API 回應失敗：" + r.status);
      return r.json();
    })
  ]);

  const stationRows = normalizeWraRows(stationRaw);
  const realtimeRows = normalizeWraRows(realtimeRaw);
  const realtimeByStation = new Map();

  for (const row of realtimeRows) {
    const stationId = String(getField(row, ["stationid", "StationID", "observatoryidentifier"]) || "").trim();
    const waterlevel = toNumberOrNull(getField(row, ["waterlevel", "WaterLevel"]));
    const datetime = String(getField(row, ["datetime", "DateTime", "time"]) || "");
    if (!stationId || waterlevel === null) continue;
    const prev = realtimeByStation.get(stationId);
    if (!prev || String(datetime) > String(prev.datetime || "")) {
      realtimeByStation.set(stationId, { waterlevel, datetime, raw: row });
    }
  }

  const result = {};
  const riverNames = Object.keys(state.water || {});

  for (const riverName of riverNames) {
    const candidates = [];
    for (const st of stationRows) {
      const river = getField(st, ["rivername", "RiverName", "affiliatedbasin"]);
      const stationId = String(getField(st, ["observatoryidentifier", "stationid", "StationID"]) || "").trim();
      if (!stationId || !sameRiverName(river, riverName)) continue;
      const realtime = realtimeByStation.get(stationId);
      if (!realtime) continue;
      const alert3 = toNumberOrNull(getField(st, ["alertlevel3", "AlertLevel3"]));
      const alert2 = toNumberOrNull(getField(st, ["alertlevel2", "AlertLevel2"]));
      const alert1 = toNumberOrNull(getField(st, ["alertlevel1", "AlertLevel1"]));
      const warning = alert3 ?? alert2 ?? alert1 ?? state.water[riverName]?.warning ?? 3;
      candidates.push({
        riverName,
        stationId,
        stationName: getField(st, ["observatoryname", "StationName", "stationname"]) || stationId,
        waterlevel: realtime.waterlevel,
        datetime: realtime.datetime,
        warning,
        danger: alert1 ?? alert2 ?? warning + 0.8
      });
    }
    candidates.sort((a, b) => {
      const timeDiff = String(b.datetime).localeCompare(String(a.datetime));
      if (timeDiff !== 0) return timeDiff;
      return (b.waterlevel / Math.max(b.warning, 0.1)) - (a.waterlevel / Math.max(a.warning, 0.1));
    });
    if (candidates[0]) result[riverName] = candidates[0];
  }
  return result;
}

async function refreshWater() {
  const oldText = id("currentMode")?.textContent || "主地圖模式";
  if (id("currentMode")) id("currentMode").textContent = "正在更新水利署即時水位資料...";
  try {
    const real = await fetchRealWraWaterLevels();
    let count = 0;
    for (const [riverName, info] of Object.entries(real)) {
      if (!state.water[riverName]) continue;
      state.water[riverName].current = info.waterlevel;
      state.water[riverName].warning = info.warning;
      state.water[riverName].danger = info.danger;
      state.water[riverName].stationName = info.stationName;
      state.water[riverName].stationId = info.stationId;
      state.water[riverName].datetime = info.datetime;
      state.water[riverName].isReal = true;
      count++;
    }
    renderWater();
    drawRiskLayers();
    if (id("currentMode")) id("currentMode").textContent = count > 0 ? `已更新真實水位資料：${count} 條水系` : "API 有回應，但五大水系沒有匹配到測站，保留展示水位";
    return count;
  } catch (err) {
    console.warn("[WRA API] 真實水位取得失敗，改用展示資料：", err);
    Object.values(state.water).forEach(w => {
      w.current = Math.max(.7, w.current + (Math.random() - .45) * .35);
      w.isReal = false;
    });
    renderWater();
    drawRiskLayers();
    if (id("currentMode")) id("currentMode").textContent = oldText + "｜API 暫時無法取得，使用展示水位";
    return 0;
  }
}

function renderWater() {
  const box = id("waterStatusList");
  if (!box) return;
  box.innerHTML = "";
  Object.entries(state.water).forEach(([n, w]) => {
    const safe = Number(w.current) < Number(w.warning);
    const row = document.createElement("div");
    row.className = "water-row";
    const source = w.isReal ? "真實資料" : "展示資料";
    const station = w.stationName ? `｜${w.stationName}` : "";
    const time = w.datetime ? `<br><small>${source}${station}｜${w.datetime}</small>` : `<br><small>${source}</small>`;
    row.innerHTML = `<span>${safe ? "✅" : "⚠️"} ${n}${time}</span><span>${Number(w.current).toFixed(2)}m / 警戒 ${Number(w.warning).toFixed(2)}m</span>`;
    box.appendChild(row);
  });
}

async function startRealWaterAutoUpdate() {
  await refreshWater();
  setInterval(refreshWater, 10 * 60 * 1000);
}

setTimeout(() => {
  if (typeof state !== "undefined" && typeof refreshWater === "function") {
    startRealWaterAutoUpdate();
  }
}, 1500);



/* 修正版：河岸視角導覽卡，不再假裝是真街景 */
function openRiverPerspectivePanel() {
  const panel = id("streetViewPanel");
  if (!panel) return;

  const riverName = selectedRiver || "淡水河";
  const feature = riversData?.features?.find(f => f.properties.name === riverName);
  const p = feature?.properties || {};

  const water = state?.water?.[riverName];
  const safeText = water
    ? (water.current >= water.warning
      ? `⚠️ 目前 ${riverName} 水位偏高，建議不要靠近親水步道。`
      : `✅ 目前 ${riverName} 水位低於警戒值，可作為安全導覽示意。`)
    : "目前尚未取得水位資料。";

  const poiNames = (p.pois || []).map(x => x.name).join("、") || "河岸景點";

  const title = id("riverViewTitle");
  const subtitle = id("riverViewSubtitle");
  const caption = id("streetCaption");
  const info = id("riverViewInfo");
  const glow = id("riverViewGlow");

  if (title) title.textContent = `${riverName}｜河岸視角`;
  if (subtitle) subtitle.textContent = p.short || "從河流重新理解城市空間。";
  if (caption) {
    caption.textContent = p.culture || p.history || "從河流視角觀看城市，能看見不同於道路與行政區的空間故事。";
  }
  if (info) {
    info.innerHTML = `
      <b>附近景點：</b>${poiNames}<br>
      <b>安全提示：</b>${safeText}<br>
      <b>展示說明：</b>此模式不是 Google Street View，而是課堂展示用的河岸導覽視角卡，可替換成真實影片、360 圖或現地照片。
    `;
  }
  if (glow && p.color) {
    glow.style.background = `radial-gradient(circle at 70% 28%, ${p.color}55, transparent 26%)`;
  }

  panel.classList.remove("hidden");
}



/* =========================
   真街景古蹟導覽功能
   使用 Google Maps Street View Embed，不需要 API Key。
   如果某點沒有街景，Google 會自動顯示附近可用街景或地圖畫面。
========================= */

let currentStreetViewUrl = "";

function buildStreetViewUrl(lat, lng, heading = 0, pitch = 0) {
  return `https://www.google.com/maps?layer=c&cbll=${lat},${lng}&cbp=12,${heading},${pitch},0,0&output=svembed`;
}

function buildGoogleMapsUrl(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function getRiverFeatureByName(name) {
  return riversData?.features?.find(f => f.properties.name === name);
}

function getDefaultPoiForRiver(riverName) {
  const f = getRiverFeatureByName(riverName);
  return f?.properties?.pois?.[0] || null;
}

function openStreetHeritagePanel(poi = null) {
  const riverName = selectedRiver || "淡水河";
  const feature = getRiverFeatureByName(riverName);
  const river = feature?.properties || {};
  const targetPoi = poi || getDefaultPoiForRiver(riverName);

  if (!targetPoi) return;

  const lat = targetPoi.streetLat || targetPoi.lat;
  const lng = targetPoi.streetLng || targetPoi.lng;
  const heading = targetPoi.heading || 0;
  const pitch = targetPoi.pitch || 0;

  const frame = id("streetViewFrame");
  const panel = id("streetViewPanel");
  const title = id("streetViewTitle");
  const caption = id("streetCaption");
  const info = id("riverViewInfo");
  const list = id("heritageHotspotList");
  const googleBtn = id("openGoogleMapBtn");

  currentStreetViewUrl = buildGoogleMapsUrl(lat, lng);

  if (frame) frame.src = buildStreetViewUrl(lat, lng, heading, pitch);
  if (title) title.textContent = `${targetPoi.name}｜街景古蹟導覽`;
  if (caption) caption.textContent = targetPoi.riverStory || river.history || "從河流視角觀看附近文化景點。";

  const water = state?.water?.[riverName];
  const waterText = water
    ? (water.current >= water.warning
      ? `⚠️ ${riverName} 目前水位 ${Number(water.current).toFixed(2)}m，已達警戒，請勿靠近河岸。`
      : `✅ ${riverName} 目前水位 ${Number(water.current).toFixed(2)}m，低於警戒值。`)
    : "尚未取得水位資料。";

  if (info) {
    info.innerHTML = `
      <b>古蹟/景點：</b>${targetPoi.heritageTitle || targetPoi.name}<br>
      <b>河流視角故事：</b>${targetPoi.heritageStory || targetPoi.riverStory || "此處可從河流角度理解城市與文化景觀。"}<br>
      <b>水位安全：</b>${waterText}
    `;
  }

  if (list) {
    const pois = river.pois || [];
    list.innerHTML = pois.map(p => `
      <div class="heritage-card" onclick="openStreetHeritagePanelById('${p.id}')">
        <strong>${p.heritageTitle || p.name}</strong>
        <small>${p.heritageStory || p.riverStory || ""}</small>
      </div>
    `).join("");
  }

  if (googleBtn) {
    googleBtn.onclick = () => window.open(currentStreetViewUrl, "_blank");
  }

  panel?.classList.remove("hidden");
}

function openStreetHeritagePanelById(poiId) {
  const riverName = selectedRiver || "淡水河";
  const feature = getRiverFeatureByName(riverName);
  const poi = feature?.properties?.pois?.find(p => p.id === poiId);
  if (poi) openStreetHeritagePanel(poi);
}

// 舊函式保留相容，讓原本按鈕也能開真街景。
function openRiverPerspectivePanel() {
  openStreetHeritagePanel();
}



/* =========================
   測站匹配修正版
   問題：
   水利署 API 可能不會剛好用「淡水河 / 大漢溪 / 新店溪 / 景美溪 / 基隆河」
   當 rivername，因此只比河名會出現「API 有回應，但五大水系沒有匹配到測站」。

   修正：
   同時用「河名 alias + 代表測站關鍵字 + 全欄位文字」做比對。
========================= */

const RIVER_MATCH_RULES = {
  "淡水河": {
    riverKeywords: ["淡水河", "淡水河系", "淡水河流域"],
    stationKeywords: ["淡水河橋", "關渡", "社子", "台北橋", "忠孝橋", "重陽橋"]
  },
  "大漢溪": {
    riverKeywords: ["大漢溪", "淡水河系"],
    stationKeywords: ["浮洲橋", "新海橋", "三鶯大橋", "城林橋", "柑園橋", "大漢橋"]
  },
  "新店溪": {
    riverKeywords: ["新店溪", "淡水河系", "新店"],
    stationKeywords: [
      "秀朗橋",
      "中正橋",
      "碧潭",
      "新店",
      "寶橋",
      "溪洲",
      "屈尺堰"
    ]
  },
  "景美溪": {
    riverKeywords: ["景美溪", "淡水河系"],
    stationKeywords: ["景美", "景美橋", "寶橋", "木柵", "道南橋"]
  },
  "基隆河": {
    riverKeywords: ["基隆河", "淡水河系", "基隆"],
    stationKeywords: [
      "南湖大橋",
      "大直橋",
      "成美橋",
      "社后橋",
      "五堵",
      "汐止",
      "瑞芳"
    ]
  },
};

function rowToSearchText(row) {
  if (!row || typeof row !== "object") return "";
  return Object.entries(row)
    .map(([k, v]) => `${k}:${v}`)
    .join(" ")
    .replace(/\s+/g, "");
}

function matchStationToRiver(row, riverName) {
  const rule = RIVER_MATCH_RULES[riverName];
  if (!rule) return false;

  const text = JSON.stringify(row);

  const riverHit =
    rule.riverKeywords.some(k => text.includes(k));

  const stationHit =
    rule.stationKeywords.some(k => text.includes(k));

  return riverHit || stationHit;
}

function pickStationId(row) {
  return String(
    getField(row, [
      "stationid",
      "StationID",
      "StationId",
      "observatoryidentifier",
      "ObservatoryIdentifier",
      "ObservatoryID",
      "station_id"
    ]) || ""
  ).trim();
}

function pickStationName(row) {
  return String(
    getField(row, [
      "observatoryname",
      "ObservatoryName",
      "stationname",
      "StationName",
      "chinesename",
      "ChineseName",
      "englishname",
      "EnglishName",
      "locationdescription",
      "LocationDescription",
      "location",
      "Location",
      "name",
      "Name"
    ]) || ""
  ).trim();
}

function pickRiverName(row) {
  return String(
    getField(row, [
      "rivername",
      "RiverName",
      "mainstreamname",
      "MainStreamName",
      "affiliatedbasin",
      "AffiliatedBasin",
      "basinname",
      "BasinName",
      "locationdescription",
      "LocationDescription",
      "observatoryname",
      "ObservatoryName"
    ]) || ""
  ).trim();
}

function pickDateTime(row) {
  return String(
    getField(row, [
      "datetime",
      "DateTime",
      "time",
      "Time",
      "observedtime",
      "ObservedTime",
      "recordtime",
      "RecordTime"
    ]) || ""
  ).trim();
}

/**
 * 覆蓋前一版 fetchRealWraWaterLevels。
 * 這版比較穩：先建即時水位 stationId map，再用測站資料「全欄位」找河流代表測站。
 */
async function fetchRealWraWaterLevels() {
  const [stationRaw, realtimeRaw] = await Promise.all([
    fetch(WRA_STATION_STATUS_URL, { cache: "no-store" }).then(r => {
      if (!r.ok) throw new Error("測站站況 API 回應失敗：" + r.status);
      return r.json();
    }),
    fetch(WRA_REALTIME_WATER_URL, { cache: "no-store" }).then(r => {
      if (!r.ok) throw new Error("即時水位 API 回應失敗：" + r.status);
      return r.json();
    })
  ]);

  const stationRows = normalizeWraRows(stationRaw);
  const realtimeRows = normalizeWraRows(realtimeRaw);

  console.log("[WRA] stationRows:", stationRows.length, "realtimeRows:", realtimeRows.length);

  const realtimeByStation = new Map();

  for (const row of realtimeRows) {
    const stationId = pickStationId(row);
    if (!stationId) continue;

    const waterlevel = toNumberOrNull(getField(row, ["waterlevel", "WaterLevel", "stage", "Stage"]));
    const datetime = pickDateTime(row);

    if (waterlevel === null) continue;

    const prev = realtimeByStation.get(stationId);
    if (!prev || String(datetime) > String(prev.datetime || "")) {
      realtimeByStation.set(stationId, { waterlevel, datetime, raw: row });
    }
  }

  const result = {};
  const matchedDebug = [];

  for (const riverName of Object.keys(state.water)) {
    const candidates = [];

    for (const st of stationRows) {
      const stationId = pickStationId(st);
      if (!stationId) continue;
      if (!matchStationToRiver(st, riverName)) continue;

      const realtime = realtimeByStation.get(stationId);
      if (!realtime) continue;

      const alert3 = toNumberOrNull(getField(st, ["alertlevel3", "AlertLevel3"]));
      const alert2 = toNumberOrNull(getField(st, ["alertlevel2", "AlertLevel2"]));
      const alert1 = toNumberOrNull(getField(st, ["alertlevel1", "AlertLevel1"]));

      // 三級通常是較低警戒門檻；若沒有則往二級/一級拿。
      const warning = alert3 ?? alert2 ?? alert1 ?? state.water[riverName]?.warning ?? 3;
      const danger = alert1 ?? alert2 ?? alert3 ?? (warning + 0.8);

      candidates.push({
        riverName,
        stationId,
        stationName: pickStationName(st) || stationId,
        apiRiverName: pickRiverName(st),
        waterlevel: realtime.waterlevel,
        datetime: realtime.datetime,
        warning,
        danger,
        rawStation: st
      });
    }

    // 排序：最新優先；同時間取水位 / 警戒比例最高者，偏保守。
    candidates.sort((a, b) => {
      const timeDiff = String(b.datetime || "").localeCompare(String(a.datetime || ""));
      if (timeDiff !== 0) return timeDiff;
      return (b.waterlevel / Math.max(b.warning, 0.1)) - (a.waterlevel / Math.max(a.warning, 0.1));
    });

    if (candidates[0]) {
      result[riverName] = candidates[0];
      matchedDebug.push({
        river: riverName,
        station: candidates[0].stationName,
        stationId: candidates[0].stationId,
        apiRiverName: candidates[0].apiRiverName,
        waterlevel: candidates[0].waterlevel,
        warning: candidates[0].warning,
        time: candidates[0].datetime
      });
    }
  }

  console.table(matchedDebug);

  return result;
}

/**
 * 覆蓋 refreshWater：訊息寫清楚，方便你 demo 時知道到底發生什麼。
 */
async function refreshWater() {
  const oldText = id("currentMode").textContent;
  id("currentMode").textContent = "正在更新水利署即時水位資料...";

  try {
    const real = await fetchRealWraWaterLevels();
    let count = 0;

    for (const [riverName, info] of Object.entries(real)) {
      if (!state.water[riverName]) continue;

      state.water[riverName].current = info.waterlevel;
      state.water[riverName].warning = info.warning;
      state.water[riverName].danger = info.danger;
      state.water[riverName].stationName = info.stationName;
      state.water[riverName].stationId = info.stationId;
      state.water[riverName].datetime = info.datetime;
      state.water[riverName].isReal = true;
      count++;
    }

    renderWater();
    drawRiskLayers();

    if (count > 0) {
      id("currentMode").textContent = `已匹配 ${count}/5 條水系真實測站水位`;
    } else {
      id("currentMode").textContent = "API 有回應，但仍未匹配到五大水系測站；請看 Console 的 WRA 資料欄位";
      console.warn("[WRA] API 有回應，但沒有匹配到五大水系。請檢查 stationRows 欄位與 RIVER_MATCH_RULES。");
    }

    return count;
  } catch (err) {
    console.warn("[WRA API] 真實水位取得失敗，改用展示資料：", err);

    Object.values(state.water).forEach(w => {
      w.current = Math.max(.7, w.current + (Math.random() - .45) * .35);
      w.isReal = false;
    });

    renderWater();
    drawRiskLayers();

    id("currentMode").textContent = oldText + "｜API 暫時無法取得，使用展示水位";
    return 0;
  }
}

/* ===== 修正：等 riversData 載入後才更新水位，避免 features undefined ===== */

function drawRiskLayers() {
  if (!map || !riversData || !Array.isArray(riversData.features)) {
    console.warn("[drawRiskLayers] riversData 尚未載入，略過風險圖層繪製");
    return;
  }

  riskLayers.forEach(x => {
    try {
      map.removeLayer(x);
    } catch (e) { }
  });

  riskLayers = [];

  riversData.features.forEach(f => {
    const w = state.water[f.properties.name];

    if (!w) return;

    const danger = Number(w.current) >= Number(w.warning);
    const coords = f.geometry.coordinates.map(c => [c[1], c[0]]);

    const circle = L.circle(coords[Math.floor(coords.length / 2)], {
      radius: danger ? 900 : 420,
      color: danger ? "#ef4444" : "#22c55e",
      fillColor: danger ? "#ef4444" : "#22c55e",
      fillOpacity: danger ? 0.14 : 0.06,
      weight: 1
    }).addTo(map);

    riskLayers.push(circle);
  });
}

async function startRealWaterAutoUpdate() {
  if (
    !map ||
    !riversData ||
    !Array.isArray(riversData.features) ||
    !state.water ||
    Object.keys(state.water).length === 0
  ) {
    console.warn("[WRA] riversData/state.water 尚未完成，暫不更新水位。");
    return;
  }

  await refreshWater();
  setInterval(refreshWater, 10 * 60 * 1000);
}

function startRealWaterAutoUpdateWhenReady(retry = 0) {
  if (
    typeof state !== "undefined" &&
    typeof refreshWater === "function" &&
    typeof riversData !== "undefined" &&
    riversData &&
    Array.isArray(riversData.features) &&
    map
  ) {
    startRealWaterAutoUpdate();
    return;
  }

  if (retry < 20) {
    setTimeout(() => startRealWaterAutoUpdateWhenReady(retry + 1), 500);
  } else {
    console.warn("[WRA] 地圖或 riversData 尚未完成載入，略過自動更新水位。可手動按「刷新水位」。");
  }
}

setTimeout(() => startRealWaterAutoUpdateWhenReady(), 3000);

/* ===== 修正：水利署測站 ID 欄位補強版 ===== */

function pickStationId(row) {
  return String(
    getField(row, [
      "stationid",
      "StationID",
      "StationId",

      "observatoryidentifier",
      "ObservatoryIdentifier",
      "ObservatoryID",

      "basinidentifier",
      "BasinIdentifier",

      "waterresourceidentifier",
      "WaterResourceIdentifier",

      "identifier",
      "Identifier",
      "id",
      "ID"
    ]) || ""
  ).trim();
}

function pickStationName(row) {
  return String(
    getField(row, [
      "observatoryname",
      "ObservatoryName",

      "stationname",
      "StationName",

      "chinesename",
      "ChineseName",

      "name",
      "Name",

      "englishname",
      "EnglishName",

      "locationdescription",
      "LocationDescription"
    ]) || ""
  ).trim();
}

function pickRiverName(row) {
  return String(
    getField(row, [
      "rivername",
      "RiverName",

      "mainstreamname",
      "MainStreamName",

      "affiliatedbasin",
      "AffiliatedBasin",

      "affiliatedsubsidiarybasinrivercode",
      "AffiliatedSubsidiaryBasinRiverCode",

      "affiliatedsubsubsidiarybasinrivercode",
      "AffiliatedSubSubsidiaryBasinRiverCode",

      "basinname",
      "BasinName",

      "locationdescription",
      "LocationDescription",

      "observatoryname",
      "ObservatoryName",

      "englishname",
      "EnglishName"
    ]) || ""
  ).trim();
}

function matchStationToRiver(row, riverName) {
  const rule = RIVER_MATCH_RULES[riverName];
  if (!rule) return false;

  const text = JSON.stringify(row).replace(/\s+/g, "");

  const riverHit = rule.riverKeywords.some(k => text.includes(k));
  const stationHit = rule.stationKeywords.some(k => text.includes(k));

  return riverHit || stationHit;
}

/* ===== 終極修正版：水利署資料自動找共同 ID / 共同欄位 ===== */

function getAllTextValues(row) {
  if (!row || typeof row !== "object") return [];

  return Object.values(row)
    .map(v => String(v ?? "").trim())
    .filter(v =>
      v &&
      v !== "0" &&
      v !== "''" &&
      v !== "null" &&
      v !== "undefined" &&
      v.length >= 2 &&
      v.length <= 40
    );
}

function buildRealtimeIndex(realtimeRows) {
  const map = new Map();

  for (const row of realtimeRows) {
    const waterlevel = toNumberOrNull(
      getField(row, [
        "waterlevel",
        "WaterLevel",
        "stage",
        "Stage",
        "value",
        "Value"
      ])
    );

    if (waterlevel === null) continue;

    const datetime = pickDateTime(row);

    const values = getAllTextValues(row);

    values.forEach(v => {
      if (!map.has(v)) {
        map.set(v, []);
      }

      map.get(v).push({
        waterlevel,
        datetime,
        raw: row
      });
    });
  }

  return map;
}

function findRealtimeForStation(stationRow, realtimeIndex) {
  const values = getAllTextValues(stationRow);

  for (const v of values) {
    if (realtimeIndex.has(v)) {
      const list = realtimeIndex.get(v);

      list.sort((a, b) =>
        String(b.datetime || "").localeCompare(String(a.datetime || ""))
      );

      return list[0];
    }
  }

  return null;
}

function getStationSearchText(row) {
  return JSON.stringify(row).replace(/\s+/g, "");
}

function matchStationToRiver(row, riverName) {
  const rule = RIVER_MATCH_RULES[riverName];
  if (!rule) return false;

  const text = getStationSearchText(row);

  return (
    rule.riverKeywords.some(k => text.includes(k)) ||
    rule.stationKeywords.some(k => text.includes(k))
  );
}

async function fetchRealWraWaterLevels() {
  const [stationRaw, realtimeRaw] = await Promise.all([
    fetch(WRA_STATION_STATUS_URL, { cache: "no-store" }).then(r => {
      if (!r.ok) throw new Error("測站站況 API 回應失敗：" + r.status);
      return r.json();
    }),
    fetch(WRA_REALTIME_WATER_URL, { cache: "no-store" }).then(r => {
      if (!r.ok) throw new Error("即時水位 API 回應失敗：" + r.status);
      return r.json();
    })
  ]);

  const stationRows = normalizeWraRows(stationRaw);
  const realtimeRows = normalizeWraRows(realtimeRaw);

  console.log("[WRA] stationRows:", stationRows.length, "realtimeRows:", realtimeRows.length);
  console.log("[WRA] station 第一筆欄位：", Object.keys(stationRows[0] || {}));
  console.log("[WRA] realtime 第一筆欄位：", Object.keys(realtimeRows[0] || {}));
  console.table(realtimeRows.slice(0, 10));

  const realtimeIndex = buildRealtimeIndex(realtimeRows);

  const result = {};
  const matchedDebug = [];

  for (const riverName of Object.keys(state.water)) {
    const candidates = [];

    for (const st of stationRows) {
      if (!matchStationToRiver(st, riverName)) continue;

      const realtime = findRealtimeForStation(st, realtimeIndex);
      if (!realtime) continue;

      const alert3 = toNumberOrNull(getField(st, ["alertlevel3", "AlertLevel3"]));
      const alert2 = toNumberOrNull(getField(st, ["alertlevel2", "AlertLevel2"]));
      const alert1 = toNumberOrNull(getField(st, ["alertlevel1", "AlertLevel1"]));

      const warning =
        alert3 ??
        alert2 ??
        alert1 ??
        state.water[riverName]?.warning ??
        3;

      const danger =
        alert1 ??
        alert2 ??
        alert3 ??
        warning + 0.8;

      candidates.push({
        riverName,
        stationName: pickStationName(st) || "未命名測站",
        stationId: pickStationId(st) || "未取得ID",
        apiRiverName: pickRiverName(st),
        waterlevel: realtime.waterlevel,
        datetime: realtime.datetime,
        warning,
        danger,
        rawStation: st,
        rawRealtime: realtime.raw
      });
    }

    candidates.sort((a, b) => {
      const timeDiff = String(b.datetime || "").localeCompare(String(a.datetime || ""));
      if (timeDiff !== 0) return timeDiff;

      return (
        b.waterlevel / Math.max(b.warning, 0.1) -
        a.waterlevel / Math.max(a.warning, 0.1)
      );
    });

    if (candidates[0]) {
      result[riverName] = candidates[0];

      matchedDebug.push({
        river: riverName,
        station: candidates[0].stationName,
        stationId: candidates[0].stationId,
        apiRiverName: candidates[0].apiRiverName,
        waterlevel: candidates[0].waterlevel,
        warning: candidates[0].warning,
        time: candidates[0].datetime
      });
    }
  }

  console.table(matchedDebug);

  return result;
}

async function refreshWater() {
  const oldText = id("currentMode")?.textContent || "主地圖模式";

  if (id("currentMode")) {
    id("currentMode").textContent = "正在更新水利署即時水位資料...";
  }

  try {
    const real = await fetchRealWraWaterLevels();
    let count = 0;

    for (const [riverName, info] of Object.entries(real)) {
      if (!state.water[riverName]) continue;

      state.water[riverName].current = info.waterlevel;
      state.water[riverName].warning = info.warning;
      state.water[riverName].danger = info.danger;
      state.water[riverName].stationName = info.stationName;
      state.water[riverName].stationId = info.stationId;
      state.water[riverName].datetime = info.datetime;
      state.water[riverName].isReal = true;

      count++;
    }

    renderWater();
    drawRiskLayers();

    if (id("currentMode")) {
      id("currentMode").textContent =
        count > 0
          ? `已匹配 ${count}/5 條水系真實測站水位`
          : "API 有回應，但仍未匹配到五大水系測站；請看 Console 的 realtime 欄位";
    }

    if (count === 0) {
      console.warn("[WRA] 還是沒有匹配到。請截圖 realtime 第一筆欄位與 console.table(realtimeRows.slice(0,10))。");
    }

    return count;
  } catch (err) {
    console.warn("[WRA API] 真實水位取得失敗，改用展示資料：", err);

    Object.values(state.water).forEach(w => {
      w.current = Math.max(0.7, w.current + (Math.random() - 0.45) * 0.35);
      w.isReal = false;
    });

    renderWater();
    drawRiskLayers();

    if (id("currentMode")) {
      id("currentMode").textContent =
        oldText + "｜API 暫時無法取得，使用展示水位";
    }

    return 0;
  }
}
/* ===== 水利署 API v2 觀測資料格式修正版：支援 observationitems / observationdatetime ===== */

function pickWaterLevel(row) {
  // 1. 先抓常見水位欄位
  const direct = toNumberOrNull(
    getField(row, [
      "waterlevel",
      "WaterLevel",
      "waterLevel",
      "stage",
      "Stage",
      "value",
      "Value",
      "observationvalue",
      "ObservationValue",
      "observedvalue",
      "ObservedValue",
      "result",
      "Result"
    ])
  );

  if (direct !== null) return direct;

  // 2. 水利署 v2 有時會把觀測項目包在 observationitems
  const items =
    row.observationitems ||
    row.ObservationItems ||
    row.observationItems ||
    row.observationitem ||
    row.ObservationItem;

  if (Array.isArray(items)) {
    for (const item of items) {
      const text = JSON.stringify(item);

      if (
        text.includes("水位") ||
        text.toLowerCase().includes("waterlevel") ||
        text.toLowerCase().includes("stage")
      ) {
        const v = toNumberOrNull(
          getField(item, [
            "value",
            "Value",
            "observationvalue",
            "ObservationValue",
            "observedvalue",
            "ObservedValue",
            "result",
            "Result"
          ])
        );

        if (v !== null) return v;
      }
    }
  }

  // 3. 如果 observationitems 是字串，也試著從裡面抓數字
  if (typeof items === "string") {
    const match = items.match(/-?\d+(\.\d+)?/);
    if (match) return Number(match[0]);
  }

  return null;
}

function pickDateTime(row) {
  return String(
    getField(row, [
      "datetime",
      "DateTime",
      "time",
      "Time",
      "observedtime",
      "ObservedTime",
      "recordtime",
      "RecordTime",
      "observationdatetime",
      "ObservationDateTime",
      "observationDateTime"
    ]) || ""
  ).trim();
}

function pickStationId(row) {
  return String(
    getField(row, [
      "stationid",
      "StationID",
      "StationId",
      "observatoryidentifier",
      "ObservatoryIdentifier",
      "ObservatoryID",
      "basinidentifier",
      "BasinIdentifier",
      "waterresourceidentifier",
      "WaterResourceIdentifier",
      "identifier",
      "Identifier",
      "id",
      "ID"
    ]) || ""
  ).trim();
}

function pickStationName(row) {
  return String(
    getField(row, [
      "observatoryname",
      "ObservatoryName",
      "stationname",
      "StationName",
      "chinesename",
      "ChineseName",
      "name",
      "Name",
      "englishname",
      "EnglishName",
      "locationdescription",
      "LocationDescription"
    ]) || ""
  ).trim();
}

function matchStationToRiver(row, riverName) {
  const rule = RIVER_MATCH_RULES[riverName];
  if (!rule) return false;

  const text = JSON.stringify(row).replace(/\s+/g, "");

  return (
    rule.riverKeywords.some(k => text.includes(k)) ||
    rule.stationKeywords.some(k => text.includes(k))
  );
}

function findBestRealtimeForRiver(realtimeRows, riverName) {
  const candidates = [];

  for (const row of realtimeRows) {
    if (!matchStationToRiver(row, riverName)) continue;

    const waterlevel = pickWaterLevel(row);
    if (waterlevel === null) continue;

    candidates.push({
      riverName,
      stationName: pickStationName(row) || "未命名測站",
      stationId: pickStationId(row) || "未取得ID",
      waterlevel,
      datetime: pickDateTime(row),
      rawRealtime: row
    });
  }

  candidates.sort((a, b) =>
    String(b.datetime || "").localeCompare(String(a.datetime || ""))
  );

  return candidates[0] || null;
}

async function fetchRealWraWaterLevels() {
  const realtimeRaw = await fetch(WRA_REALTIME_WATER_URL, {
    cache: "no-store"
  }).then(r => {
    if (!r.ok) throw new Error("即時水位 API 回應失敗：" + r.status);
    return r.json();
  });

  const realtimeRows = normalizeWraRows(realtimeRaw);

  console.log("[WRA] realtimeRows:", realtimeRows.length);
  console.log("[WRA] realtime 第一筆欄位：", Object.keys(realtimeRows[0] || {}));
  console.table(realtimeRows.slice(0, 10));

  const result = {};
  const matchedDebug = [];

  for (const riverName of Object.keys(state.water)) {
    const hit = findBestRealtimeForRiver(realtimeRows, riverName);

    if (!hit) continue;

    const oldWarning = state.water[riverName]?.warning ?? 3;

    result[riverName] = {
      riverName,
      stationName: hit.stationName,
      stationId: hit.stationId,
      waterlevel: hit.waterlevel,
      datetime: hit.datetime,
      warning: oldWarning,
      danger: oldWarning + 0.8
    };

    matchedDebug.push({
      river: riverName,
      station: hit.stationName,
      stationId: hit.stationId,
      waterlevel: hit.waterlevel,
      warning: oldWarning,
      time: hit.datetime
    });
  }

  console.table(matchedDebug);

  return result;
}

async function refreshWater() {
  const oldText = id("currentMode")?.textContent || "主地圖模式";

  if (id("currentMode")) {
    id("currentMode").textContent = "正在更新水利署即時水位資料...";
  }

  try {
    const real = await fetchRealWraWaterLevels();
    let count = 0;

    for (const [riverName, info] of Object.entries(real)) {
      if (!state.water[riverName]) continue;

      state.water[riverName].current = info.waterlevel;
      state.water[riverName].stationName = info.stationName;
      state.water[riverName].stationId = info.stationId;
      state.water[riverName].datetime = info.datetime;
      state.water[riverName].isReal = true;

      count++;
    }

    renderWater();
    drawRiskLayers();

    if (id("currentMode")) {
      id("currentMode").textContent =
        count > 0
          ? `已匹配 ${count}/5 條水系真實水位資料`
          : "API 有回應，但仍未匹配到五大水系；請看 Console 的 realtime 表格";
    }

    if (count === 0) {
      console.warn("[WRA] 沒匹配到。下一步請看 realtimeRows 裡 observationitems 實際內容。");
    }

    return count;
  } catch (err) {
    console.warn("[WRA API] 真實水位取得失敗，改用展示資料：", err);

    Object.values(state.water).forEach(w => {
      w.current = Math.max(0.7, w.current + (Math.random() - 0.45) * 0.35);
      w.isReal = false;
    });

    renderWater();
    drawRiskLayers();

    if (id("currentMode")) {
      id("currentMode").textContent =
        oldText + "｜API 暫時無法取得，使用展示水位";
    }

    return 0;
  }
}

/* ===== 最穩版：直接指定五大水系代表測站 stationid ===== */

const RIVER_STATION_ID_MAP = {
  "淡水河": ["1010H006", "1010H007"],
  "大漢溪": ["1140H001", "1140H002"],
  "新店溪": ["1140H029", "1140H036"],
  "景美溪": ["1140H039", "1140H041"],
  "基隆河": ["1140H043", "1140H048"]
};

function pickWaterLevel(row) {
  return toNumberOrNull(
    getField(row, [
      "waterlevel",
      "WaterLevel",
      "waterLevel",
      "stage",
      "Stage"
    ])
  );
}

function pickDateTime(row) {
  return String(
    getField(row, [
      "datetime",
      "DateTime",
      "observationdatetime",
      "ObservationDateTime"
    ]) || ""
  ).trim();
}

function pickStationId(row) {
  return String(
    getField(row, [
      "stationid",
      "StationID",
      "StationId",
      "observatoryidentifier",
      "ObservatoryIdentifier"
    ]) || ""
  ).trim();
}

async function fetchRealWraWaterLevels() {
  const realtimeRaw = await fetch(WRA_REALTIME_WATER_URL, {
    cache: "no-store"
  }).then(r => {
    if (!r.ok) throw new Error("即時水位 API 回應失敗：" + r.status);
    return r.json();
  });

  const realtimeRows = normalizeWraRows(realtimeRaw);

  console.log("[WRA] realtimeRows:", realtimeRows.length);
  console.log("[WRA] realtime 第一筆欄位：", Object.keys(realtimeRows[0] || {}));
  console.table(realtimeRows.slice(0, 10));

  const result = {};
  const matchedDebug = [];

  for (const riverName of Object.keys(state.water)) {
    const stationIds = RIVER_STATION_ID_MAP[riverName] || [];

    const candidates = realtimeRows
      .map(row => {
        const stationId = pickStationId(row);
        const waterlevel = pickWaterLevel(row);
        const datetime = pickDateTime(row);

        return {
          row,
          stationId,
          waterlevel,
          datetime
        };
      })
      .filter(x =>
        stationIds.includes(x.stationId) &&
        x.waterlevel !== null
      );

    candidates.sort((a, b) =>
      String(b.datetime || "").localeCompare(String(a.datetime || ""))
    );

    const hit = candidates[0];

    if (!hit) continue;

    const oldWarning = state.water[riverName]?.warning ?? 3;

    result[riverName] = {
      riverName,
      stationName: `${riverName}代表測站`,
      stationId: hit.stationId,
      waterlevel: hit.waterlevel,
      datetime: hit.datetime,
      warning: oldWarning,
      danger: oldWarning + 0.8
    };

    matchedDebug.push({
      river: riverName,
      stationId: hit.stationId,
      waterlevel: hit.waterlevel,
      warning: oldWarning,
      time: hit.datetime
    });
  }

  console.table(matchedDebug);

  return result;
}

async function refreshWater() {
  const oldText = id("currentMode")?.textContent || "主地圖模式";

  if (id("currentMode")) {
    id("currentMode").textContent = "正在更新水利署即時水位資料...";
  }

  try {
    const real = await fetchRealWraWaterLevels();
    let count = 0;

    for (const [riverName, info] of Object.entries(real)) {
      if (!state.water[riverName]) continue;

      state.water[riverName].current = info.waterlevel;
      state.water[riverName].stationName = info.stationName;
      state.water[riverName].stationId = info.stationId;
      state.water[riverName].datetime = info.datetime;
      state.water[riverName].isReal = true;

      count++;
    }

    renderWater();
    drawRiskLayers();

    if (id("currentMode")) {
      id("currentMode").textContent =
        count > 0
          ? `已匹配 ${count}/5 條水系真實水位資料`
          : "API 有回應，但代表測站 stationid 未命中";
    }

    return count;
  } catch (err) {
    console.warn("[WRA API] 真實水位取得失敗，改用展示資料：", err);

    Object.values(state.water).forEach(w => {
      w.current = Math.max(0.7, w.current + (Math.random() - 0.45) * 0.35);
      w.isReal = false;
    });

    renderWater();
    drawRiskLayers();

    if (id("currentMode")) {
      id("currentMode").textContent =
        oldText + "｜API 暫時無法取得，使用展示水位";
    }

    return 0;
  }
}