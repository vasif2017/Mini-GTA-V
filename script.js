// --- КОНФИГУРАЦИЯ ---
const MAP_SIZE = 60;
const BOUNDARY_PADDING = 4;

// --- СИСТЕМА МИССИЙ ---
const missions = [
  {
    id: 1,
    title: "Миссия 1: Разгон",
    description: "Разгонись до 40 км/ч и удерживай скорость 3 секунды.",
    condition: (player) => player.currentSpeed >= 40,
    reward: "Открыт доступ к гаражу"
  },
  {
    id: 2,
    title: "Миссия 2: Доставка",
    description: "Доедь до маркера на севере (Z = 40) без остановки.",
    condition: (player) => player.position.z >= 40 && player.currentSpeed > 0,
    reward: "Бонус к скорости +10%"
  },
  {
    id: 3,
    title: "Миссия 3: Парковка",
    description: "Остановись в зоне парковки (X = 0, Z = 50) и не двигайся 2 секунды.",
    condition: (player) => Math.abs(player.position.x) < 2 && player.position.z > 48 && player.position.z < 52 && player.currentSpeed < 1,
    reward: "Новый цвет машины"
  }
];

let currentMissionIndex = -1;
let missionStartTime = 0;
let missionCompleted = false;

function startNextMission() {
  currentMissionIndex++;
  if (currentMissionIndex >= missions.length) {
    alert("Все миссии пройдены!");
    currentMissionIndex = 0; // зацикливаем для теста
  }
  const m = missions[currentMissionIndex];
  document.getElementById('mission-title').innerText = m.title;
  document.getElementById('mission-desc').innerText = m.description;
  document.getElementById('mission-modal').style.display = 'block';
  missionStartTime = 0;
  missionCompleted = false;
}

function closeMissionModal() {
  document.getElementById('mission-modal').style.display = 'none';
  missionStartTime = performance.now();
}

function checkMissionProgress(player) {
  if (missionCompleted || currentMissionIndex < 0) return;

  const m = missions[currentMissionIndex];
  if (m.condition(player)) {
    if (missionStartTime === 0) missionStartTime = performance.now();
    const timeHeld = (performance.now() - missionStartTime) / 1000;
    
    // Для миссии 1 и 3 нужно удерживать условие несколько секунд
    const holdTime = m.id === 1 ? 3 : (m.id === 3 ? 2 : 0);
    
    if (timeHeld >= holdTime) {
      completeMission(m);
    }
  } else {
    missionStartTime = 0; // сбрасываем таймер, если условие нарушено
  }
}

function completeMission(m) {
  missionCompleted = true;
  document.getElementById('mission-status').innerText = `Mission: \${m.title} (COMPLETE!)`;
  document.getElementById('mission-status').style.color = "#4ade80";
  alert(`Миссия выполнена! Награда: \${m.reward}`);
  setTimeout(startNextMission, 1000);
}

// --- ИНИЦИАЛИЗАЦИЯ ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.FogExp2(0x87CEEB, 0.03);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 15, 25);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// --- ОСВЕЩЕНИЕ ---
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.7);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(50, 80, 50);
dirLight.castShadow = true;
dirLight.shadow.camera.left = -MAP_SIZE;
dirLight.shadow.camera.right = MAP_SIZE;
dirLight.shadow.camera.top = MAP_SIZE;
dirLight.shadow.camera.bottom = -MAP_SIZE;
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
scene.add(dirLight);

// --- ДОРОГА ---
const roadCanvas = document.createElement('canvas');
roadCanvas.width = 256;
roadCanvas.height = 256;
const ctx = roadCanvas.getContext('2d');

ctx.fillStyle = '#333333';
ctx.fillRect(0, 0, 256, 256);
for(let i=0; i<500; i++) {
  const x = Math.random() * 256;
  const y = Math.random() * 256;
  ctx.fillStyle = Math.random() > 0.5 ? '#222' : '#444';
  ctx.fillRect(x, y, 1, 1);
}
ctx.strokeStyle = '#ffffaa';
ctx.lineWidth = 4;
ctx.beginPath();
ctx.moveTo(0, 128);
ctx.lineTo(256, 128);
ctx.stroke();

const roadTexture = new THREE.CanvasTexture(roadCanvas);
roadTexture.wrapS = THREE.RepeatWrapping;
roadTexture.wrapT = THREE.RepeatWrapping;
roadTexture.repeat.set(2, 2);

const floorGeo = new THREE.PlaneGeometry(MAP_SIZE * 2, MAP_SIZE * 2);
const roadMat = new THREE.MeshStandardMaterial({ map: roadTexture, roughness: 0.8 });
const floor = new THREE.Mesh(floorGeo, roadMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// --- ГОРОД ---
function createBuilding(x, z, height, color) {
  const group = new THREE.Group();
  
  const bGeo = new THREE.BoxGeometry(8, height, 8);
  const bMat = new THREE.MeshStandardMaterial({ 
    color: color, 
    roughness: 0.6, 
    metalness: 0.1 
  });
  const building = new THREE.Mesh(bGeo, bMat);
  building.position.set(0, height / 2, 0);
  building.castShadow = true;
  building.receiveShadow = true;
  group.add(building);

  const roofGeo = new THREE.BoxGeometry(8.2, 0.4, 8.2);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.set(0, height / 2 + 0.2, 0);
  group.add(roof);

  const winMat = new THREE.MeshStandardMaterial({ color: 0xffffaa, roughness: 0.2, metalness: 0.5 });
  const rows = Math.floor(height / 2);
  
  for (let r = 0; r < rows; r++) {
    for (let side = 0; side < 4; side++) {
      const wGeo = new THREE.BoxGeometry(1.8, 1.5, 0.1);
      const windowMesh = new THREE.Mesh(wGeo, winMat);
      
      let wx = 0, wz = 0;
      if (side === 0) { wx = 4; wz = 3.9; }
      else if (side === 1) { wx = -4; wz = 3.9; }
      else if (side === 2) { wx = 3.9; wz = 4; }
      else if (side === 3) { wx = 3.9; wz = -4; }

      windowMesh.position.set(wx, (r * 2) + 0.75, wz);
      windowMesh.castShadow = false;
      windowMesh.receiveShadow = false;
      group.add(windowMesh);
    }
  }
  
  group.position.set(x, 0, z);
  scene.add(group);
  return group;
}

const colors = [0xcccccc, 0xd2b48c, 0x8b4513, 0x708090];
for (let i = -MAP_SIZE; i <= MAP_SIZE; i += 16) {
  for (let j = -MAP_SIZE; j <= MAP_SIZE; j += 16) {
    if (Math.abs(i) < 10 && Math.abs(j) < 10) continue;
    const h = 6 + Math.random() * 10;
    createBuilding(i, j, h, colors[Math.floor(Math.random() * colors.length)]);
  }
}

// --- ФОНАРИ ---
function createLamp(x, z) {
  const lamp = new THREE.Group();
  const poleGeo = new THREE.CylinderGeometry(0.1, 0.1, 4, 16);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.y = 2;
  lamp.add(pole);

  const light = new THREE.PointLight(0xffffff, 0.3, 10);
  light.position.set(0, 4, 0);
  lamp.add(light);
  
  lamp.position.set(x, 0, z);
  lamp.castShadow = false;
  scene.add(lamp);
}
for (let i = -MAP_SIZE; i <= MAP_SIZE; i += 25) {
  for (let j = -MAP_SIZE; j <= MAP_SIZE; j += 25) {
    createLamp(i, j);
  }
}

// --- МАШИНА ---
const car = new THREE.Group();

const carBodyGeo = new THREE.BoxGeometry(2.2, 1.2, 4.5);
const carBodyMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.6 });
const carBody = new THREE.Mesh(carBodyGeo, carBodyMat);
carBody.position.y = 0.6;
carBody.castShadow = true;
carBody.receiveShadow = true;
car.add(carBody);

const carRoofGeo = new THREE.BoxGeometry(1.8, 0.8, 3.5);
const carRoofMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, metalness: 0.7 });
const carRoof = new THREE.Mesh(carRoofGeo, carRoofMat);
carRoof.position.set(0, 1.4, 0);
car.add(carRoof);

const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.8, 16);
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

const wheelPositions = [
  [-0.8, 0.6, -2], [0.8, 0.6, -2], [-0.8, 0.6, 2], [0.8, 0.6, 2]
];

wheelPositions.forEach(pos => {
  const wheel = new THREE.Mesh(wheelGeo, wheelMat);
  wheel.position.set(...pos);
  wheel.castShadow = true;
  wheel.receiveShadow = true;
  car.add(wheel);
});

scene.add(car);

// --- ИГРОК (машина) ---
const player = {
  mesh: car,
  position: new THREE.Vector3(0, 0, 0),
  rotation: 0,
  speed: 0,
  maxSpeed: 60,
  acceleration: 0.2,
  deceleration: 0.1,
  turnSpeed: 0.05,
  currentSpeed: 0,
  inCar: true
};

// --- УПРАВЛЕНИЕ (клавиатура) ---
const keys = { w: false, a: false, s: false, d: false, e: false, space: false };

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyW') keys.w = true;
  if (e.code === 'KeyA') keys.a = true;
  if (e.code === 'KeyS') keys.s = true;
  if (e.code === 'KeyD') keys.d = true;
  if (e.code === 'KeyE') keys.e = true;
  if (e.code === 'Space') keys.space = true;
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyW') keys.w = false;
  if (e.code === 'KeyA') keys.a = false;
  if (e.code === 'KeyS') keys.s = false;
  if (e.code === 'KeyD') keys.d = false;
  if (e.code === 'KeyE') keys.e = false;
  if (e.code === 'Space') keys.space = false;
});

// --- СЕНСОРНОЕ УПРАВЛЕНИЕ ---
const btnUp = document.getElementById('btn-up');
const btnLeft = document.getElementById('btn-left');
const btnDown = document.getElementById('btn-down');
const btnRight = document.getElementById('btn-right');
const btnEnter = document.getElementById('btn-enter');
const btnJump = document.getElementById('btn-jump');

btnUp.addEventListener('touchstart', (e) => { e.preventDefault(); keys.w = true; }, {passive: false});
btnUp.addEventListener('touchend', () => keys.w = false);
btnLeft.addEventListener('touchstart', (e) => { e.preventDefault(); keys.a = true; }, {passive: false});
btnLeft.addEventListener('touchend', () => keys.a = false);
btnDown.addEventListener('touchstart', (e) => { e.preventDefault(); keys.s = true; }, {passive: false});
btnDown.addEventListener('touchend', () => keys.s = false);
btnRight.addEventListener('touchstart', (e) => { e.preventDefault(); keys.d = true; }, {passive: false});
btnRight.addEventListener('touchend', () => keys.d = false);
btnEnter.addEventListener('touchstart', (e) => { e.preventDefault(); keys.e = true; }, {passive: false});
btnEnter.addEventListener('touchend', () => keys.e = false);
btnJump.addEventListener('touchstart', (e) => { e.preventDefault(); keys.space = true; }, {passive: false});
btnJump.addEventListener('touchend', () => keys.space = false);

// --- ОБНОВЛЕНИЕ ИГРЫ ---
function update() {
  // Миссии
  checkMissionProgress(player);

  // Движение
  if (player.inCar) {
    // Ускорение
    if (keys.w && player.speed < player.maxSpeed) {
      player.speed += player.acceleration;
    } else if (keys.s) {
      player.speed = Math.max(0, player.speed - player.acceleration * 2);
    } else {
      player.speed = Math.max(0, player.speed - player.deceleration);
    }

    // Поворот
    if (keys.a) player.rotation += player.turnSpeed;
    if (keys.d) player.rotation -= player.turnSpeed;

    // Применение движения
    const moveDistance = player.speed;
    player.position.x += Math.sin(player.rotation) * moveDistance;
    player.position.z += Math.cos(player.rotation) * moveDistance;

    // Ограничение карты
    player.position.x = Math.max(-MAP_SIZE + BOUNDARY_PADDING, Math.min(MAP_SIZE - BOUNDARY_PADDING, player.position.x));
    player.position.z = Math.max(-MAP_SIZE + BOUNDARY_PADDING, Math.min(MAP_SIZE - BOUNDARY_PADDING, player.position.z));

    // Синхронизация машины с игроком
    player.mesh.position.set(player.position.x, 0, player.position.z);
    player.mesh.rotation.y = player.rotation;

    // Скорость для UI
    player.currentSpeed = player.speed * 3.6; // м/с в км/ч
  } else {
    // Пешком (упрощено)
    if (keys.w) player.position.z -= 0.2;
    if (keys.s) player.position.z += 0.2;
    if (keys.a) player.position.x -= 0.2;
    if (keys.d) player.position.x += 0.2;
    player.mesh.position.set(player.position.x, 0, player.position.z);
    player.currentSpeed = 0;
  }

  // Вход/выход из авто
  if (keys.e) {
    keys.e = false; // сброс, чтобы не срабатывало постоянно
    player.inCar = !player.inCar;
    document.getElementById('status').innerText = player.inCar ? "Status: In Car" : "Status: On Foot";
    document.getElementById('status').style.color = player.inCar ? "#4ade80" : "#f87171";
  }

  // Камера следует за игроком
  camera.position.x = player.position.x;
  camera.position.z = player.position.z;
  camera.lookAt(player.position.x, 0, player.position.z);
}

// --- ОТРИСОВКА ---
function animate() {
  requestAnimationFrame(animate);
  update();
  
  // Обновление UI
  document.getElementById('speed').innerText = `Speed: \${Math.floor(player.currentSpeed)} km/h`;
  
  renderer.render(scene, camera);
}

// --- ЗАПУСК ---
startNextMission(); // первая миссия при старте
animate();
