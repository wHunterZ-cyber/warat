const express = require('express')
const http = require('http')
const { Server } = require('socket.io')

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
})

// rooms[code] = { host: socketId, guest: socketId }
const rooms = {}

app.get('/', (req, res) => res.send('WARAT Server OK'))

io.on('connection', (socket) => {
  console.log('Connecté:', socket.id)

  // Hôte crée une salle
  socket.on('create', (code) => {
    rooms[code] = { host: socket.id, guest: null }
    socket.join(code)
    console.log('Salle créée:', code)
  })

  // Guest rejoint une salle
  socket.on('join', (code) => {
    const room = rooms[code]
    if (!room) {
      socket.emit('error', 'Salle introuvable. Vérifie le code.')
      return
    }
    if (room.guest) {
      socket.emit('error', 'Salle déjà pleine.')
      return
    }
    room.guest = socket.id
    socket.join(code)
    // Notifier le host que le guest est là
    io.to(room.host).emit('guest_joined')
    // Notifier le guest qu'il est bien connecté
    socket.emit('joined_ok')
    console.log('Guest a rejoint:', code)
  })

  // Relayer tous les messages de jeu entre les deux joueurs
  socket.on('game_msg', ({ code, msg }) => {
    // Envoyer à l'autre joueur dans la salle (pas à soi-même)
    socket.to(code).emit('game_msg', msg)
  })

  // Déconnexion
  socket.on('disconnect', () => {
    console.log('Déconnecté:', socket.id)
    // Notifier l'adversaire si en cours de partie
    for (const [code, room] of Object.entries(rooms)) {
      if (room.host === socket.id || room.guest === socket.id) {
        socket.to(code).emit('opponent_left')
        delete rooms[code]
        break
      }
    }
  })
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => console.log('WARAT Server lancé sur port', PORT))
