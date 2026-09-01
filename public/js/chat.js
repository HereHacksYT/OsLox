// ===== SOYBET YÖNETİMİ =====
const Chat = {
  socket: null,
  roomId: null,
  messages: [],
  
  init(socket, roomId) {
    this.socket = socket;
    this.roomId = roomId;
    this.setupUI();
    this.bindEvents();
  },

  setupUI() {
    this.messagesContainer = document.getElementById('chat-messages');
    this.input = document.getElementById('chat-input');
    this.sendBtn = document.getElementById('chat-send-btn');
    this.toggleBtn = document.getElementById('chat-toggle-btn');
    this.panel = document.getElementById('chat-panel');
  },

  bindEvents() {
    // Gönder butonu
    this.sendBtn.addEventListener('click', () => this.sendMessage());
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.sendMessage();
    });

    // Sohbet panelini aç/kapa
    this.toggleBtn.addEventListener('click', () => {
      const isVisible = this.panel.style.display === 'flex';
      this.panel.style.display = isVisible ? 'none' : 'flex';
      if (!isVisible) this.input.focus();
    });

    // Socket olayları
    this.socket.on('chat_history', (history) => {
      history.forEach(msg => this.addMessage(msg));
    });

    this.socket.on('new_chat_message', (msg) => {
      this.addMessage(msg);
    });
  },

  sendMessage() {
    const text = this.input.value.trim();
    if (!text) return;
    this.socket.emit('chat_message', {
      roomId: this.roomId,
      message: text
    });
    this.input.value = '';
  },

  addMessage({ username, message, time }) {
    const div = document.createElement('div');
    div.className = 'msg';
    const timeStr = new Date(time).toLocaleTimeString();
    div.innerHTML = `<span class="username">${username}</span> [${timeStr}]: ${message}`;
    this.messagesContainer.appendChild(div);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }
};
