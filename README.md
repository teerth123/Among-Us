# Among Us - Multiplayer Web Game 🚀

A real-time multiplayer web-based game inspired by Among Us, built with modern technologies including React, TypeScript, Node.js, and Phaser.js.

## 🎮 Demo

Check out the game in action: **[Demo Video](https://x.com/DexTee_17/status/1939689150657249393)**

## 🚀 Features

- **Real-time Multiplayer** - Powered by Socket.IO for seamless player interactions
- **Role-based Gameplay** - Imposters vs Crewmates with distinct abilities
- **Live Movement** - Smooth player movement with WASD controls
- **Voting System** - Democratic elimination through polling
- **Room-based Games** - Create or join private game rooms
- **Kill Mechanics** - Imposters can eliminate other players
- **Game State Management** - Lobby, waiting, playing, and results phases

## 🛠️ Tech Stack

### Frontend
- **React 19** - Modern UI library with latest features
- **TypeScript** - Type-safe development
- **Vite** - Lightning-fast build tool and dev server
- **Phaser 3.88.2** - Powerful 2D game framework
- **Socket.IO Client** - Real-time communication

### Backend
- **Node.js** - JavaScript runtime
- **Express 5.1.0** - Web application framework
- **Socket.IO** - WebSocket communication
- **TypeScript** - Server-side type safety
- **CORS** - Cross-origin resource sharing

## 📁 Project Structure

```
Among-Us/
├── frontend/              # React + Vite client
│   ├── src/
│   │   ├── Google.tsx     # Main game component with Phaser
│   │   ├── Game.tsx       # Alternative game implementation
│   │   └── ...
│   └── package.json
├── backend practice/      # Node.js server
│   ├── src/
│   │   ├── models/
│   │   └── ...
│   └── package.json
└── README.md
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/teerth123/Among-Us.git
   cd Among-Us
   ```

2. **Install Frontend Dependencies**
   ```bash
   cd frontend
   npm install
   ```

3. **Install Backend Dependencies**
   ```bash
   cd "../backend practice"
   npm install
   ```

### Running the Game

1. **Start the Backend Server**
   ```bash
   cd "backend practice"
   npm start
   # Server will run on http://localhost:3000
   ```

2. **Start the Frontend Development Server**
   ```bash
   cd frontend
   npm run dev
   # Frontend will run on http://localhost:5173
   ```

3. **Open your browser** and navigate to `http://localhost:5173`

## 🎯 How to Play

1. **Enter Username** - Set your player name
2. **Create/Join Room** - Start a new game or join existing room with password
3. **Wait for Players** - Minimum 4 players required to start
4. **Game Starts** - Players are assigned roles (Crewmates vs Imposters)
5. **Gameplay**:
   - **Crewmates**: Survive and identify imposters
   - **Imposters**: Eliminate crewmates without being caught
6. **Voting** - Discuss and vote to eliminate suspicious players
7. **Win Conditions**: Crewmates win by eliminating all imposters, Imposters win by eliminating enough crewmates

## 🎮 Controls

- **WASD** - Move your character
- **Q** - Kill (Imposters only)
- **P** - Start polling/voting

## 🔧 Development Scripts

### Frontend
```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run lint     # Run ESLint
npm run preview  # Preview production build
```

### Backend
```bash
npm start        # Start server
npm run build    # Compile TypeScript
```

## 🎨 Game Features

- **Room System**: Create password-protected game rooms
- **Role Assignment**: Automatic imposter/crewmate assignment (20% imposters)
- **Real-time Movement**: Smooth player synchronization
- **Voting Mechanism**: Democratic player elimination
- **Game Phases**: Lobby → Waiting → Playing → Results
- **Visual Indicators**: Role-based player colors for imposters

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is open source. Feel free to use, modify, and distribute.

## 👨‍💻 Author

**Teerth** - [@DexTee_17](https://x.com/DexTee_17)

## 🎯 Future Roadmap

- [ ] Add task completion system
- [ ] Implement sabotage mechanics
- [ ] Add proper maps and environments
- [ ] Emergency meeting functionality
- [ ] EnUX
- [ ] Mobilhanced UI/e touch controls
- [ ] Spectator mode for eliminated players

---

**Enjoy playing and contributing to the project! 🎮✨**
