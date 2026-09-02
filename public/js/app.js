let currentUser = localStorage.getItem('oslox_user') || null;
let socket = null;
let currentRoom = null;
let gameInstance = null;
let friends = JSON.parse(localStorage.getItem('oslox_friends') || '[]');

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
const friendInput = document.getElementById('friend-input');
const addFriendBtn = document.getElementById('add-friend-btn');
const friendRequests = document.getElementById('friend-requests');
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
  loadGames();  // ← OYUN LİSTESİNİ YÜKLE
  renderFriends();
  socket = io();
  socket.emit('register_user', username);
  
  socket.on('friend_request', ({ from }) => {
    alert(`📨 ${from} size arkadaşlık isteği gönderdi!`);
    showFriendRequest(from);
  });
  
  socket.on('friend_accepted', ({ friend }) => {
    if (!friends.includes(friend)) {
      friends.push(friend);
      localStorage.setItem('oslox_friends', JSON.stringify(friends));
      renderFriends();
      alert(`🎉 ${friend} ile arkadaş oldunuz!`);
    }
  });
}

function showError(msg) {
  loginError.textContent = msg;
  setTimeout(() => loginError.textContent = '', 3000);
}

// ============================================================
// SADECE BURASI DEĞİŞTİ - OYUN LİSTESİNİ GÖSTER (İSİM + THUMBNAIL)
// ============================================================
async function loadGames() {
  try {
    const res = await fetch('/api/games');
    const games = await res.json();
    
    // Oyunları listele - İSİM ve THUMBNAIL göster
    gameList.innerHTML = games.map(game => `
      <div class="game-card" data-id="${game.id}">
        <img src="${game.thumbnail}" alt="${game.name}" 
             onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22120%22%3E%3Crect width=%22200%22 height=%22120%22 fill=%22%232a2a4a%22/%3E%3Ctext x=%2250%22 y=%2260%22 fill=%22%23aaa%22 font-size=%2220%22%3E${game.name}%3C/text%3E%3C/svg%3E'">
        <div class="game-info">
          <h4>${game.name}</h4>  <!-- ← OYUN İSMİ -->
        </div>
      </div>
    `).join('');

    // Tıklayınca oyunu başlat
    document.querySelectorAll('.game-card').forEach(card => {
      card.addEventListener('click', () => {
        startGame(card.dataset.id);
      });
    });
  } catch (e) {
    console.error('Oyunlar yüklenemedi:', e);
    gameList.innerHTML = '<p style="color:#ff6b6b;">Oyunlar yüklenemedi!</p>';
  }
}
// ============================================================

// ===== OYUN BAŞLAT (YÜKLEME BARLI) =====
function startGame(gameId) {
  mainPanel.style.display = 'none';
  gameScreen.style.display = 'flex';
  
  const overlay = document.getElementById('loading-overlay');
  const progress = document.getElementById('loading-progress');
  overlay.style.display = 'flex';
  progress.style.width = '0%';
  
  let p = 0;
  const interval = setInterval(() => {
    p += Math.random() * 8 + 2;
    if (p >= 100) {
      p = 100;
      clearInterval(interval);
      initGame(gameId);
    }
    progress.style.width = p + '%';
  }, 80);
}

function initGame(gameId) {
  const container = document.getElementById('game-container');
  const roomId = gameId + '_' + Date.now();
  
  socket.emit('join_room', { roomId, username: currentUser });
  Chat.init(socket, roomId);
  
  gameInstance = new Game3D(container, roomId, socket, currentUser);
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
  document.getElementById('rotate-warning').style.display = 'none';
  gameScreen.style.display = 'none';
  mainPanel.style.display = 'flex';
  currentRoom = null;
}

// ===== ARKADAŞ SİSTEMİ =====
function renderFriends() {
  friendsList.innerHTML = friends.length 
    ? friends.map(f => `<li>${f} <button onclick="removeFriend('${f}')" style="background:none;border:none;color:#ff6b6b;cursor:pointer;">✕</button></li>`).join('')
    : '<li style="color:#888;">Henüz arkadaş yok</li>';
}

function removeFriend(name) {
  if (!confirm(`${name} arkadaşınızdan çıkarmak istediğinize emin misiniz?`)) return;
  friends = friends.filter(f => f !== name);
  localStorage.setItem('oslox_friends', JSON.stringify(friends));
  renderFriends();
}

function sendFriendRequest() {
  const to = friendInput.value.trim();
  if (!to) return alert('Kullanıcı adı girin');
  if (to === currentUser) return alert('Kendine istek gönderemezsin');
  if (friends.includes(to)) return alert('Zaten arkadaşınız');
  socket.emit('send_friend_request', { from: currentUser, to });
  alert('İstek gönderildi!');
  friendInput.value = '';
}

function showFriendRequest(from) {
  friendRequests.innerHTML = `
    <div style="background:#2a2a4a;padding:8px 12px;border-radius:6px;display:flex;justify-content:space-between;align-items:center;margin-top:5px;">
      <span>${from}</span>
      <div>
        <button onclick="acceptRequest('${from}')" style="background:#2ecc71;color:white;border:none;padding:4px 12px;border-radius:4px;">Kabul</button>
        <button onclick="rejectRequest('${from}')" style="background:#e74c3c;color:white;border:none;padding:4px 12px;border-radius:4px;">Reddet</button>
      </div>
    </div>
  `;
}

function acceptRequest(from) {
  socket.emit('accept_friend', { from, to: currentUser });
  friendRequests.innerHTML = '';
}

function rejectRequest(from) {
  friendRequests.innerHTML = '';
}

addFriendBtn.addEventListener('click', sendFriendRequest);
friendInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendFriendRequest(); });

// ===== KARAKTER MODAL =====
characterBtn.addEventListener('click', () => {
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

// ===== GİRİŞ =====
loginBtn.addEventListener('click', () => login(loginUsername.value));
loginUsername.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') login(loginUsername.value);
});

// ===== MOBİL UYARI (SADECE OYUN AÇIKKEN) =====
setInterval(() => {
  const gameOpen = gameScreen.style.display === 'flex';
  const warning = document.getElementById('rotate-warning');
  if (gameOpen && window.innerWidth < 768 && window.innerHeight > window.innerWidth) {
    warning.style.display = 'flex';
  } else {
    warning.style.display = 'none';
  }
}, 1000);

// ===== OTOMATİK GİRİŞ =====
if (currentUser) {
  login(currentUser);
}
