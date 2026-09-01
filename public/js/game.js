// ===== 3D OYUN MOTORU (Three.js) =====
class Game3D {
  constructor(container, roomId, socket, username, avatar) {
    this.container = container;
    this.roomId = roomId;
    this.socket = socket;
    this.username = username;
    this.avatar = avatar;
    this.players = {}; // socketId -> { mesh, username, position }
    this.character = null; // yerel oyuncu
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.clock = new THREE.Clock();
    this.keys = { left: false, right: false, forward: false, backward: false };
    this.isRunning = false;
  }

  init() {
    // Sahne
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);

    // Kamera
    this.camera = new THREE.PerspectiveCamera(60, this.container.clientWidth / this.container.clientHeight, 0.1, 1000);
    this.camera.position.set(0, 8, 12);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    // Işık
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 5);
    dirLight.castShadow = true;
    this.scene.add(dirLight);

    // Zemin
    const groundGeo = new THREE.PlaneGeometry(20, 20);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x2ecc71 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Izgara (yardımcı)
    const gridHelper = new THREE.GridHelper(20, 20, 0xffffff, 0x444444);
    this.scene.add(gridHelper);

    // Oyuncu karakterini oluştur
    this.createPlayer();

    // Diğer oyuncular için dinleyiciler
    this.socket.on('current_players', (players) => {
      players.forEach(p => this.addPlayer(p.id, p.username, p.avatar, p.position));
    });
    this.socket.on('player_joined', (data) => {
      this.addPlayer(data.id, data.username, data.avatar, data.position);
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

    // Hareket gönderimi
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

    // Pencere boyutu
    window.addEventListener('resize', () => this.onResize());

    this.isRunning = true;
    this.animate();
  }

  createPlayer() {
    // Karakter grubu
    const group = new THREE.Group();

    // Gövde (tişört)
    const bodyGeo = new THREE.BoxGeometry(0.8, 0.8, 0.5);
    const bodyMat = new THREE.MeshStandardMaterial({ color: this.avatar.shirt });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.4;
    body.castShadow = true;
    group.add(body);
    group.shirtMesh = body; // avatar.js için referans

    // Pantolon
    const pantsGeo = new THREE.BoxGeometry(0.7, 0.4, 0.5);
    const pantsMat = new THREE.MeshStandardMaterial({ color: this.avatar.pants });
    const pants = new THREE.Mesh(pantsGeo, pantsMat);
    pants.position.y = 0;
    pants.castShadow = true;
    group.add(pants);
    group.pantsMesh = pants;

    // Kafa
    const headGeo = new THREE.SphereGeometry(0.3, 16, 16);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xf1c40f });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.9;
    head.castShadow = true;
    group.add(head);

    // Şapka (varsa)
    let hatMesh = null;
    if (this.avatar.hat !== 'none') {
      const hatGeo = new THREE.ConeGeometry(0.3, 0.2, 8);
      const hatMat = new THREE.MeshStandardMaterial({ color: 0xe67e22 });
      hatMesh = new THREE.Mesh(hatGeo, hatMat);
      hatMesh.position.y = 1.1;
      hatMesh.castShadow = true;
      group.add(hatMesh);
    }
    group.hatMesh = hatMesh;

    // Yerleştir
    group.position.set(0, 0, 0);
    this.scene.add(group);
    this.character = group;
    this.players[this.socket.id] = {
      mesh: group,
      username: this.username,
      position: group.position
    };
  }

  addPlayer(id, username, avatar, position) {
    if (this.players[id]) return;
    // Aynı karakter oluşturma mantığı (avatar ile)
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: avatar.shirt || '#e94560' });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.5), bodyMat);
    body.position.y = 0.4;
    group.add(body);
    const pantsMat = new THREE.MeshStandardMaterial({ color: avatar.pants || '#2d3436' });
    const pants = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.5), pantsMat);
    pants.position.y = 0;
    group.add(pants);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), new THREE.MeshStandardMaterial({ color: 0xf1c40f }));
    head.position.y = 0.9;
    group.add(head);
    // İsim etiketi (isteğe bağlı)
    group.position.set(position.x, position.y, position.z);
    this.scene.add(group);
    this.players[id] = { mesh: group, username, position: group.position };
  }

  removePlayer(id) {
    if (this.players[id]) {
      this.scene.remove(this.players[id].mesh);
      delete this.players[id];
    }
  }

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

  update() {
    if (!this.character) return;
    const speed = 0.1;
    let dx = 0, dz = 0;
    if (this.keys.left) dx = -speed;
    if (this.keys.right) dx = speed;
    if (this.keys.forward) dz = -speed;
    if (this.keys.backward) dz = speed;
    // Normalize
    if (dx !== 0 && dz !== 0) {
      dx *= 0.707;
      dz *= 0.707;
    }
    this.character.position.x += dx;
    this.character.position.z += dz;
    // Yerçekimi (basit)
    if (this.character.position.y > 0) {
      this.character.position.y -= 0.02;
    }
    if (this.character.position.y < 0) this.character.position.y = 0;

    // Kamera takip
    if (this.camera) {
      const pos = this.character.position;
      this.camera.position.x = pos.x;
      this.camera.position.z = pos.z + 10;
      this.camera.lookAt(pos.x, 0, pos.z);
    }
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
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    this.renderer.dispose();
    this.container.innerHTML = '';
  }
}
