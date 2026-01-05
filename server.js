const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Important: This tells the server to serve your index.html file
app.use(express.static(path.join(__dirname)));

let players = [];

io.on('connection', (socket) => {
    socket.on('joinGame', (username) => {
        if (players.length < 5) {
            players.push({ id: socket.id, name: username, role: null });
            io.emit('playerListUpdate', players.map(p => p.name));
        }
    });

    socket.on('startGame', () => {
        if (players.length >= 2) { // Set to 2 for testing, change to 5 later
            const roles = ['Werewolf', 'Seer', 'Villager', 'Gremlin', 'Werewolf'].sort(() => Math.random() - 0.5);
            players.forEach((p, i) => {
                p.role = roles[i];
                io.to(p.id).emit('assignRole', p.role, players.map(pl => pl.name));
            });
        }
    });

    socket.on('disconnect', () => {
        players = players.filter(p => p.id !== socket.id);
        io.emit('playerListUpdate', players.map(p => p.name));
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));