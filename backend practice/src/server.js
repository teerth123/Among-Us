"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var http_1 = require("http");
var socket_io_1 = require("socket.io");
var app = (0, express_1.default)();
var server = http_1.default.createServer(app);
var io = new socket_io_1.Server(server, { cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE"]
    } });
io.on("connection", function (socket) {
    console.log("new user connected");
});
server.listen(3000, function () {
    console.log("server running on 3000");
});
