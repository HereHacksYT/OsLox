const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*" }
});

// ===== RAM'DE TUTULAN VERİLER =====
const pendingRequests = {}; // { 'mehmet': ['ahmet', 'ali'], ... }

// ===== SOCKET OLAYLARI =====
io.on('connection', (socket) => {
  console.log('🔗 Yeni bağlantı:', socket.id);

  // Kullanıcı giriş yapınca odasına ekle
  socket.on('register', (username) => {
    socket.username = username;
    socket.join(`user_${username}`);
    console.log(`👤 ${username} giriş yaptı`);
    
    // Bekleyen istekleri gönder
    if (pendingRequests[username]) {
      socket.emit('pending_requests', pendingRequests[username]);
    }
  });

  // Arkadaş isteği gönder
  socket.on('send_request', ({ from, to }) => {
    if (from === to) {
      socket.emit('error', 'Kendine istek gönderemezsin');
      return;
    }
    
    // Daha önce istek gönderilmiş mi kontrol et
    if (pendingRequests[to] && pendingRequests[to].includes(from)) {
      socket.emit('error', 'Zaten istek gönderilmiş');
      return;
    }
    
    // İsteği ekle
    if (!pendingRequests[to]) pendingRequests[to] = [];
    pendingRequests[to].push(from);
    
    console.log(`📨 ${from} → ${to} istek gönderdi`);
    
    // Karşı tarafa bildirim gönder (online ise)
    io.to(`user_${to}`).emit('new_request', { from });
    socket.emit('request_sent', { to });
  });

  // İsteği kabul et
  socket.on('accept_request', ({ from, to }) => {
    // İsteği RAM'den sil
    if (pendingRequests[to]) {
      pendingRequests[to] = pendingRequests[to].filter(f => f !== from);
      if (pendingRequests[to].length === 0) delete pendingRequests[to];
    }
    
    console.log(`✅ ${to} → ${from} isteği kabul etti`);
    
    // HER İKİ TARAFA DA "arkadaş oldunuz" mesajı gönder
    io.to(`user_${from}`).emit('friend_accepted', { friend: to });
    io.to(`user_${to}`).emit('friend_accepted', { friend: from });
  });

  // İsteği reddet
  socket.on('reject_request', ({ from, to }) => {
    if (pendingRequests[to]) {
      pendingRequests[to] = pendingRequests[to].filter(f => f !== from);
      if (pendingRequests[to].length === 0) delete pendingRequests[to];
    }
    console.log(`❌ ${to} → ${from} isteği reddetti`);
    io.to(`user_${from}`).emit('request_rejected', { by: to });
  });

  // Bağlantı kesildiğinde
  socket.on('disconnect', () => {
    console.log('🔌 Bağlantı kesildi:', socket.id);
  });
});

// ===== HTTP API (isteğe bağlı, tüm kullanıcıları listele) =====
app.get('/api/users', (req, res) => {
  // Aktif kullanıcıları socket'lerden al
  const users = [];
  for (const [_, socket] of io.sockets.sockets) {
    if (socket.username && !users.includes(socket.username)) {
      users.push(socket.username);
    }
  }
  res.json(users);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Sunucu ${PORT} portunda çalışıyor`);
  console.log(`📡 Socket.io hazır`);
});
