// ===== KARAKTER YÖNETİMİ =====
const Character = {
  // Karakter listesi (thumbnail ve model dosyası)
  list: [
    { id: 'knight', name: 'Şövalye', thumbnail: '/assets/thumbnails/characters/knight.jpg', model: '/assets/models/knight.glb' },
    { id:wizard', name: 'Büyücü', thumbnail: '/assets/thumbnails/characters/wizard.jpg', model: '/assets/models/wizard.glb' },
    { id: 'robot', name: 'Robot', thumbnail: '/assets/thumbnails/characters/robot.jpg', model: '/assets/models/robot.glb' },
  ],

  selected: localStorage.getItem('oslox_character') || 'knight',

  getCurrent() {
    return this.list.find(c => c.id === this.selected) || this.list[0];
  },

  save(id) {
    this.selected = id;
    localStorage.setItem('oslox_character', id);
    // Modal'daki seçimi güncelle
    document.querySelectorAll('.char-card').forEach(el => {
      el.classList.toggle('selected', el.dataset.id === id);
    });
  },

  loadModal() {
    const container = document.getElementById('character-options');
    container.innerHTML = this.list.map(c => `
      <div class="char-card ${c.id === this.selected ? 'selected' : ''}" data-id="${c.id}">
        <img src="${c.thumbnail}" alt="${c.name}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22%3E%3Crect width=%2280%22 height=%2280%22 fill=%22%23333%22/%3E%3Ctext x=%2240%22 y=%2245%22 text-anchor=%22middle%22 fill=%22%23aaa%22 font-size=%2212%22%3E${c.name}%3C/text%3E%3C/svg%3E'">
        <div class="char-name">${c.name}</div>
      </div>
    `).join('');

    // Tıklama olayları
    container.querySelectorAll('.char-card').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.id;
        this.save(id);
        // Modal'ı güncelle (seçili olanı vurgula)
        container.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected'));
        el.classList.add('selected');
      });
    });
  },

  // Modeli yükle (game.js'de kullanılacak)
  loadModel(loader, callback) {
    const char = this.getCurrent();
    loader.load(char.model, (gltf) => {
      callback(gltf);
    }, undefined, (error) => {
      console.error('Model yüklenemedi:', error);
      // Hata durumunda yedek bir model oluşturalım (basit küp)
      const geo = new THREE.BoxGeometry(0.8, 1.2, 0.5);
      const mat = new THREE.MeshStandardMaterial({ color: 0xe94560 });
      const mesh = new THREE.Mesh(geo, mat);
      callback({ scene: mesh });
    });
  }
};

// Modal açılışında listeyi doldur
document.addEventListener('DOMContentLoaded', () => {
  Character.loadModal();
});
