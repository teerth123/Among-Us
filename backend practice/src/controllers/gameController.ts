/*
rename, create room, join room
*/

import { Server, Socket } from "socket.io";
import { polling, pollingArray } from "../socket/index";

interface room{
    roomID:string,
    password:string,
    players:player[]
}


export interface player{
    username: string,
    dead:boolean,
    role:string,
    roomID:string,
    position:{
        x:number,
        y:number
    }
}

export const roles : string[] = ["imposter", "task master", "xyz" , "abc"]
export const rooms = new Map<string, room>()
export const playerUsernames = new Map<string, player>()

export function rename(socket:Socket, io:Server){
    socket.on("rename", ({username})=>{
        const player = playerUsernames.get(socket.id)
        if(player){
            player.username = username  // update username in player object
            playerUsernames.set(socket.id, player) // update map
            socket.emit("msg", `Username changed to ${username}`)
        } else {
            // Optionally handle case if player not in map yet
            socket.emit("error", "You are not in a room yet.")
        }
    })
}

export function createRoom(socket: Socket, io: Server) {
    socket.on("create-room", ({ roomID, password, username }) => {
        const room = rooms.get(roomID)

        if (!room) {
            socket.join(roomID)

            const newPlayer: player = {
                username,
                dead: false,
                role: "none",
                roomID: roomID,
                position: {
                    x: 0,
                    y: 0
                }
            }

            const newroom: room = {
                roomID,
                password,
                players: [newPlayer]
            }

            rooms.set(roomID, newroom)
            playerUsernames.set(socket.id, newPlayer)

            io.to(roomID).emit("msg", `${username} created private room`)
            io.to(roomID).emit("update-players", newroom.players)
        }
    })
}

export function joinRoom(socket: Socket, io: Server) {
    socket.on("join-room", ({ roomID, password, username }) => {

        const room = rooms.get(roomID)

        if (!room) {
            socket.emit("error", "room does not exist")
            return
        }

        if (room.password != password) {
            socket.emit("error", "wrong password")
            return
        }

        const newPlayer: player = {
            username,
            dead: false,
            role: "none",
            roomID,
            position: {
                x: 0,
                y: 0
            }
        }
        socket.join(roomID)
        room.players.push(newPlayer)
        playerUsernames.set(socket.id, newPlayer)

        io.to(roomID).emit("msg", `${username} joined room`)
        io.to(roomID).emit("update-players", room.players)
    })
}


export function disconnect(socket:Socket, io:Server){
    socket.on("disconnect", ()=>{
        const playerID = socket.id
        if(playerUsernames.has(playerID)){
            const roomID = playerUsernames.get(playerID)?.roomID
            if(roomID){
                const room = rooms.get(roomID)
                if(room){
                    room.players = room?.players.filter((p:player)=>p!==playerUsernames.get(playerID))
                    io.to(roomID).emit("msg",  `${playerUsernames.get(playerID)?.username} left the room` )
                }
            }
            const player = playerUsernames.get(playerID)
            if(player){
                pollingArray.delete(player.username)
            }
        }
        playerUsernames.delete(socket.id)
        //might have to delete from the room as well
    })
}

