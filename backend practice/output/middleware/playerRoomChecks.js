"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePlayerAndRoom = requirePlayerAndRoom;
const gameController_1 = require("../controllers/gameController");
function requirePlayerAndRoom(socket, next) {
    const currentPlayer = gameController_1.playerUsernames.get(socket.id);
    if (!currentPlayer) {
        socket.emit("error", "Not in room");
        return;
    }
    const roomID = currentPlayer.roomID;
    const room = gameController_1.rooms.get(roomID);
    if (!room) {
        socket.emit("error", "Room does not exist");
        return;
    }
    next({ player: currentPlayer, room });
}
