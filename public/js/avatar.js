// ===== KARAKTER YÖNETİMİ (TEK MODEL) =====
const Character = {
  selected: 'default',

  getCurrent() {
    return { id: 'default', name: 'Karakter', model: '/assets/models/model.glb' };
  },

  save() {
    // Tek model olduğu için bir şey yapmıyoruz
  },

  loadModal() {
    // Zaten sabit
  }
};
