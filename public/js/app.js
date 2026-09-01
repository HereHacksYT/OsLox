// ===== ANA UYGULAMA =====
let currentUser = localStorage.getItem('oslox_user') || null;
let socket = null;
let currentRoom = null;
let gameInstance = null;

// DOM
const loginScreen = document.getElementById('login-screen');
const mainPanel = document.getElementById('main-panel');
const gameScreen = document.getElementById('game-screen');
const loginUsername = document.getElementById('login-username');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');
const profileUsername = document.getElementById('profile-username');
const profileAvatar = document.getElementById('profile-avatar');
const gameList = document.getElementById('game-list');
const friendsList = document.getElementById('friends-list');
const logoutBtn = document.getElementById('logout-btn');
const characterBtn = document.getElementById('character-btn');
const characterModal = document.getElementById('character-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const exitGameBtn = document.getElementById('exit-game-btn');

// ===== GİRİŞ =====
function login(username) {
  if (!username.trim()) return showError('Kullanıcı adı girin');
  currentUser = username;
  localStorage.setItem('oslox_user', username);
  loginScreen.style.display = 'none';
  mainPanel.style.display = 'flex';
  profileUsername.textContent = username;
  profileAvatar.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
  loadGames();
  loadFriends();
  socket = io();
}

function showError(msg) {
  loginError.textContent = msg;
  setTimeout(() => loginError.textContent = '', 3000);
}

// ===== OYUN LİSTESİ =====
async function loadGames() {
  try {
    const res = await fetch('/api/games');
    const games = await res.json();
    gameList.innerHTML = games.map(game => `
      <div class="game-card" data-id="${game.id}" data-scene="${game.scene}">
        <img src="${game.thumbnail}" alt="${game.name}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22120%22%3E%3Crect width=%22200%22 height=%22120%22 fill=%22%232a2a4a%22/%3E%3Ctext x=%2250%22 y=%2260%22 fill=%22%23aaa%22 font-size=%2220%22%3E${game.name}%3C/text%3E%3C/svg%3E'">
        <div class="game-info">
          <h4>${game.name}</h4>
          <p>${game.description}</p>
        </div>
      </div>
    `).join('');

    document.querySelectorAll('.game-card').forEach(card => {
      card.addEventListener('click', () => {
        const gameId = card.dataset.id;
        const scene = card.dataset.scene;
        startGame(gameId, scene);
      });
    });
  } catch (e) {
    console.error('Oyunlar yüklenemedi:', e);
  }
}

// ===== OYUN BAŞLAT =====
function startGame(gameId, scene) {
  const loadingOverlay = document.getElementById('loading-overlay');
  const progress = document.getElementById('loading-progress');
  const loadingText = document.getElementById('loading-text');
  loadingOverlay.style.display = 'flex';
  progress.style.width = '0%';
  
  let p = 0;
  const interval = setInterval(() => {
    p += Math.random() * 15 + 5;
    if (p >= 100) {
      p = 100;
      clearInterval(interval);
      initGame(gameId, scene);
      loadingOverlay.style.display = 'none';
    }
    progress.style.width = p + '%';
    loadingText.textContent = `Yükleniyor %${Math.floor(p)}`;
  }, 200);

  mainPanel.style.display = 'none';
  gameScreen.style.display = 'flex';
}

function initGame(gameId, scene) {
  const container = document.getElementById('game-container');
  const roomId = gameId + '_' + Date.now();
  
  // Seçili karakter
  const character = Character.getCurrent();
  
  socket.emit('join_room', { roomId, username: currentUser, characterId: character.id });
  
  Chat.init(socket, roomId);
  
  gameInstance = new Game3D(container, roomId, socket, currentUser, character.id);
  gameInstance.init();
  
  currentRoom = roomId;
  
  exitGameBtn.onclick = () => {
    if (confirm('Oyundan çıkmak istediğinize emin misiniz?')) {
      exitGame();
    }
  };
}

function exitGame() {
  if (gameInstance) {
    gameInstance.destroy();
    gameInstance = null;
  }
  if (socket) {
    socket.emit('leave_room', { roomId: currentRoom });
  }
  gameScreen.style.display = 'none';
  mainPanel.style.display = 'flex';
  currentRoom = null;
}

// ===== ARKADAŞ (basit) =====
function loadFriends() {
  const friends = JSON.parse(localStorage.getItem('oslox_friends') || '[]');
  friendsList.innerHTML = friends.length 
    ? friends.map(f => `<li>${f}</li>`).join('')
    : '<li style="color:#888;">Henüz arkadaş yok</li>';
}

// ===== KARAKTER MODAL =====
characterBtn.addEventListener('click', () => {
  Character.loadModal();
  characterModal.classList.add('active');
});
closeModalBtn.addEventListener('click', () => {
  characterModal.classList.remove('active');
});
characterModal.addEventListener('click', (e) => {
  if (e.target === characterModal) characterModal.classList.remove('active');
});

// ===== ÇIKIŞ =====
logoutBtn.addEventListener('click', () => {
  if (confirm('Çıkış yapmak istediğinize emin misiniz?')) {
    localStorage.removeItem('oslox_user');
    location.reload();
  }
});

// ===== GİRİŞ BUTONU =====
loginBtn.addEventListener('click', () => login(loginUsername.value));
loginUsername.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') login(loginUsername.value);
});

// ===== OTOMATİK GİRİŞ =====
if (currentUser) {
  login(currentUser);
}
