"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_1 = require("../server");
const allPlayers = [];
server_1.io.on("connection", (socket) => {
    allPlayers.push(socket.id);
});
