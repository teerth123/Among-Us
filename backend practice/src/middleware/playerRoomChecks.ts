import { Socket } from "socket.io";
import { rooms, playerUsernames } from "../controllers/gameController";

interface GameContext {
    player: any;
    room: any;
}

export function requirePlayerAndRoom(socket: Socket, next: (ctx: GameContext) => void) {
    const currentPlayer = playerUsernames.get(socket.id);
    if (!currentPlayer) {
        socket.emit("error", "Not in room");
        return;
    }

    const roomID = currentPlayer.roomID;
    const room = rooms.get(roomID);
    if (!room) {
        socket.emit("error", "Room does not exist");
        return;
    }

    next({ player: currentPlayer, room });
}
