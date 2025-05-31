import express from "express"
import http from "http"
import { Server } from "socket.io"

import { rename, createRoom, disconnect, joinRoom } from "./controllers/gameController"
import { startGame } from "./models/gameState"
import { movement , kill, polling} from "./socket/index"

const app = express()
const server = http.createServer(app)
const io = new Server(server,
    {cors:{
        origin:"*",
        methods:["GET", "POST", "PUT", "DELETE"]
    }}
)

io.on("connection", (socket)=>{
    console.log("new user connected")

    socket.on("msg", (data)=>{
        io.emit("msg", data)
    })

    rename(socket, io)
    joinRoom(socket, io)
    createRoom(socket, io)
    startGame(socket, io)
    movement(socket, io)
    kill(socket, io)
    polling(socket, io)
    disconnect(socket, io)

})

server.listen(3000, ()=>{
    console.log("server running on 3000")
})



// npx ts-node src/server.ts