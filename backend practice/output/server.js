"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const gameController_1 = require("./controllers/gameController");
const gameState_1 = require("./models/gameState");
const index_1 = require("./socket/index");
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, { cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE"]
    } });
io.on("connection", (socket) => {
    console.log("new user connected");
    socket.on("msg", (data) => {
        io.emit("msg", data);
    });
    (0, gameController_1.rename)(socket, io);
    (0, gameController_1.joinRoom)(socket, io);
    (0, gameController_1.createRoom)(socket, io);
    (0, gameState_1.startGame)(socket, io);
    (0, index_1.movement)(socket, io);
    (0, index_1.kill)(socket, io);
    (0, index_1.polling)(socket, io);
    (0, gameController_1.disconnect)(socket, io);
});
server.listen(3000, () => {
    console.log("server running on 3000");
});
// npx ts-node src/server.ts
