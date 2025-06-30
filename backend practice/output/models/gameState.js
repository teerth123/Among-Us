"use strict";
/*
role Assignment, started game
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.startGame = startGame;
const gameController_1 = require("../controllers/gameController");
const index_1 = require("../socket/index");
function startGame(socket, io) {
    socket.on("startGame", () => {
        const currentPlayer = gameController_1.playerUsernames.get(socket.id);
        if (!currentPlayer) {
            socket.emit("error", "Not in room");
            return;
        }
        const roomID = currentPlayer.roomID;
        const room = gameController_1.rooms.get(roomID);
        index_1.pollingArray.clear();
        if (!room) {
            socket.emit("error", "Room does not exist");
            return;
        }
        const playersInRoom = [...room.players];
        if (playersInRoom.length < 4) {
            socket.emit("error", "Invite more friends to start the game");
            return;
        }
        // ----- Role Assignment -----
        const totalImposters = Math.ceil(0.2 * playersInRoom.length);
        const shuffledIndices = playersInRoom.map((_, i) => i)
            .sort(() => Math.random() - 0.5);
        const imposterIndices = shuffledIndices.slice(0, totalImposters);
        const otherIndices = shuffledIndices.slice(totalImposters);
        // Assign imposters
        for (const idx of imposterIndices) {
            playersInRoom[idx].role = "imposter";
        }
        // Assign random roles from remaining roles (excluding "imposter")
        const nonImposterRoles = gameController_1.roles.filter(role => role !== "imposter");
        for (const idx of otherIndices) {
            const randomRole = nonImposterRoles[Math.floor(Math.random() * nonImposterRoles.length)];
            playersInRoom[idx].role = randomRole;
        }
        // Update playerUsernames map
        for (const [socketID, p] of gameController_1.playerUsernames) {
            const updated = playersInRoom.find(pl => pl.username === p.username);
            if (updated) {
                gameController_1.playerUsernames.set(socketID, updated);
                io.to(socketID).emit("role-assigned", updated.role); // Private emit
            }
        }
        room.players = playersInRoom;
        gameController_1.rooms.set(roomID, room);
        io.to(roomID).emit("msg", "Game started!");
    });
}
