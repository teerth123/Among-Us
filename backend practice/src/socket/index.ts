import { Socket, Server } from "socket.io";
import { rooms, player, playerUsernames } from "../controllers/gameController";
import { requirePlayerAndRoom } from "../middleware/playerRoomChecks";

export const pollingArray = new Map<string, number>()

export function kill(socket: Socket, io: Server) {
    socket.on("kill", () => {
        requirePlayerAndRoom(socket, ({ player: currentPlayer, room }) => {
            if (currentPlayer.role !== "imposter") {
                socket.emit("error", "Only imposters can kill");
                return;
            }

            const playersInRoom: player[] = room.players;
            const alivePlayers = playersInRoom.filter(p => !p.dead && p.username !== currentPlayer.username);

            if (alivePlayers.length === 0) {
                socket.emit("error", "No one to kill");
                return;
            }

            const KILL_RANGE = 50; // or whatever makes sense for your game

            let nearestPlayer: player | null = null;
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
            const playerIndex = room.players.findIndex((p: player) => p.username === nearestPlayer!.username);
            if (playerIndex !== -1) room.players[playerIndex] = nearestPlayer;

            const aliveAfterKill = room.players.filter((p:player) => !p.dead);
            const impostersAlive = aliveAfterKill.filter((p:player)=> p.role === 'imposter').length;
            const nonImpostersAlive = aliveAfterKill.filter((p:player)=> p.role !== 'imposter').length;

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


export function movement(socket: Socket, io: Server) {
    socket.on("movement", (data: player[]) => {
        requirePlayerAndRoom(socket, ({ player: currentPlayer, room }) => {

            //suppose data is an array of positions of all players in a room
            const playersInRoom: player[] = room.players;

            if (currentPlayer.dead) {
                socket.emit("error", "dead players cannot play")
                return
            }

            for (let p of data) {
                const presentPlayer = playersInRoom.find(x => x.username === p.username)
                if (presentPlayer && !presentPlayer.dead) {
                    presentPlayer.position.x = p.position.x
                    presentPlayer.position.y = p.position.y
                }
            }

            const alivePlayers: player[] = playersInRoom.filter((p: player) => !p.dead)

            io.to(currentPlayer.roomID).emit("movement", alivePlayers)
        })
    })
}


export function polling(socket: Socket, io: Server) {

    socket.on("polling", (data) => {
        requirePlayerAndRoom(socket, ({ player: currentPlayer, room }) => {
            if (pollingArray.size == 0) {
                const alivePlayers = room.players.filter((p: player) => !p.dead)
                for (let p of alivePlayers) {
                    pollingArray.set(p.username, 0);
                }
            }

            if (currentPlayer.dead) {
                socket.emit("error", "dead players cannot vote")
                return
            }

            if (pollingArray.has(data.username)) {
                const currentValue = pollingArray.get(data.username)!
                pollingArray.set(data.username, currentValue + 1);
            }

            io.to(currentPlayer.roomID).emit("polling-update", Object.fromEntries(pollingArray))
            pollingArray.clear()
        })
    })

    socket.on("donePolling" , (socket:Socket, io:Server)=>{
        requirePlayerAndRoom(socket, ({player:currentPlayer, room})=>{
            const alivePlayers:number = room.players.filter((p:player)=>!p.dead).length
            let maxVotedPlayer:string|null = null, maxVotes:number = -1;
            for(const [username, votes] of pollingArray.entries()){
                if(maxVotes<votes) {
                    maxVotedPlayer = username
                    maxVotes = votes 
                }
            }
            if(maxVotes>=0.5*alivePlayers && maxVotedPlayer && room.players.has(maxVotedPlayer)){
                const eliminatedplayer = room.players.find((p:player)=>p.username===maxVotedPlayer)
                if(eliminatedplayer){
                    eliminatedplayer.dead = true
                }

                io.to(room.id).emit("player-eliminated", eliminatedplayer.username)
            }

            
        })
    })
}