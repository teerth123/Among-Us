import { Socket, Server } from "socket.io";
import { rooms, player, playerUsernames } from "../controllers/gameController";
import { requirePlayerAndRoom } from "../middleware/playerRoomChecks";

export const pollingArray = new Map<string, number>()
export const pollingTimers = new Map<string, NodeJS.Timeout>();

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
    // Helper to process polling results
    function processPollingResults(roomID: string) {
        // clear any existing timer
        const timer = pollingTimers.get(roomID);
        if (timer) { clearTimeout(timer); pollingTimers.delete(roomID); }
        const room = rooms.get(roomID);
        if (!room) return;
        const alivePlayersList = room.players.filter((p:player)=>!p.dead);
        const aliveCount = alivePlayersList.length;
        // Determine max voted player and votes
        let maxVotedPlayer:string|null = null, maxVotes:number = -1;
        for(const [username, votes] of pollingArray.entries()){
            if(votes > maxVotes) { maxVotes = votes; maxVotedPlayer = username; }
        }
        // require strictly more than 50%
        const voteThreshold = Math.floor(aliveCount / 2) + 1;
        io.to(roomID).emit("msg", `📊 Voting results: ${maxVotedPlayer || 'No one'} got ${maxVotes} votes (need ${voteThreshold} to eliminate)`);
        io.to(roomID).emit("polling-ended");
        if(maxVotes >= voteThreshold && maxVotedPlayer){
            const eliminated = room.players.find(p=>p.username===maxVotedPlayer);
            if(eliminated) {
                eliminated.dead = true;
                const idx = room.players.findIndex(p=>p.username===maxVotedPlayer);
                if(idx!==-1) room.players[idx] = eliminated;
                for(const [sid, pl] of playerUsernames) {
                    if(pl.username===maxVotedPlayer) { pl.dead=true; playerUsernames.set(sid, pl); io.to(sid).emit("you-were-eliminated"); }
                }
                rooms.set(roomID, room);
                io.to(roomID).emit("player-eliminated", eliminated.username);
                io.to(roomID).emit("msg", `🗳️ ${eliminated.username} was ELIMINATED by vote! (${maxVotes}/${aliveCount} votes)`);
                io.to(roomID).emit("update-players", room.players);
                const aliveAfter = room.players.filter(p=>!p.dead);
                const impAlive = aliveAfter.filter(p=>p.role==='imposter').length;
                const nonAlive = aliveAfter.length - impAlive;
                if(impAlive===0) { io.to(roomID).emit("endGame","Crewmates win! All imposters eliminated."); return; }
                if(nonAlive===0) { io.to(roomID).emit("endGame","Imposters win! No crewmates left."); return; }
            }
        } else {
            io.to(roomID).emit("msg", `❌ No one was eliminated - ${maxVotedPlayer||'no one'} got ${maxVotes} votes (needed ${voteThreshold})`);
        }
        pollingArray.clear();
        io.to(roomID).emit("msg","✅ Voting session ended. Game continues...");
        const allAlive = room.players.filter(p=>!p.dead);
        io.to(roomID).emit("movement", allAlive);
    }

    socket.on("polling", (data) => {
        requirePlayerAndRoom(socket, ({ player: currentPlayer, room }) => {
            if (pollingArray.size === 0) {
                // First call: initialize polling counts and notify clients, don't count as a vote
                const alivePlayers = room.players.filter((p: player) => !p.dead);
                for (const p of alivePlayers) {
                    pollingArray.set(p.username, 0);
                }
                // Broadcast initial polling state and start message
                io.to(currentPlayer.roomID).emit("polling-update", Object.fromEntries(pollingArray));
                io.to(currentPlayer.roomID).emit("msg", `📢 Polling started by ${currentPlayer.username}. Vote now!`);
                // start 30s timeout to auto-end polling
                const t = setTimeout(() => processPollingResults(currentPlayer.roomID), 30000);
                pollingTimers.set(currentPlayer.roomID, t);
                return; // skip counting this initialization call
            }

            if (currentPlayer.dead) {
                socket.emit("error", "dead players cannot vote");
                return;
            }

            // Count vote for selected player
            if (pollingArray.has(data.username)) {
                const cv = pollingArray.get(data.username)!;
                pollingArray.set(data.username, cv + 1);
            }

            // Send real-time vote updates and vote message
            io.to(currentPlayer.roomID).emit("polling-update", Object.fromEntries(pollingArray));
            io.to(currentPlayer.roomID).emit("msg", `${currentPlayer.username} voted for ${data.username}`);

            // Auto-end polling when all alive players have voted once
            const totalVotes = Array.from(pollingArray.values()).reduce((sum, v) => sum + v, 0);
            const eligibleVoters = pollingArray.size;
            if (totalVotes >= eligibleVoters) {
                processPollingResults(currentPlayer.roomID);
            }
        })
    })

    socket.on("donePolling", () => {
        const currentPlayer = playerUsernames.get(socket.id);
        if (!currentPlayer) { socket.emit("error", "Not in room"); return; }
        processPollingResults(currentPlayer.roomID);
    });
}