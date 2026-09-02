const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

// ===== OYUN ODALARI =====
const rooms = {};

io.on('connection', (socket) => {
  console.log('🔗 Yeni bağlantı:', socket.id);

  socket.on('join_room', ({ roomId, username }) => {
    socket.join(roomId);
    if (!rooms[roomId]) {
      rooms[roomId] = { players: {}, messages: [] };
    }
    rooms[roomId].players[socket.id] = {
      username,
      position: { x: 0, y: 0, z: 0 }
    };
    
    const otherPlayers = Object.entries(rooms[roomId].players)
      .filter(([id]) => id !== socket.id)
      .map(([id, data]) => ({ id, ...data }));
    socket.emit('current_players', otherPlayers);
    
    socket.to(roomId).emit('player_joined', {
      id: socket.id,
      username,
      position: { x: 0, y: 0, z: 0 }
    });
    
    socket.emit('chat_history', rooms[roomId].messages);
    console.log(`👤 ${username} odaya katıldı: ${roomId}`);
  });

  socket.on('player_move', ({ roomId, position }) => {
    if (rooms[roomId] && rooms[roomId].players[socket.id]) {
      rooms[roomId].players[socket.id].position = position;
      socket.to(roomId).emit('player_moved', {
        id: socket.id,
        position
      });
    }
  });

  socket.on('chat_message', ({ roomId, message }) => {
    if (rooms[roomId]) {
      const username = rooms[roomId].players[socket.id]?.username || 'Bilinmeyen';
      const msgData = { username, message, time: new Date().toISOString() };
      rooms[roomId].messages.push(msgData);
      io.to(roomId).emit('new_chat_message', msgData);
    }
  });

  socket.on('send_friend_request', ({ from, to }) => {
    io.to(`user_${to}`).emit('friend_request', { from });
  });

  socket.on('accept_friend', ({ from, to }) => {
    io.to(`user_${from}`).emit('friend_accepted', { friend: to });
    io.to(`user_${to}`).emit('friend_accepted', { friend: from });
  });

  socket.on('register_user', (username) => {
    socket.join(`user_${username}`);
  });

  socket.on('disconnect', () => {
    for (const roomId in rooms) {
      if (rooms[roomId].players[socket.id]) {
        const username = rooms[roomId].players[socket.id].username;
        delete rooms[roomId].players[socket.id];
        socket.to(roomId).emit('player_left', { id: socket.id });
        console.log(`👋 ${username} ayrıldı (${roomId})`);
        if (Object.keys(rooms[roomId].players).length === 0) {
          delete rooms[roomId];
        }
        break;
      }
    }
  });
});

// ======================================================
// SADECE BURASI DEĞİŞTİ - OYUN LİSTESİ (İSİM + THUMBNAIL)
// ======================================================
app.get('/api/games', (req, res) => {
  res.json([
    { 
      id: 'oyun1', 
      name: 'Savaş Arenası',           // ← OYUN İSMİ
      thumbnail: '/assets/thumbnails/oyun1.jpg'  // ← THUMBNAIL
    },
    { 
      id: 'oyun2', 
      name: 'Parkur Yarışı',            // ← OYUN İSMİ
      thumbnail: '/assets/thumbnails/oyun2.jpg'  // ← THUMBNAIL
    },
    { 
      id: 'oyun3', 
      name: 'Hayatta Kalma',            // ← OYUN İSMİ
      thumbnail: '/assets/thumbnails/oyun3.jpg'  // ← THUMBNAIL
    }
  ]);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 OsLox sunucusu ${PORT} portunda çalışıyor`);
});
