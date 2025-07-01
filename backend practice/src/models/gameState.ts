/*
role Assignment, started game
*/

import { Socket, Server } from "socket.io";
import { player, rooms, playerUsernames, roles } from "../controllers/gameController";
import { pollingArray, pollingTimers } from "../socket/index";

export function startGame(socket: Socket, io: Server) {
    socket.on("startGame", () => {
        const currentPlayer = playerUsernames.get(socket.id);
        if (!currentPlayer) {
            socket.emit("error", "Not in room");
            return;
        }

        const roomID = currentPlayer.roomID;
        const room = rooms.get(roomID);

        // Clear any leftover polling state from previous game
        pollingArray.clear();
        if (pollingTimers.has(roomID)) {
            clearTimeout(pollingTimers.get(roomID)!);
            pollingTimers.delete(roomID);
        }

        if (!room) {
            socket.emit("error", "Room does not exist");
            return;
        }

        // Reset all players for new game (revive dead players, reset roles)
        const playersInRoom: player[] = room.players.map(p => ({
            ...p,
            dead: false,
            role: "none",
            position: { x: Math.random() * 800 + 100, y: Math.random() * 600 + 100 } // Random spawn positions
        }));

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
        const nonImposterRoles = roles.filter(role => role !== "imposter");

        for (const idx of otherIndices) {   
            const randomRole = nonImposterRoles[Math.floor(Math.random() * nonImposterRoles.length)];
            playersInRoom[idx].role = randomRole;
        }

        // Update playerUsernames map
        for (const [socketID, p] of playerUsernames) {
            const updated = playersInRoom.find(pl => pl.username === p.username);
            if (updated) {
                playerUsernames.set(socketID, updated);
                io.to(socketID).emit("role-assigned", updated.role); // Private emit
            }
        }

        room.players = playersInRoom
        rooms.set(roomID, room)

        // Send updated player list to all clients
        io.to(roomID).emit("update-players", room.players);
        io.to(roomID).emit("msg", "Game started!");
    });
}


