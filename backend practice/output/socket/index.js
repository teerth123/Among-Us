"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pollingArray = void 0;
exports.kill = kill;
exports.movement = movement;
exports.polling = polling;
const playerRoomChecks_1 = require("../middleware/playerRoomChecks");
exports.pollingArray = new Map();
function kill(socket, io) {
    socket.on("kill", () => {
        (0, playerRoomChecks_1.requirePlayerAndRoom)(socket, ({ player: currentPlayer, room }) => {
            if (currentPlayer.role !== "imposter") {
                socket.emit("error", "Only imposters can kill");
                return;
            }
            const playersInRoom = room.players;
            const alivePlayers = playersInRoom.filter(p => !p.dead && p.username !== currentPlayer.username);
            if (alivePlayers.length === 0) {
                socket.emit("error", "No one to kill");
                return;
            }
            const KILL_RANGE = 50; // or whatever makes sense for your game
            let nearestPlayer = null;
            let minDistance = Infinity;
            for (const p of alivePlayers) {
                const dx = p.position.x - currentPlayer.position.x;
                const dy = p.position.y - currentPlayer.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < minDistance && distance <= KILL_RANGE) {
                    nearestPlayer = p;
                    minDistance = distance;
                }
            }
            if (!nearestPlayer) {
                socket.emit("error", "No player in range to kill");
                return;
            }
            nearestPlayer.dead = true;
            // Update room.players
            const playerIndex = room.players.findIndex((p) => p.username === nearestPlayer.username);
            if (playerIndex !== -1)
                room.players[playerIndex] = nearestPlayer;
            const aliveAfterKill = room.players.filter((p) => !p.dead);
            const impostersAlive = aliveAfterKill.filter((p) => p.role === 'imposter').length;
            const nonImpostersAlive = aliveAfterKill.filter((p) => p.role !== 'imposter').length;
            if (impostersAlive === 0) {
                io.to(currentPlayer.roomID).emit("endGame", "Crewmates win! All imposters eliminated.");
                return;
            }
            if (nonImpostersAlive === 0) {
                io.to(currentPlayer.roomID).emit("endGame", "Imposters win! No crewmates left.");
                return;
            }
            // Broadcast the kill
            io.to(currentPlayer.roomID).emit("player-killed", {
                killer: currentPlayer.username,
                victim: nearestPlayer.username,
            });
        });
    });
}
function movement(socket, io) {
    socket.on("movement", (data) => {
        (0, playerRoomChecks_1.requirePlayerAndRoom)(socket, ({ player: currentPlayer, room }) => {
            //suppose data is an array of positions of all players in a room
            const playersInRoom = room.players;
            if (currentPlayer.dead) {
                socket.emit("error", "dead players cannot play");
                return;
            }
            for (let p of data) {
                const presentPlayer = playersInRoom.find(x => x.username === p.username);
                if (presentPlayer && !presentPlayer.dead) {
                    presentPlayer.position.x = p.position.x;
                    presentPlayer.position.y = p.position.y;
                }
            }
            const alivePlayers = playersInRoom.filter((p) => !p.dead);
            io.to(currentPlayer.roomID).emit("movement", alivePlayers);
        });
    });
}
function polling(socket, io) {
    socket.on("polling", (data) => {
        (0, playerRoomChecks_1.requirePlayerAndRoom)(socket, ({ player: currentPlayer, room }) => {
            if (exports.pollingArray.size == 0) {
                const alivePlayers = room.players.filter((p) => !p.dead);
                for (let p of alivePlayers) {
                    exports.pollingArray.set(p.username, 0);
                }
            }
            if (currentPlayer.dead) {
                socket.emit("error", "dead players cannot vote");
                return;
            }
            if (exports.pollingArray.has(data.username)) {
                const currentValue = exports.pollingArray.get(data.username);
                exports.pollingArray.set(data.username, currentValue + 1);
            }
            io.to(currentPlayer.roomID).emit("polling-update", Object.fromEntries(exports.pollingArray));
            exports.pollingArray.clear();
        });
    });
    socket.on("donePolling", (socket, io) => {
        (0, playerRoomChecks_1.requirePlayerAndRoom)(socket, ({ player: currentPlayer, room }) => {
            const alivePlayers = room.players.filter((p) => !p.dead).length;
            let maxVotedPlayer = null, maxVotes = -1;
            for (const [username, votes] of exports.pollingArray.entries()) {
                if (maxVotes < votes) {
                    maxVotedPlayer = username;
                    maxVotes = votes;
                }
            }
            if (maxVotes >= 0.5 * alivePlayers && maxVotedPlayer && room.players.has(maxVotedPlayer)) {
                const eliminatedplayer = room.players.find((p) => p.username === maxVotedPlayer);
                if (eliminatedplayer) {
                    eliminatedplayer.dead = true;
                }
                io.to(room.id).emit("player-eliminated", eliminatedplayer.username);
            }
        });
    });
}
