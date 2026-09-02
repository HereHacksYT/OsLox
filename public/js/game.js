// ===== 3D OYUN MOTORU =====
class Game3D {
  constructor(container, roomId, socket, username) {
    this.container = container;
    this.roomId = roomId;
    this.socket = socket;
    this.username = username;
    this.players = {};
    this.character = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.keys = { left: false, right: false, forward: false, backward: false };
    this.isRunning = false;
    this.joystickData = { x: 0, y: 0 };
  }

  init() {
    // Sahne
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);

    // Kamera
    this.camera = new THREE.PerspectiveCamera(50, this.container.clientWidth / this.container.clientHeight, 0.1, 100);
    this.camera.position.set(0, 12, 18);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    // Işık
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(10, 20, 5);
    dirLight.castShadow = true;
    this.scene.add(dirLight);

    // ZEMİN
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshStandardMaterial({ color: 0x2ecc71 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const grid = new THREE.GridHelper(30, 30, 0xffffff, 0x444444);
    this.scene.add(grid);

    // Dekorasyon
    this.addDecorations();

    // KARAKTERİ YÜKLE (model.glb)
    this.loadCharacter();

    // Socket olayları
    this.socket.on('current_players', (players) => {
      players.forEach(p => this.addPlayer(p.id, p.username, p.position));
    });
    this.socket.on('player_joined', (data) => {
      this.addPlayer(data.id, data.username, data.position);
    });
    this.socket.on('player_moved', ({ id, position }) => {
      if (this.players[id]) {
        this.players[id].mesh.position.set(position.x, position.y, position.z);
      }
    });
    this.socket.on('player_left', ({ id }) => {
      this.removePlayer(id);
    });

    // Hareket gönder
    setInterval(() => {
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

    window.addEventListener('resize', () => this.onResize());

    // YÜKLEME BİTTİ
    document.getElementById('loading-overlay').style.display = 'none';
    
    // Mobil uyarıyı göster (sadece oyun açıkken)
    if (window.innerWidth < 768 && window.innerHeight > window.innerWidth) {
      document.getElementById('rotate-warning').style.display = 'flex';
    }

    this.isRunning = true;
    this.animate();
  }

  loadCharacter() {
    const loader = new THREE.GLTFLoader();
    const modelPath = '/assets/models/model.glb';
    
    loader.load(modelPath, (gltf) => {
      const model = gltf.scene;
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
    }, undefined, (error) => {
      console.error('Model yüklenemedi:', error);
      // Yedek küp
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 1.2, 0.5),
        new THREE.MeshStandardMaterial({ color: 0xe94560 })
      );
      mesh.position.set(0, 0, 0);
      this.scene.add(mesh);
      this.character = mesh;
      this.players[this.socket.id] = {
        mesh: mesh,
        username: this.username,
        position: mesh.position
      };
    });
  }

  addPlayer(id, username, position) {
    if (this.players[id]) return;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 1.2, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x3498db })
    );
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

  addDecorations() {
    const colors = [0x8B4513, 0xf1c40f, 0xe74c3c, 0x3498db];
    for (let i = 0; i < 15; i++) {
      const x = (Math.random() - 0.5) * 26;
      const z = (Math.random() - 0.5) * 26;
      if (Math.abs(x) < 2 && Math.abs(z) < 2) continue;
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.5, 0.5),
        new THREE.MeshStandardMaterial({ color: colors[i % colors.length] })
      );
      box.position.set(x, 0, z);
      box.castShadow = true;
      this.scene.add(box);
    }
  }

  // ===== JOYSTICK =====
  setupJoystick() {
    const container = document.getElementById('joystick-container');
    const knob = document.getElementById('joystick-knob');
    const radius = 40;
    let isDragging = false;

    const handleMove = (clientX, clientY) => {
      const rect = container.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      let x = clientX - rect.left - centerX;
      let y = clientY - rect.top - centerY;
      const dist = Math.sqrt(x*x + y*y);
      if (dist > radius) { x = (x / dist) * radius; y = (y / dist) * radius; }
      knob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
      this.joystickData.x = x / radius;
      this.joystickData.y = -y / radius;
    };

    const resetJoystick = () => {
      isDragging = false;
      knob.style.transform = 'translate(-50%, -50%)';
      this.joystickData.x = 0;
      this.joystickData.y = 0;
    };

    container.addEventListener('touchstart', (e) => {
      e.preventDefault();
      isDragging = true;
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });
    container.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!isDragging) return;
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });
    container.addEventListener('touchend', (e) => {
      e.preventDefault();
      resetJoystick();
    }, { passive: false });

    setInterval(() => {
      if (!this.character) return;
      const threshold = 0.15;
      this.keys.left = this.joystickData.x < -threshold;
      this.keys.right = this.joystickData.x > threshold;
      this.keys.forward = this.joystickData.y > threshold;
      this.keys.backward = this.joystickData.y < -threshold;
    }, 50);
  }

  // ===== KLAVYE =====
  onKeyDown(e) {
    switch(e.key) {
      case 'ArrowLeft': this.keys.left = true; e.preventDefault(); break;
      case 'ArrowRight': this.keys.right = true; e.preventDefault(); break;
      case 'ArrowUp': this.keys.forward = true; e.preventDefault(); break;
      case 'ArrowDown': this.keys.backward = true; e.preventDefault(); break;
      case ' ':
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

  update() {
    if (!this.character) return;
    const speed = 0.12;
    let dx = 0, dz = 0;
    if (this.keys.left) dx = -speed;
    if (this.keys.right) dx = speed;
    if (this.keys.forward) dz = -speed;
    if (this.keys.backward) dz = speed;
    if (dx !== 0 && dz !== 0) { dx *= 0.707; dz *= 0.707; }
    this.character.position.x += dx;
    this.character.position.z += dz;
    if (this.character.position.y > 0) {
      this.character.position.y -= 0.03;
    }
    if (this.character.position.y < 0) this.character.position.y = 0;

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
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    this.renderer.dispose();
    this.container.innerHTML = '';
  }
}
