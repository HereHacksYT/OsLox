// ===== 3D OYUN MOTORU (Three.js) =====
class Game3D {
  constructor(container, roomId, socket, username, characterId) {
    this.container = container;
    this.roomId = roomId;
    this.socket = socket;
    this.username = username;
    this.characterId = characterId;
    this.players = {};
    this.character = null; // yerel oyuncu mesh'i
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.clock = new THREE.Clock();
    this.keys = { left: false, right: false, forward: false, backward: false };
    this.isRunning = false;
    this.joystickActive = false;
    this.joystickData = { x: 0, y: 0 };
  }

  init() {
    // Sahne
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);

    // Kamera (uzaklaştırılmış, harita büyük)
    this.camera = new THREE.PerspectiveCamera(50, this.container.clientWidth / this.container.clientHeight, 0.1, 100);
    this.camera.position.set(0, 15, 20);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    // Işık
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(10, 20, 5);
    dirLight.castShadow = true;
    this.scene.add(dirLight);

    // BÜYÜK ZEMİN (30x30)
    const groundGeo = new THREE.PlaneGeometry(30, 30);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x2ecc71 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Izgara yardımcı (büyük)
    const gridHelper = new THREE.GridHelper(30, 30, 0xffffff, 0x444444);
    this.scene.add(gridHelper);

    // Bazı nesneler (ağaç, kutu vb.) haritayı dolduralım
    this.addDecorations();

    // Karakteri yükle
    this.loadCharacter();

    // Diğer oyuncular
    this.socket.on('current_players', (players) => {
      players.forEach(p => this.addPlayer(p.id, p.username, p.characterId, p.position));
    });
    this.socket.on('player_joined', (data) => {
      this.addPlayer(data.id, data.username, data.characterId, data.position);
    });
    this.socket.on('player_moved', ({ id, position }) => {
      if (this.players[id]) {
        this.players[id].position.copy(position);
        this.players[id].mesh.position.copy(position);
      }
    });
    this.socket.on('player_left', ({ id }) => {
      this.removePlayer(id);
    });

    // Hareket gönderimi (saniyede 10 kez)
    this.sendPositionInterval = setInterval(() => {
      if (this.character) {
        const pos = this.character.position;
        this.socket.emit('player_move', {
          roomId: this.roomId,
          position: { x: pos.x, y: pos.y, z: pos.z }
        });
      }
    }, 100);

    // Klavye
    document.addEventListener('keydown', (e) => this.onKeyDown(e));
    document.addEventListener('keyup', (e) => this.onKeyUp(e));

    // Joystick
    this.setupJoystick();

    // Pencere boyutu
    window.addEventListener('resize', () => this.onResize());

    this.isRunning = true;
    this.animate();
  }

  addDecorations() {
    // Rastgele ağaçlar (küre + silindir)
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x228B22 });
    for (let i = 0; i < 20; i++) {
      const x = (Math.random() - 0.5) * 28;
      const z = (Math.random() - 0.5) * 28;
      if (Math.abs(x) < 2 && Math.abs(z) < 2) continue; // merkeze yakın koyma
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.8), treeMat);
      trunk.position.set(x, -0.1, z);
      this.scene.add(trunk);
      const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), leafMat);
      leaves.position.set(x, 0.6, z);
      this.scene.add(leaves);
    }
    // Bazı kutular
    const boxMat = new THREE.MeshStandardMaterial({ color: 0xf1c40f });
    for (let i = 0; i < 10; i++) {
      const x = (Math.random() - 0.5) * 26;
      const z = (Math.random() - 0.5) * 26;
      if (Math.abs(x) < 3 && Math.abs(z) < 3) continue;
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), boxMat);
      box.position.set(x, 0, z);
      box.castShadow = true;
      this.scene.add(box);
    }
  }

  loadCharacter() {
    const loader = new THREE.GLTFLoader();
    Character.loadModel(loader, (gltf) => {
      const model = gltf.scene || gltf;
      model.scale.set(0.8, 0.8, 0.8);
      model.position.set(0, 0, 0);
      model.castShadow = true;
      this.scene.add(model);
      this.character = model;
      this.players[this.socket.id] = {
        mesh: model,
        username: this.username,
        position: model.position
      };
    });
  }

  addPlayer(id, username, characterId, position) {
    if (this.players[id]) return;
    // Diğer oyuncular için de karakter modeli yüklenebilir, ama basitlik için küp kullanalım
    const geo = new THREE.BoxGeometry(0.8, 1.2, 0.5);
    const mat = new THREE.MeshStandardMaterial({ color: 0x3498db });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(position.x, position.y, position.z);
    this.scene.add(mesh);
    this.players[id] = { mesh, username, position: mesh.position };
  }

  removePlayer(id) {
    if (this.players[id]) {
      this.scene.remove(this.players[id].mesh);
      delete this.players[id];
    }
  }

  // ===== JOYSTICK =====
  setupJoystick() {
    const container = document.getElementById('joystick-container');
    const knob = document.getElementById('joystick-knob');
    const radius = 40;
    let centerX = 60;
    let centerY = 60;
    let isDragging = false;

    const handleMove = (clientX, clientY) => {
      const rect = container.getBoundingClientRect();
      centerX = rect.width / 2;
      centerY = rect.height / 2;
      let x = clientX - rect.left - centerX;
      let y = clientY - rect.top - centerY;
      const dist = Math.sqrt(x*x + y*y);
      if (dist > radius) {
        x = (x / dist) * radius;
        y = (y / dist) * radius;
      }
      knob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
      // Joystick verisini güncelle (normalize -1..1)
      this.joystickData.x = x / radius;
      this.joystickData.y = -y / radius; // y ekseni ters
    };

    const resetJoystick = () => {
      isDragging = false;
      knob.style.transform = 'translate(-50%, -50%)';
      this.joystickData.x = 0;
      this.joystickData.y = 0;
      this.keys.left = false;
      this.keys.right = false;
      this.keys.forward = false;
      this.keys.backward = false;
    };

    // Dokunmatik
    container.addEventListener('touchstart', (e) => {
      e.preventDefault();
      isDragging = true;
      const touch = e.touches[0];
      handleMove(touch.clientX, touch.clientY);
    }, { passive: false });

    container.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!isDragging) return;
      const touch = e.touches[0];
      handleMove(touch.clientX, touch.clientY);
    }, { passive: false });

    container.addEventListener('touchend', (e) => {
      e.preventDefault();
      resetJoystick();
    }, { passive: false });

    // Fare desteği (masaüstünde test)
    container.addEventListener('mousedown', (e) => {
      isDragging = true;
      handleMove(e.clientX, e.clientY);
    });
    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      handleMove(e.clientX, e.clientY);
    });
    window.addEventListener('mouseup', () => {
      if (isDragging) resetJoystick();
    });

    // Joystick'ten gelen hareketi oyuna aktar (her frame'de)
    this.joystickInterval = setInterval(() => {
      if (!this.character) return;
      const threshold = 0.15;
      const x = this.joystickData.x;
      const y = this.joystickData.y;
      this.keys.left = x < -threshold;
      this.keys.right = x > threshold;
      this.keys.forward = y > threshold;
      this.keys.backward = y < -threshold;
    }, 50);
  }

  // ===== KLAVYE =====
  onKeyDown(e) {
    switch(e.key) {
      case 'ArrowLeft': this.keys.left = true; e.preventDefault(); break;
      case 'ArrowRight': this.keys.right = true; e.preventDefault(); break;
      case 'ArrowUp': this.keys.forward = true; e.preventDefault(); break;
      case 'ArrowDown': this.keys.backward = true; e.preventDefault(); break;
      case ' ': // zıplama
        if (this.character && this.character.position.y <= 0.1) {
          this.character.position.y = 0.5;
        }
        e.preventDefault();
        break;
    }
  }

  onKeyUp(e) {
    switch(e.key) {
      case 'ArrowLeft': this.keys.left = false; e.preventDefault(); break;
      case 'ArrowRight': this.keys.right = false; e.preventDefault(); break;
      case 'ArrowUp': this.keys.forward = false; e.preventDefault(); break;
      case 'ArrowDown': this.keys.backward = false; e.preventDefault(); break;
    }
  }

  // ===== GÜNCELLEME =====
  update() {
    if (!this.character) return;
    const speed = 0.12;
    let dx = 0, dz = 0;
    if (this.keys.left) dx = -speed;
    if (this.keys.right) dx = speed;
    if (this.keys.forward) dz = -speed;
    if (this.keys.backward) dz = speed;
    if (dx !== 0 && dz !== 0) {
      dx *= 0.707;
      dz *= 0.707;
    }
    this.character.position.x += dx;
    this.character.position.z += dz;
    // Yerçekimi
    if (this.character.position.y > 0) {
      this.character.position.y -= 0.03;
    }
    if (this.character.position.y < 0) this.character.position.y = 0;

    // Kamera takip (uzak ve yüksekten)
    const pos = this.character.position;
    this.camera.position.x = pos.x;
    this.camera.position.z = pos.z + 18;
    this.camera.position.y = 12;
    this.camera.lookAt(pos.x, 0, pos.z);
  }

  animate() {
    if (!this.isRunning) return;
    requestAnimationFrame(() => this.animate());
    this.update();
    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  destroy() {
    this.isRunning = false;
    clearInterval(this.sendPositionInterval);
    clearInterval(this.joystickInterval);
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    this.renderer.dispose();
    this.container.innerHTML = '';
  }
}
