"use strict";
/*
rename, create room, join room
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.playerUsernames = exports.rooms = exports.roles = void 0;
exports.rename = rename;
exports.createRoom = createRoom;
exports.joinRoom = joinRoom;
exports.disconnect = disconnect;
const index_1 = require("../socket/index");
exports.roles = ["imposter", "task master", "xyz", "abc"];
exports.rooms = new Map();
exports.playerUsernames = new Map();
function rename(socket, io) {
    socket.on("rename", ({ username }) => {
        const player = exports.playerUsernames.get(socket.id);
        if (player) {
            player.username = username; // update username in player object
            exports.playerUsernames.set(socket.id, player); // update map
            socket.emit("msg", `Username changed to ${username}`);
        }
        else {
            // Optionally handle case if player not in map yet
            socket.emit("error", "You are not in a room yet.");
        }
    });
}
function createRoom(socket, io) {
    socket.on("create-room", ({ roomID, password, username }) => {
        const room = exports.rooms.get(roomID);
        if (!room) {
            socket.join(roomID);
            const newPlayer = {
                username,
                dead: false,
                role: "none",
                roomID: roomID,
                position: {
                    x: 0,
                    y: 0
                }
            };
            const newroom = {
                roomID,
                password,
                players: [newPlayer]
            };
            exports.rooms.set(roomID, newroom);
            exports.playerUsernames.set(socket.id, newPlayer);
            io.to(roomID).emit("msg", `${username} created private room`);
            io.to(roomID).emit("update-players", newroom.players);
        }
    });
}
function joinRoom(socket, io) {
    socket.on("join-room", ({ roomID, password, username }) => {
        const room = exports.rooms.get(roomID);
        if (!room) {
            socket.emit("error", "room does not exist");
            return;
        }
        if (room.password !== password) {
            socket.emit("error", "wrong password");
            return;
        }
        const newPlayer = {
            username,
            dead: false,
            role: "none",
            roomID,
            position: {
                x: 0,
                y: 0
            }
        };
        socket.join(roomID);
        room.players.push(newPlayer);
        exports.playerUsernames.set(socket.id, newPlayer);
        io.to(roomID).emit("msg", `${username} joined room`);
        io.to(roomID).emit("update-players", room.players);
    });
}
function disconnect(socket, io) {
    socket.on("disconnect", () => {
        var _a, _b;
        const playerID = socket.id;
        if (exports.playerUsernames.has(playerID)) {
            const roomID = (_a = exports.playerUsernames.get(playerID)) === null || _a === void 0 ? void 0 : _a.roomID;
            if (roomID) {
                const room = exports.rooms.get(roomID);
                if (room) {
                    room.players = room === null || room === void 0 ? void 0 : room.players.filter((p) => p !== exports.playerUsernames.get(playerID));
                    io.to(roomID).emit("msg", `${(_b = exports.playerUsernames.get(playerID)) === null || _b === void 0 ? void 0 : _b.username} left the room`);
                }
            }
            const player = exports.playerUsernames.get(playerID);
            if (player) {
                index_1.pollingArray.delete(player.username);
            }
        }
        exports.playerUsernames.delete(socket.id);
        //might have to delete from the room as well
    });
}
