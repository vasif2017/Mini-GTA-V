// --- КОНФИГУРАЦИЯ ---
const MAP_SIZE = 60; // Уменьшили карту для мобилок
const BOUNDARY_PADDING = 4;

// --- ИНИЦИАЛИЗАЦИЯ ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
// Чуть менее плотный туман для лучшей видимости на маленьких экранах
scene.fog = new THREE.FogExp2(0x87CEEB, 0.035); 

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 15, 25);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// --- ОСВЕЩЕНИЕ ---
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(50, 100, 50);
dirLight.castShadow = true;
dirLight.shadow.camera.left = -MAP_SIZE;
dirLight.shadow.camera.right = MAP_SIZE;
dirLight.shadow.camera.top = MAP_SIZE;
dirLight.shadow.camera.bottom = -MAP_SIZE;
scene.add(dirLight);

// --- ГЕНЕРАЦИЯ ТЕКСТУРЫ ДОРОГИ (Упрощенная) ---
const roadCanvas = document.createElement('canvas');
roadCanvas.width = 256; // Меньше разрешение текстуры
roadCanvas.height = 256;
const ctx = roadCanvas.getContext('2d');

ctx.fillStyle = '#333333';
ctx.fillRect(0, 0, 256, 256);
// Меньше "шума" на дороге для производительности
for(let i=0; i<300; i++) {
  const x = Math.random() * 256;
  const y = Math.random() * 256;
  ctx.fillStyle = Math.random() > 0.5 ? '#222' : '#444';
  ctx.fillRect(x, y, 2, 2);
}
ctx.strokeStyle = '#ffffaa';
ctx.lineWidth = 6;
ctx.beginPath();
ctx.moveTo(0, 128);
ctx.lineTo(256, 128);
ctx.stroke();

const roadTexture = new THREE.CanvasTexture(roadCanvas);
roadTexture.wrapS = THREE.RepeatWrapping;
roadTexture.wrapT = THREE.RepeatWrapping;
roadTexture.repeat.set(1, 1); // Упростили тайлинг

const floorGeo = new THREE.PlaneGeometry(MAP_SIZE * 2, MAP_SIZE * 2);
const roadMat = new THREE.MeshStandardMaterial({ map: roadTexture, roughness: 0.8 });
const floor = new THREE.Mesh(floorGeo, roadMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// --- ГЕНЕРАЦИЯ ГОРОДА (ОПТИМИЗИРОВАНО) ---
function createBuilding(x, z, height, color) {
  const group = new THREE.Group();
  
  const bGeo = new THREE.BoxGeometry(6, height, 6); // Здания чуть меньше
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

  const roofGeo = new THREE.BoxGeometry(6.2, 0.4, 6.2);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.set(0, height / 2 + 0.2, 0);
  group.add(roof);

  // ОПТИМИЗАЦИЯ: Меньше окон!
  const winMat = new THREE.MeshStandardMaterial({ color: 0xffffaa, roughness: 0.2 });
  const rows = Math.floor(height / 3); // Реже окна
  
  for (let r = 0; r < rows; r++) {
    for (let side = 0; side < 4; side++) {
      const wGeo = new THREE.BoxGeometry(1.2, 1.2, 0.1); // Окна меньше
      const windowMesh = new THREE.Mesh(wGeo, winMat);
      
      let wx = 0, wz = 0;
      if (side === 0) { wx = 3; wz = 2.9; }
      else if (side === 1) { wx = -3; wz = 2.9; }
      else if (side === 2) { wx = 2.9; wz = 3; }
      else if (side === 3) { wx = 2.9; wz = -3; }

      windowMesh.position.set(wx, (r * 3) + 0.6, wz);
      group.add(windowMesh);
    }
  }
  
  group.position.set(x, 0, z);
  scene.add(group);
  return group;
}

const colors = [0xcccccc, 0xd2b48c, 0x8b4513, 0x708090];
// Здания ставятся реже, чтобы не забивать память телефона
for (let i = -MAP_SIZE; i <= MAP_SIZE; i += 15) {
  for (let j = -MAP_SIZE; j <= MAP_SIZE; j += 15) {
    if (Math.abs(i) < 10 && Math.abs(j) < 10) continue;
    const h = 6 + Math.random() * 10;
    createBuilding(i, j, h, colors[Math.floor(Math.random() * colors.length)]);
  }
}

// --- УЛИЧНЫЕ ФОНАРИ (Меньше фонарей) ---
function createLamp(x, z) {
  const lamp = new THREE.Group();
  const poleGeo = new THREE.CylinderGeometry(0.1, 0.1, 3, 16); // Меньше сегментов
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.y = 1.5;
  lamp.add(pole);

  const light = new THREE.PointLight(0xffffff, 0.4, 12); // Свет чуть слабее
  light.position.set(0, 3, 0);
  lamp.add(light);
  
  lamp.position.set(x, 0, z);
  scene.add(lamp);
}
for (let i = -MAP_SIZE; i <= MAP_SIZE; i += 25) {
  for (let j = -MAP_SIZE; j <= MAP_SIZE; j += 25) {
    createLamp(i, j);
  }
}

// --- МАШИНА (Упрощенная геометрия) ---
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

const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.8, 16); // Меньше сегментов у колес
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
const wheelPositions = [
  { x: 1, y: 0.6, z: 2.2 },
  { x: -1, y: 0.6, z: 2.2 },
  { x: 1, y: 0.6, z: -2.2 },
  { x: -1, y: 0.6, z: -2.2 }
];
wheelPositions.forEach(pos => {
  const wheel = new THREE.Mesh(wheelGeo, wheelMat);
  wheel.position.set(pos.x, pos.y, pos.z);
  wheel.rotation.z = Math.PI / 2;
  wheel.castShadow = true;
  car.add(wheel);
});

car.position.set(-15, 0, -15);
scene.add(car);

// Номерной знак
const plateCanvas = document.createElement('canvas');
plateCanvas.width = 128; plateCanvas.height = 64; // Меньше текстура номера
const pCtx = plateCanvas.getContext('2d');
pCtx.fillStyle = 'white'; pCtx.fillRect(0,0,128,64);
pCtx.fillStyle = 'black'; pCtx.font = 'bold 30px Arial'; pCtx.textAlign = 'center'; pCtx.textBaseline = 'middle';
pCtx.fillText('GTA-02', 64, 32);
const plateTex = new THREE.CanvasTexture(plateCanvas);
plateTex.colorSpace = THREE.SRGBColorSpace;
const plateMat = new THREE.MeshStandardMaterial({ map: plateTex });
const plate = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.05), plateMat);
plate.position.set(0, 1.2, -2.3);
car.add(plate);

// --- ИГРОК ---
const player = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), new THREE.MeshStandardMaterial({ color: 'red' }));
player.position.set(0, 0.6, 0);
scene.add(player);

// --- УПРАВЛЕНИЕ (INPUT) ---
const keys = { w: false, a: false, s: false, d: false, space: false, e: false };

// Функция для мобильных кнопок
window.setKey = function(key, value) {
  keys[key] = value;
};

window.addEventListener('keydown', e => {
  if (e.code === 'KeyW') keys.w = true; if (e.code === 'KeyA') keys.a = true;
  if (e.code === 'KeyS') keys.s = true; if (e.code === 'KeyD') keys.d = true;
  if (e.code === 'Space') keys.space = true; if (e.code === 'KeyE') keys.e = true;
});
window.addEventListener('keyup', e => {
  if (e.code === 'KeyW') keys.w = false; if (e.code === 'KeyA') keys.a = false;
  if (e.code === 'KeyS') keys.s = false; if (e.code === 'KeyD') keys.d = false;
  if (e.code === 'Space') keys.space = false; if (e.code === 'KeyE') keys.e = false;
});

let isMouseDown = false, yaw = 0, pitch = 0;
window.addEventListener('mousedown', () => isMouseDown = true);
window.addEventListener('mouseup', () => isMouseDown = false);
window.addEventListener('mousemove', (e) => {
  if (!isMouseDown) return;
  yaw -= e.movementX * 0.002;
  pitch -= e.movementY * 0.002;
  pitch = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, pitch));
});

let isInCar = false;
const statusEl = document.getElementById('status');
const speedEl = document.getElementById('speed');

// --- ФИЗИКА И ЛОГИКА ---
let velocity = new THREE.Vector3();
const speed = 0.4;
const jumpSpeed = 1.8;
const gravity = 0.015;
let isGrounded = true;

let carVelocity = 0;
const carMaxSpeed = 0.8;
const carAccel = 0.08;
const carFriction = 0.96;
const carTurnSpeed = 0.04;

function checkBoundary(pos) {
  const limit = MAP_SIZE - BOUNDARY_PADDING;
  if (pos.x > limit) pos.x = limit;
  if (pos.x < -limit) pos.x = -limit;
  if (pos.z > limit) pos.z = limit;
  if (pos.z < -limit) pos.z = -limit;
}

function updatePlayer() {
  velocity.set(0, 0, 0);
  if (keys.w) velocity.z -= speed; if (keys.s) velocity.z += speed;
  if (keys.a) velocity.x -= speed; if (keys.d) velocity.x += speed;
  if (velocity.length() > 0) velocity.normalize().multiplyScalar(speed);

  player.position.x += velocity.x;
  player.position.z += velocity.z;
  checkBoundary(player.position);

  if (!isGrounded) {
    player.position.y -= gravity;
    if (player.position.y <= 0.6) { player.position.y = 0.6; isGrounded = true; }
  } else if (keys.space) {
    player.position.y += jumpSpeed;
    isGrounded = false;
  }
}

function updateCar() {
  if (keys.w) carVelocity += carAccel; 
  if (keys.s) carVelocity -= carAccel;
  carVelocity *= carFriction;
  
  if (Math.abs(carVelocity) > 0.01) {
    if (keys.a) car.rotation.y += carTurnSpeed * (carVelocity / carMaxSpeed);
    if (keys.d) car.rotation.y -= carTurnSpeed * (carVelocity / carMaxSpeed);
  }

  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(car.quaternion);
  car.position.add(forward.multiplyScalar(carVelocity));
  
  car.children.forEach(child => {
    if (child.geometry instanceof THREE.CylinderGeometry) {
      child.rotation.x += carVelocity * 2;
    }
  });

  checkBoundary(car.position);
}

function checkEnterCar() {
  if (keys.e) {
    const target = isInCar ? player : car;
    const dist = player.position.distanceTo(target.position);
    if (dist < 5) {
      isInCar = !isInCar;
      keys.e = false;
      statusEl.textContent = isInCar ? 'Status: In Vehicle' : 'Status: On Foot';
    }
  }
}

const targetPos = new THREE.Vector3();
function updateCamera() {
  if (isInCar) {
    const offset = new THREE.Vector3(0, 3, 5).applyAxisAngle(new THREE.Vector3(0, 1, 0), car.rotation.y);
    camera.position.copy(car.position).add(offset);
    camera.lookAt(car.position);
    
    const currentSpeed = Math.abs(carVelocity) * 100;
    speedEl.textContent = `Speed: \${Math.floor(currentSpeed)} km/h`;
  } else {
    const offset = new THREE.Vector3(0, 7, 13);
    const moveAngle = Math.atan2(velocity.x, velocity.z) + Math.PI;
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), moveAngle);
    targetPos.copy(player.position).add(offset);
    camera.position.lerp(targetPos, 0.1); 

    const radius = 13.7;
    const vOffset = Math.sin(pitch) * radius;
    const hRadius = Math.cos(pitch) * radius;
    camera.position.set(
      player.position.x + Math.sin(yaw) * hRadius,
      player.position.y + 7 + vOffset,
      player.position.z + Math.cos(yaw) * hRadius
    );
    camera.lookAt(player.position.x, player.position.y, player.position.z);
    
    speedEl.textContent = `Speed: 0 km/h`;
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  if (isInCar) updateCar(); else updatePlayer();
  checkEnterCar();
  updateCamera();
  renderer.render(scene, camera);
}
animate();
