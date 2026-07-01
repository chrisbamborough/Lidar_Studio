import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import "./styles.css";
import { rgbToHsv } from "./utils/color.js";

const STORAGE_KEY = "lidar-studio-settings";

const els = {
  canvas: document.getElementById("three"),
  video: document.getElementById("video"),
  addr: document.getElementById("addr"),
  connect: document.getElementById("connect"),
  demo: document.getElementById("demo"),
  stop: document.getElementById("stop"),
  useProxy: document.getElementById("useProxy"),
  status: document.getElementById("status"),
  sourceLabel: document.getElementById("sourceLabel"),
  error: document.getElementById("error"),
  fps: document.getElementById("fps"),
  points: document.getElementById("points"),
  trails: document.getElementById("trails"),
  frameSize: document.getElementById("frameSize"),
  resetView: document.getElementById("resetView"),
  resetControls: document.getElementById("resetControls"),
};

const defaults = {
  addr: "",
  useProxy: false,
  renderMode: "hybrid",
  step: "4",
  depthRange: "3",
  nearClip: "0.02",
  farClip: "4",
  spread: "1",
  orientation: "camera",
  colorMode: "camera",
  nearColor: "#ff9d00",
  farColor: "#2e8cff",
  tintColor: "#ffffff",
  pointSize: "0.012",
  opacity: "0.95",
  brightness: "1",
  additive: true,
  trailAgents: "640",
  trailBirthRate: "240",
  trailLife: "2.8",
  trailFlow: "2.1",
  trailSpeed: "0.9",
  trailMemory: "9000",
  trailOpacity: "0.62",
  twist: "0",
  wave: "0",
  spin: "0",
};

const controls = [
  "renderMode",
  "step",
  "depthRange",
  "nearClip",
  "farClip",
  "spread",
  "orientation",
  "colorMode",
  "nearColor",
  "farColor",
  "tintColor",
  "pointSize",
  "opacity",
  "brightness",
  "additive",
  "trailAgents",
  "trailBirthRate",
  "trailLife",
  "trailFlow",
  "trailSpeed",
  "trailMemory",
  "trailOpacity",
  "twist",
  "wave",
  "spin",
];

for (const id of controls) {
  els[id] = document.getElementById(id);
  els[`${id}Out`] = document.getElementById(`${id}Out`);
}

const renderer = new THREE.WebGLRenderer({
  canvas: els.canvas,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07090d);
scene.fog = new THREE.FogExp2(0x07090d, 0.055);

const camera = new THREE.PerspectiveCamera(60, 1, 0.01, 80);
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.dampingFactor = 0.07;
orbit.minDistance = 0.12;
orbit.maxDistance = 18;

const visualGroup = new THREE.Group();
scene.add(visualGroup);

const pointGeometry = new THREE.BufferGeometry();
pointGeometry.setDrawRange(0, 0);

const pointMaterial = new THREE.PointsMaterial({
  size: 0.012,
  vertexColors: true,
  transparent: true,
  opacity: 0.95,
  sizeAttenuation: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});

const pointCloud = new THREE.Points(pointGeometry, pointMaterial);
pointCloud.frustumCulled = false;
visualGroup.add(pointCloud);

const trailGeometry = new THREE.BufferGeometry();
const trailMaterial = new THREE.LineBasicMaterial({
  vertexColors: true,
  transparent: true,
  opacity: 0.62,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});

const trailLines = new THREE.LineSegments(trailGeometry, trailMaterial);
trailLines.frustumCulled = false;
visualGroup.add(trailLines);

const readCanvas = document.createElement("canvas");
const readCtx = readCanvas.getContext("2d", { willReadFrequently: true });

const nearColor = new THREE.Color();
const farColor = new THREE.Color();
const tintColor = new THREE.Color();
const workColor = new THREE.Color();

let peerConnection = null;
let sourceMode = "demo";
let pointPositions = new Float32Array(0);
let pointColors = new Float32Array(0);
let pointCapacity = 0;
let pointCount = 0;

let agentCapacity = 0;
let agentCount = 0;
let nextAgent = 0;
let spawnAccumulator = 0;
let agentPositions = new Float32Array(0);
let agentPrevPositions = new Float32Array(0);
let agentVelocities = new Float32Array(0);
let agentColors = new Float32Array(0);
let agentAges = new Float32Array(0);
let agentLives = new Float32Array(0);

let trailCapacity = 0;
let trailHead = 0;
let trailCount = 0;
let trailPositions = new Float32Array(0);
let trailColors = new Float32Array(0);
let trailBaseColors = new Float32Array(0);
let trailBirthTimes = new Float32Array(0);
let trailLifeTimes = new Float32Array(0);

let lastTime = performance.now();
let fpsLast = performance.now();
let fpsFrames = 0;

loadSettings();
syncOutputs();
updateMaterials();
resetView();
setStatus("Demo", "Synthetic source");

els.connect.addEventListener("click", connect);
els.demo.addEventListener("click", startDemo);
els.stop.addEventListener("click", stopSource);
els.resetView.addEventListener("click", resetView);
els.resetControls.addEventListener("click", resetControls);
els.addr.addEventListener("change", saveSettings);
els.useProxy.addEventListener("change", saveSettings);
window.addEventListener("resize", resize);

for (const id of controls) {
  const eventName = els[id].type === "range" ? "input" : "change";
  els[id].addEventListener(eventName, () => {
    syncOutputs();
    updateMaterials();
    saveSettings();
  });
}

requestAnimationFrame(renderLoop);

function loadSettings() {
  let saved = {};

  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }

  for (const [id, value] of Object.entries({ ...defaults, ...saved })) {
    if (!els[id]) continue;
    if (els[id].type === "checkbox") {
      els[id].checked = Boolean(value);
    } else {
      els[id].value = value;
    }
  }
}

function saveSettings() {
  const data = {
    addr: els.addr.value,
    useProxy: els.useProxy.checked,
  };

  for (const id of controls) {
    data[id] = els[id].type === "checkbox" ? els[id].checked : els[id].value;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function resetControls() {
  for (const [id, value] of Object.entries(defaults)) {
    if (!els[id]) continue;
    if (els[id].type === "checkbox") {
      els[id].checked = Boolean(value);
    } else {
      els[id].value = value;
    }
  }

  clearTrailState();
  syncOutputs();
  updateMaterials();
  saveSettings();
}

function values() {
  const nearClip = numberValue("nearClip");
  const farClip = Math.max(nearClip + 0.05, numberValue("farClip"));

  return {
    renderMode: els.renderMode.value,
    step: Math.max(1, Math.round(numberValue("step"))),
    depthRange: numberValue("depthRange"),
    nearClip,
    farClip,
    spread: numberValue("spread"),
    orientation: els.orientation.value,
    colorMode: els.colorMode.value,
    nearColor: els.nearColor.value,
    farColor: els.farColor.value,
    tintColor: els.tintColor.value,
    pointSize: numberValue("pointSize"),
    opacity: numberValue("opacity"),
    brightness: numberValue("brightness"),
    additive: els.additive.checked,
    trailAgents: Math.round(numberValue("trailAgents")),
    trailBirthRate: numberValue("trailBirthRate"),
    trailLife: numberValue("trailLife"),
    trailFlow: numberValue("trailFlow"),
    trailSpeed: numberValue("trailSpeed"),
    trailMemory: Math.round(numberValue("trailMemory")),
    trailOpacity: numberValue("trailOpacity"),
    twist: numberValue("twist"),
    wave: numberValue("wave"),
    spin: numberValue("spin"),
  };
}

function numberValue(id) {
  return Number(els[id].value);
}

function syncOutputs() {
  els.stepOut.textContent = String(Math.round(numberValue("step")));
  els.depthRangeOut.textContent = `${numberValue("depthRange").toFixed(1)} m`;
  els.nearClipOut.textContent = `${numberValue("nearClip").toFixed(2)} m`;
  els.farClipOut.textContent = `${numberValue("farClip").toFixed(1)} m`;
  els.spreadOut.textContent = numberValue("spread").toFixed(2);
  els.pointSizeOut.textContent = numberValue("pointSize").toFixed(3);
  els.opacityOut.textContent = numberValue("opacity").toFixed(2);
  els.brightnessOut.textContent = numberValue("brightness").toFixed(2);
  els.trailAgentsOut.textContent = String(Math.round(numberValue("trailAgents")));
  els.trailBirthRateOut.textContent = `${Math.round(numberValue("trailBirthRate"))}/s`;
  els.trailLifeOut.textContent = `${numberValue("trailLife").toFixed(1)} s`;
  els.trailFlowOut.textContent = numberValue("trailFlow").toFixed(2);
  els.trailSpeedOut.textContent = numberValue("trailSpeed").toFixed(2);
  els.trailMemoryOut.textContent = String(Math.round(numberValue("trailMemory")));
  els.trailOpacityOut.textContent = numberValue("trailOpacity").toFixed(2);
  els.twistOut.textContent = numberValue("twist").toFixed(2);
  els.waveOut.textContent = numberValue("wave").toFixed(2);
  els.spinOut.textContent = numberValue("spin").toFixed(2);
}

function updateMaterials() {
  const v = values();
  const blending = v.additive ? THREE.AdditiveBlending : THREE.NormalBlending;

  pointMaterial.size = v.pointSize;
  pointMaterial.opacity = v.opacity;
  pointMaterial.blending = blending;
  pointMaterial.depthWrite = !v.additive;
  pointMaterial.needsUpdate = true;

  trailMaterial.opacity = v.trailOpacity;
  trailMaterial.blending = blending;
  trailMaterial.depthWrite = !v.additive;
  trailMaterial.needsUpdate = true;

  pointCloud.visible = v.renderMode !== "trails";
  trailLines.visible = v.renderMode !== "points";
}

async function connect() {
  stopPeerConnection();
  clearError();
  els.connect.disabled = true;
  setStatus("Connecting", "Record3D");

  const serverAddress = els.useProxy.checked ? "/webrtc" : els.addr.value.trim();

  if (!serverAddress) {
    showError("Enter a Record3D URL or enable the proxy.");
    els.connect.disabled = false;
    setStatus(sourceMode === "demo" ? "Demo" : "Idle", els.sourceLabel.textContent);
    return;
  }

  try {
    peerConnection = await connectRecord3D(serverAddress);
    sourceMode = "lidar";
    saveSettings();
    clearTrailState();
    setStatus("Live", serverAddress);
  } catch (error) {
    showError(error);
    els.connect.disabled = false;
    startDemo({ keepError: true });
  }
}

async function connectRecord3D(serverAddress) {
  const server = normalizeServer(serverAddress);
  const pc = new RTCPeerConnection({ iceServers: [] });

  pc.oniceconnectionstatechange = () => {
    if (sourceMode === "lidar" || els.status.textContent === "Connecting") {
      els.status.textContent = pc.iceConnectionState;
    }
  };

  pc.ontrack = (event) => {
    els.video.srcObject = event.streams[0];
    els.video.play();
  };

  try {
    await fetchJson(`${server}/metadata`, "metadata");
    const offer = await fetchJson(`${server}/getOffer`, "getOffer");
    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await waitForIce(pc);

    const response = await fetch(`${server}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "answer", data: pc.localDescription.sdp }),
    });

    if (!response.ok) {
      throw new Error(`answer ${response.status} ${response.statusText}`);
    }

    return pc;
  } catch (error) {
    pc.close();
    throw error;
  }
}

function normalizeServer(serverAddress) {
  let server = serverAddress.trim();

  if (!server) {
    throw new Error("Record3D URL is required.");
  }

  if (server.startsWith("/")) {
    return server.replace(/\/+$/, "");
  }

  if (!/^https?:\/\//i.test(server)) {
    server = `http://${server}`;
  }

  return server.replace(/\/+$/, "");
}

async function fetchJson(url, label) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`${label} ${response.status} ${response.statusText}`);
  }

  try {
    return await response.json();
  } catch {
    throw new Error(`${label} response is not JSON`);
  }
}

function waitForIce(pc) {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") {
      resolve();
      return;
    }

    const onChange = () => {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", onChange);
        resolve();
      }
    };

    pc.addEventListener("icegatheringstatechange", onChange);
    setTimeout(resolve, 3000);
  });
}

function startDemo(options = {}) {
  stopPeerConnection();
  sourceMode = "demo";
  els.connect.disabled = false;
  if (!options.keepError) clearError();
  clearTrailState();
  setStatus("Demo", "Synthetic source");
}

function stopSource() {
  stopPeerConnection();
  sourceMode = "none";
  pointCount = 0;
  pointGeometry.setDrawRange(0, 0);
  clearTrailState();
  els.connect.disabled = false;
  setStatus("Idle", "No source");
}

function stopPeerConnection() {
  if (peerConnection) {
    peerConnection.getSenders().forEach((sender) => sender.track?.stop());
    peerConnection.getReceivers().forEach((receiver) => receiver.track?.stop());
    peerConnection.close();
    peerConnection = null;
  }

  if (els.video.srcObject) {
    els.video.srcObject.getTracks().forEach((track) => track.stop());
    els.video.srcObject = null;
  }
}

function renderLoop(now) {
  resize();

  const dt = Math.min(0.1, (now - lastTime) / 1000);
  const time = now / 1000;
  lastTime = now;

  const v = values();
  updateMaterials();
  visualGroup.rotation.y += v.spin * dt;

  if (sourceMode === "lidar") {
    processVideoFrame(time, v);
  } else if (sourceMode === "demo") {
    processDemoFrame(time, v);
  }

  updateTrailLayer(dt, time, v);
  orbit.update();
  renderer.render(scene, camera);
  updateReadout(now);

  requestAnimationFrame(renderLoop);
}

function resize() {
  const width = els.canvas.clientWidth;
  const height = els.canvas.clientHeight;

  if (els.canvas.width !== width || els.canvas.height !== height) {
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  }
}

function resetView() {
  camera.position.set(0, 0.12, 2.4);
  orbit.target.set(0, 0, 0);
  orbit.update();
  visualGroup.rotation.set(0, 0, 0);
}

function processVideoFrame(time, v) {
  const width = els.video.videoWidth;
  const height = els.video.videoHeight;

  if (!width || !height) return;

  const halfWidth = width >> 1;
  const capacity = Math.ceil(height / v.step) * Math.ceil(halfWidth / v.step);
  ensurePointCapacity(capacity);

  readCanvas.width = width;
  readCanvas.height = height;
  readCtx.drawImage(els.video, 0, 0);

  const image = readCtx.getImageData(0, 0, width, height).data;
  const fx = halfWidth;
  const fy = height;
  const cx = halfWidth * 0.5;
  const cy = height * 0.5;

  prepareColors(v);

  let count = 0;

  for (let y = 0; y < height; y += v.step) {
    for (let x = 0; x < halfWidth; x += v.step) {
      const depthIndex = (y * width + x) * 4;
      const [hue] = rgbToHsv(
        image[depthIndex],
        image[depthIndex + 1],
        image[depthIndex + 2]
      );
      const z = hue * v.depthRange;

      if (z < v.nearClip || z > v.farClip) continue;

      const colorIndex = (y * width + (x + halfWidth)) * 4;
      const rawR = image[colorIndex] / 255;
      const rawG = image[colorIndex + 1] / 255;
      const rawB = image[colorIndex + 2] / 255;

      count = writePoint(
        count,
        ((x - cx) / fx) * z,
        ((y - cy) / fy) * z,
        z,
        rawR,
        rawG,
        rawB,
        time,
        v
      );
    }
  }

  commitPointGeometry(count);
  els.frameSize.textContent = `${halfWidth} x ${height}`;
}

function processDemoFrame(time, v) {
  const width = 180;
  const height = 120;
  const capacity = Math.ceil(height / v.step) * Math.ceil(width / v.step);
  ensurePointCapacity(capacity);
  prepareColors(v);

  let count = 0;

  for (let y = 0; y < height; y += v.step) {
    for (let x = 0; x < width; x += v.step) {
      const nx = (x / (width - 1) - 0.5) * 2;
      const ny = (y / (height - 1) - 0.5) * 2;
      const ripple =
        Math.sin(nx * 4.2 + time * 1.4) * 0.18 +
        Math.cos(ny * 4.8 - time * 1.1) * 0.15 +
        Math.sin((nx + ny) * 3.5 + time * 0.8) * 0.1;
      const z = THREE.MathUtils.clamp(
        v.depthRange * (0.45 + ripple),
        v.nearClip,
        v.farClip
      );

      const rawR = 0.55 + 0.45 * Math.sin(time + nx * 2.4);
      const rawG = 0.55 + 0.45 * Math.sin(time * 0.8 + ny * 2.8 + 1.5);
      const rawB = 0.55 + 0.45 * Math.sin(time * 1.1 + nx * ny * 4 + 3);

      count = writePoint(
        count,
        nx * z * 0.42,
        ny * z * 0.34,
        z,
        rawR,
        rawG,
        rawB,
        time,
        v
      );
    }
  }

  commitPointGeometry(count);
  els.frameSize.textContent = `${width} x ${height}`;
}

function prepareColors(v) {
  nearColor.set(v.nearColor);
  farColor.set(v.farColor);
  tintColor.set(v.tintColor);
}

function writePoint(count, x, y, z, rawR, rawG, rawB, time, v) {
  let px;
  let py;
  let pz;

  if (v.orientation === "stage") {
    px = z;
    py = -y;
    pz = -x;
  } else {
    px = x;
    py = -y;
    pz = -z;
  }

  px *= v.spread;
  py *= v.spread;

  if (v.twist !== 0) {
    const t = THREE.MathUtils.clamp(z / Math.max(0.001, v.depthRange), 0, 1);
    const angle = v.twist * (t - 0.5);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const nextX = px * cos - pz * sin;
    const nextZ = px * sin + pz * cos;
    px = nextX;
    pz = nextZ;
  }

  if (v.wave !== 0) {
    py += Math.sin(px * 4 + time * 2.1) * v.wave * 0.08;
    pz += Math.cos(py * 5 + time * 1.7) * v.wave * 0.05;
  }

  const i = count * 3;
  pointPositions[i] = px;
  pointPositions[i + 1] = py;
  pointPositions[i + 2] = pz;

  writeColor(i, z, py, rawR, rawG, rawB, time, v);

  return count + 1;
}

function writeColor(i, z, y, rawR, rawG, rawB, time, v) {
  const depthT = THREE.MathUtils.clamp(
    (z - v.nearClip) / Math.max(0.001, v.farClip - v.nearClip),
    0,
    1
  );
  const heightT = THREE.MathUtils.clamp((y + v.depthRange * 0.5) / v.depthRange, 0, 1);

  if (v.colorMode === "camera") {
    workColor.setRGB(rawR, rawG, rawB);
  } else if (v.colorMode === "height") {
    workColor.copy(nearColor).lerp(farColor, heightT);
  } else if (v.colorMode === "rainbow") {
    workColor.setHSL((depthT * 0.65 + time * 0.03) % 1, 0.9, 0.58);
  } else if (v.colorMode === "mono") {
    workColor.setRGB(1, 1, 1);
  } else {
    workColor.copy(nearColor).lerp(farColor, depthT);
  }

  workColor.multiply(tintColor).multiplyScalar(v.brightness);

  pointColors[i] = workColor.r;
  pointColors[i + 1] = workColor.g;
  pointColors[i + 2] = workColor.b;
}

function ensurePointCapacity(capacity) {
  if (capacity <= pointCapacity) return;

  pointCapacity = capacity;
  pointPositions = new Float32Array(pointCapacity * 3);
  pointColors = new Float32Array(pointCapacity * 3);

  pointGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(pointPositions, 3).setUsage(THREE.DynamicDrawUsage)
  );
  pointGeometry.setAttribute(
    "color",
    new THREE.BufferAttribute(pointColors, 3).setUsage(THREE.DynamicDrawUsage)
  );
}

function commitPointGeometry(count) {
  pointCount = count;
  pointGeometry.attributes.position.needsUpdate = true;
  pointGeometry.attributes.color.needsUpdate = true;
  pointGeometry.setDrawRange(0, pointCount);
}

function updateTrailLayer(dt, time, v) {
  if (v.renderMode === "points" || !pointCount) {
    fadeTrailSegments(time);
    commitTrailGeometry();
    return;
  }

  ensureAgentCapacity(v.trailAgents);
  ensureTrailCapacity(v.trailMemory);

  spawnAccumulator += v.trailBirthRate * dt;
  let spawnCount = Math.floor(spawnAccumulator);
  spawnAccumulator -= spawnCount;

  if (agentCount < agentCapacity) {
    spawnCount = Math.max(spawnCount, Math.min(12, agentCapacity - agentCount));
  }

  for (let i = 0; i < spawnCount; i += 1) {
    spawnAgent(time, v);
  }

  for (let agent = 0; agent < agentCount; agent += 1) {
    updateAgent(agent, dt, time, v);
  }

  fadeTrailSegments(time);
  commitTrailGeometry();
}

function ensureAgentCapacity(capacity) {
  if (capacity === agentCapacity) return;

  agentCapacity = capacity;
  agentCount = 0;
  nextAgent = 0;
  spawnAccumulator = 0;
  agentPositions = new Float32Array(agentCapacity * 3);
  agentPrevPositions = new Float32Array(agentCapacity * 3);
  agentVelocities = new Float32Array(agentCapacity * 3);
  agentColors = new Float32Array(agentCapacity * 3);
  agentAges = new Float32Array(agentCapacity);
  agentLives = new Float32Array(agentCapacity);
}

function ensureTrailCapacity(capacity) {
  if (capacity === trailCapacity) return;

  trailCapacity = capacity;
  trailHead = 0;
  trailCount = 0;
  trailPositions = new Float32Array(trailCapacity * 6);
  trailColors = new Float32Array(trailCapacity * 6);
  trailBaseColors = new Float32Array(trailCapacity * 6);
  trailBirthTimes = new Float32Array(trailCapacity);
  trailLifeTimes = new Float32Array(trailCapacity);

  trailGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(trailPositions, 3).setUsage(THREE.DynamicDrawUsage)
  );
  trailGeometry.setAttribute(
    "color",
    new THREE.BufferAttribute(trailColors, 3).setUsage(THREE.DynamicDrawUsage)
  );
  trailGeometry.setDrawRange(0, 0);
}

function spawnAgent(time, v) {
  if (!pointCount || !agentCapacity) return;

  const agent = agentCount < agentCapacity ? agentCount : nextAgent;
  if (agentCount < agentCapacity) agentCount += 1;
  nextAgent = (agent + 1) % agentCapacity;

  seedAgent(agent, time, v);
}

function seedAgent(agent, time, v) {
  const point = Math.floor(Math.random() * pointCount) * 3;
  const i = agent * 3;

  agentPositions[i] = pointPositions[point];
  agentPositions[i + 1] = pointPositions[point + 1];
  agentPositions[i + 2] = pointPositions[point + 2];
  agentPrevPositions[i] = agentPositions[i];
  agentPrevPositions[i + 1] = agentPositions[i + 1];
  agentPrevPositions[i + 2] = agentPositions[i + 2];

  const angle = Math.random() * Math.PI * 2;
  const speed = 0.02 + Math.random() * 0.08;
  agentVelocities[i] = Math.cos(angle) * speed;
  agentVelocities[i + 1] = (Math.random() - 0.5) * speed;
  agentVelocities[i + 2] = Math.sin(angle) * speed;

  agentColors[i] = pointColors[point];
  agentColors[i + 1] = pointColors[point + 1];
  agentColors[i + 2] = pointColors[point + 2];
  agentAges[agent] = 0;
  agentLives[agent] = v.trailLife * (0.65 + Math.random() * 0.7);

  // Stagger replacement agents so the layer breathes instead of pulsing in lockstep.
  if (time < 1) agentAges[agent] = Math.random() * agentLives[agent] * 0.4;
}

function updateAgent(agent, dt, time, v) {
  const i = agent * 3;

  agentAges[agent] += dt;
  if (agentAges[agent] > agentLives[agent]) {
    seedAgent(agent, time, v);
    return;
  }

  const px = agentPositions[i];
  const py = agentPositions[i + 1];
  const pz = agentPositions[i + 2];

  agentPrevPositions[i] = px;
  agentPrevPositions[i + 1] = py;
  agentPrevPositions[i + 2] = pz;

  const flowX =
    Math.sin(py * 2.7 + time * 0.8) +
    Math.cos(pz * 1.9 - time * 0.45);
  const flowY =
    Math.cos(pz * 2.2 + px * 0.9 + time * 0.5) -
    Math.sin(px * 1.3 - time * 0.3);
  const flowZ =
    Math.sin(px * 2.5 - time * 0.6) +
    Math.cos(py * 2.1 + time * 0.55);

  const force = v.trailFlow * 0.03;
  agentVelocities[i] = (agentVelocities[i] + flowX * force * dt) * 0.992;
  agentVelocities[i + 1] = (agentVelocities[i + 1] + flowY * force * dt) * 0.992;
  agentVelocities[i + 2] = (agentVelocities[i + 2] + flowZ * force * dt) * 0.992;

  agentPositions[i] = px + agentVelocities[i] * v.trailSpeed * dt;
  agentPositions[i + 1] = py + agentVelocities[i + 1] * v.trailSpeed * dt;
  agentPositions[i + 2] = pz + agentVelocities[i + 2] * v.trailSpeed * dt;

  addTrailSegment(agent, time, v);
}

function addTrailSegment(agent, time, v) {
  if (!trailCapacity) return;

  const agentIndex = agent * 3;
  const trailIndex = trailHead * 6;

  trailPositions[trailIndex] = agentPrevPositions[agentIndex];
  trailPositions[trailIndex + 1] = agentPrevPositions[agentIndex + 1];
  trailPositions[trailIndex + 2] = agentPrevPositions[agentIndex + 2];
  trailPositions[trailIndex + 3] = agentPositions[agentIndex];
  trailPositions[trailIndex + 4] = agentPositions[agentIndex + 1];
  trailPositions[trailIndex + 5] = agentPositions[agentIndex + 2];

  const lifeFade = 1 - agentAges[agent] / Math.max(0.001, agentLives[agent]);
  const colorBoost = 0.55 + lifeFade * 0.7;
  const r = agentColors[agentIndex] * colorBoost;
  const g = agentColors[agentIndex + 1] * colorBoost;
  const b = agentColors[agentIndex + 2] * colorBoost;

  trailBaseColors[trailIndex] = r;
  trailBaseColors[trailIndex + 1] = g;
  trailBaseColors[trailIndex + 2] = b;
  trailBaseColors[trailIndex + 3] = r;
  trailBaseColors[trailIndex + 4] = g;
  trailBaseColors[trailIndex + 5] = b;

  trailBirthTimes[trailHead] = time;
  trailLifeTimes[trailHead] = v.trailLife;
  trailHead = (trailHead + 1) % trailCapacity;
  trailCount = Math.min(trailCapacity, trailCount + 1);
}

function fadeTrailSegments(time) {
  for (let segment = 0; segment < trailCount; segment += 1) {
    const age = time - trailBirthTimes[segment];
    const life = Math.max(0.001, trailLifeTimes[segment]);
    const fade = age >= 0 && age < life ? (1 - age / life) ** 1.6 : 0;
    const i = segment * 6;

    trailColors[i] = trailBaseColors[i] * fade;
    trailColors[i + 1] = trailBaseColors[i + 1] * fade;
    trailColors[i + 2] = trailBaseColors[i + 2] * fade;
    trailColors[i + 3] = trailBaseColors[i + 3] * fade;
    trailColors[i + 4] = trailBaseColors[i + 4] * fade;
    trailColors[i + 5] = trailBaseColors[i + 5] * fade;
  }
}

function commitTrailGeometry() {
  if (!trailGeometry.attributes.position || !trailGeometry.attributes.color) return;

  trailGeometry.attributes.position.needsUpdate = true;
  trailGeometry.attributes.color.needsUpdate = true;
  trailGeometry.setDrawRange(0, trailCount * 2);
}

function clearTrailState() {
  agentCount = 0;
  nextAgent = 0;
  spawnAccumulator = 0;
  trailHead = 0;
  trailCount = 0;
  if (trailColors.length) trailColors.fill(0);
  if (trailBaseColors.length) trailBaseColors.fill(0);
  trailGeometry.setDrawRange(0, 0);
}

function updateReadout(now) {
  fpsFrames += 1;

  if (now - fpsLast > 500) {
    const fps = (fpsFrames * 1000) / (now - fpsLast);
    els.fps.textContent = `${fps.toFixed(0)} FPS`;
    els.points.textContent = `${pointCount.toLocaleString()} points`;
    els.trails.textContent = `${trailCount.toLocaleString()} trails`;
    fpsFrames = 0;
    fpsLast = now;
  }
}

function setStatus(status, sourceLabel) {
  els.status.textContent = status;
  els.sourceLabel.textContent = sourceLabel;
}

function showError(error) {
  els.error.textContent = error?.message || String(error);
}

function clearError() {
  els.error.textContent = "";
}
