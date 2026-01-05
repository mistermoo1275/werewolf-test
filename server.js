const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname)));

let players = [];
let turnOrder = ['Werewolf', 'Seer', 'Villager', 'Gremlin'];
let currentTurnIndex = 0;
let votes = {}; 
let skipVotes = new Set();

io.on('connection', (socket) => {
    socket.on('joinGame', (username) => {
        if (players.length < 5) {
            players.push({ id: socket.id, name: username, role: null });
            io.emit('playerListUpdate', players.map(p => p.name));
        }
    });

    socket.on('startGame', () => {
        if (players.length === 5) {
            votes = {};
            skipVotes.clear();
            const roles = ['Werewolf', 'Werewolf', 'Seer', 'Villager', 'Gremlin'].sort(() => Math.random() - 0.5);
            players.forEach((p, i) => { p.role = roles[i]; });
            currentTurnIndex = 0;
            sendTurnUpdate();
        }
    });

    function sendTurnUpdate() {
        const currentRoleGoal = turnOrder[currentTurnIndex];
        io.emit('turnAnnouncement', currentRoleGoal);
        players.forEach(p => {
            if (p.role === currentRoleGoal) {
                io.to(p.id).emit('yourTurnAction', { role: p.role, players: players.map(pl => pl.name) });
            } else {
                io.to(p.id).emit('waitTurn', currentRoleGoal);
            }
        });
    }

    socket.on('nextTurn', () => {
        currentTurnIndex++;
        if (currentTurnIndex < turnOrder.length) {
            sendTurnUpdate();
        } else {
            io.emit('startDiscussion');
        }
    });

    socket.on('voteToSkip', () => {
        skipVotes.add(socket.id);
        io.emit('skipUpdate', skipVotes.size);
        if (skipVotes.size === 5) {
            io.emit('startVoting');
        }
    });

    socket.on('submitVote', (targetName) => {
        votes[targetName] = (votes[targetName] || 0) + 1;
    });

    socket.on('revealResult', () => {
        let maxVotes = 0;
        let winners = [];
        for (let name in votes) {
            if (votes[name] > maxVotes) { maxVotes = votes[name]; winners = [name]; }
            else if (votes[name] === maxVotes) { winners.push(name); }
        }

        let werewolfCaught = false;
        winners.forEach(winnerName => {
            const player = players.find(p => p.name === winnerName);
            if (player && player.role === 'Werewolf') werewolfCaught = true;
        });

        io.emit('finalReveal', {
            outcome: werewolfCaught ? "VILLAGERS WIN!" : "WEREWOLVES WIN!",
            truth: players.map(p => ({ name: p.name, role: p.role }))
        });
    });

    socket.on('seerAction', (targetIdx) => {
        socket.emit('seerResult', `${players[targetIdx].name} is a ${players[targetIdx].role}`);
    });

    socket.on('gremlinAction', (indices) => {
        const [i1, i2] = indices;
        const temp = players[i1].role;
        players[i1].role = players[i2].role;
        players[i2].role = temp;
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
