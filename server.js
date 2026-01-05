const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname)));

let players = [];
let finishedCount = 0;

io.on('connection', (socket) => {
    socket.on('joinGame', (username) => {
        if (players.length < 5) {
            players.push({ id: socket.id, name: username, role: null });
            io.emit('playerListUpdate', players.map(p => p.name));
        }
    });

    socket.on('startGame', () => {
        if (players.length === 5) {
            finishedCount = 0;
            const roles = ['Werewolf', 'Werewolf', 'Seer', 'Villager', 'Gremlin'].sort(() => Math.random() - 0.5);
            players.forEach((p, i) => {
                p.role = roles[i];
                // Send role AND the list of all players to each person
                io.to(p.id).emit('assignRole', { 
                    role: p.role, 
                    allPlayers: players.map(pl => pl.name) 
                });
            });
        }
    });

    // Seer Logic
    socket.on('seerAction', (targetIndex) => {
        const target = players[targetIndex];
        socket.emit('seerResult', `${target.name} is a ${target.role}`);
    });

    // Gremlin Logic
    socket.on('gremlinAction', (indices) => {
        const [idx1, idx2] = indices;
        const temp = players[idx1].role;
        players[idx1].role = players[idx2].role;
        players[idx2].role = temp;
        socket.emit('gremlinResult', "Roles swapped successfully!");
    });

    // Move to Morning
    socket.on('playerFinished', () => {
        finishedCount++;
        if (finishedCount === 5) {
            io.emit('morningPhase', players.map(p => ({ name: p.name, role: p.role })));
        }
    });

    socket.on('disconnect', () => {
        players = players.filter(p => p.id !== socket.id);
        io.emit('playerListUpdate', players.map(p => p.name));
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
