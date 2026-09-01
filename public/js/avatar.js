// ===== AVATAR / KOSTÜM YÖNETİMİ =====
const Avatar = {
  current: {
    shirt: localStorage.getItem('oslox_shirt') || '#e94560',
    pants: localStorage.getItem('oslox_pants') || '#2d3436',
    hat: localStorage.getItem('oslox_hat') || 'none'
  },

  save() {
    localStorage.setItem('oslox_shirt', this.current.shirt);
    localStorage.setItem('oslox_pants', this.current.pants);
    localStorage.setItem('oslox_hat', this.current.hat);
    // UI'ı güncelle
    document.getElementById('shirt-color').value = this.current.shirt;
    document.getElementById('pants-color').value = this.current.pants;
    document.getElementById('hat-select').value = this.current.hat;
  },

  load() {
    this.current.shirt = localStorage.getItem('oslox_shirt') || '#e94560';
    this.current.pants = localStorage.getItem('oslox_pants') || '#2d3436';
    this.current.hat = localStorage.getItem('oslox_hat') || 'none';
    // Modal'daki değerleri güncelle
    document.getElementById('shirt-color').value = this.current.shirt;
    document.getElementById('pants-color').value = this.current.pants;
    document.getElementById('hat-select').value = this.current.hat;
    return this.current;
  },

  // Kostümü Three.js karakterine uygula (game.js'de kullanılacak)
  applyToCharacter(character) {
    // Bu fonksiyon game.js tarafından çağrılacak
    // Karakterin malzemelerini güncelle
    if (character.shirtMesh) {
      character.shirtMesh.material.color.set(this.current.shirt);
    }
    if (character.pantsMesh) {
      character.pantsMesh.material.color.set(this.current.pants);
    }
    // Şapka göster/gizle
    if (character.hatMesh) {
      character.hatMesh.visible = (this.current.hat !== 'none');
      // Şapka tipine göre model değiştirilebilir
    }
  }
};

// Modal event'leri
document.addEventListener('DOMContentLoaded', () => {
  const shirtInput = document.getElementById('shirt-color');
  const pantsInput = document.getElementById('pants-color');
  const hatSelect = document.getElementById('hat-select');
  const saveBtn = document.getElementById('save-costume-btn');

  // Mevcut değerleri yükle
  Avatar.load();

  shirtInput.addEventListener('input', () => {
    Avatar.current.shirt = shirtInput.value;
  });
  pantsInput.addEventListener('input', () => {
    Avatar.current.pants = pantsInput.value;
  });
  hatSelect.addEventListener('change', () => {
    Avatar.current.hat = hatSelect.value;
  });

  saveBtn.addEventListener('click', () => {
    Avatar.save();
    alert('Kostüm kaydedildi!');
    // Eğer oyun açıksa karakteri güncelle
    if (window.game && window.game.character) {
      Avatar.applyToCharacter(window.game.character);
    }
  });
});
