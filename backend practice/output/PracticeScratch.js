"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const app = (0, express_1.default)(); //created instance of express server
const server = http_1.default.createServer(app); //converted into http server as socket recognizes http server well
const io = new socket_io_1.Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE"]
    }
}); // io is the live server 
var allPlayers = [];
var activePlayers = [];
var pollingVector = [];
//socket = client    io = live server
io.on("connection", (socket) => {
    var x = 0.00, y = 0.00;
    console.log("new user connected", socket.id);
    allPlayers.push(socket.id); //new player added
    socket.on("myMovement", (data) => {
        x = data.x;
        y = data.y;
        io.emit("movement", x, y, socket.id);
    }); //player movement shared to other players
    socket.on("movement", (data) => {
        var activePlayer = data.socket.id;
        x = data.x;
        y = data.y;
        //took input for other players' movements 
    });
    socket.on("kill", (data) => {
        const deadPlayer = data.socket.id;
        const index = allPlayers.findIndex(id => id === deadPlayer);
        if (index !== -1) {
            activePlayers[index] = 0;
        }
        //removed dead player from the active players' list
    });
    socket.on("Polling", (data) => {
        const selected = data.socket.id;
        const index = pollingVector.findIndex(id => id === selected);
        if (index !== -1) {
            pollingVector[index]++;
        }
        // polling to eliminate suspected player
    });
    socket.on("donePolling", (data) => {
        pollingVector.sort((a, b) => b - a);
        const index = allPlayers.findIndex(id => id === );
        if (index !== -1) {
            activePlayers[index] = 0;
        }
        // eliminate most suspected player
    });
});
