const express = require('express')
const http = require('http')
const { Server } = require('socket.io')

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingInterval: 10000,
  pingTimeout: 5000,
})

// rooms[code] = { host: socketId, guest: socketId }
const rooms = {}

app.get('/', (req, res) => res.send('WARAT Server OK'))

// Route de ping pour réveiller le serveur avant de jouer
app.get('/ping', (req, res) => res.json({ ok: true, rooms: Object.keys(rooms).length }))

io.on('connection', (socket) => {
  console.log('Connecté:', socket.id)

  socket.on('create', (code) => {
    // Nettoyer les vieilles salles du même host si elles existent
    for (const [c, r] of Object.entries(rooms)) {
      if (r.host === socket.id) delete rooms[c]
    }
    rooms[code] = { host: socket.id, guest: null }
    socket.join(code)
    console.log('Salle créée:', code, '| Salles actives:', Object.keys(rooms).length)
  })

  socket.on('join', (code) => {
    const room = rooms[code]
    if (!room) {
      socket.emit('join_error', 'Salle introuvable. Le code est peut-être expiré — demande à ton ami de recréer une partie.')
      return
    }
    if (room.guest) {
      socket.emit('join_error', 'Salle déjà pleine.')
      return
    }
    room.guest = socket.id
    socket.join(code)
    io.to(room.host).emit('guest_joined')
    socket.emit('joined_ok')
    console.log('Guest a rejoint:', code)
  })

  socket.on('game_msg', ({ code, msg }) => {
    socket.to(code).emit('game_msg', msg)
  })

  socket.on('disconnect', () => {
    console.log('Déconnecté:', socket.id)
    for (const [code, room] of Object.entries(rooms)) {
      if (room.host === socket.id || room.guest === socket.id) {
        // Seulement notifier si la partie avait vraiment commencé (les deux joueurs présents)
        if (room.host && room.guest) {
          socket.to(code).emit('opponent_left')
        }
        delete rooms[code]
        break
      }
    }
  })
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => console.log('WARAT Server lancé sur port', PORT))
