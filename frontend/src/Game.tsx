import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

// Types matching your backend
interface Player {
  username: string;
  dead: boolean;
  role: string;
  roomID: string;
  position: { x: number; y: number };
}

interface GameState {
  phase: 'lobby' | 'waiting' | 'playing' | 'voting' | 'results';
  players: Player[];
  myRole: string | null;
  roomID: string | null;
  isHost: boolean;
}

const SOCKET_URL = 'http://localhost:3000';

export default function Google() {
  // Socket connection
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  
  // Game state
  const [gameState, setGameState] = useState<GameState>({
    phase: 'lobby',
    players: [],
    myRole: null,
    roomID: null,
    isHost: false
  });
  
  // UI state
  const [username, setUsername] = useState('');
  const [roomInput, setRoomInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [messages, setMessages] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [pollingData, setPollingData] = useState<Record<string, number>>({});
  
  // Game canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameLoopRef = useRef<number>();
  const keysRef = useRef<Record<string, boolean>>({});
  
  // Player state
  const [myPlayer, setMyPlayer] = useState<Player | null>(null);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setConnected(true);
      console.log('Connected to server');
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
      console.log('Disconnected from server');
    });

    // Game event listeners
    newSocket.on('msg', (message: string) => {
      setMessages(prev => [...prev, message]);
    });

    newSocket.on('error', (errorMsg: string) => {
      setError(errorMsg);
      setTimeout(() => setError(''), 3000);
    });

    newSocket.on('role-assigned', (role: string) => {
      setGameState(prev => ({ ...prev, myRole: role, phase: 'playing' }));
    });

    newSocket.on('movement', (players: Player[]) => {
      setAllPlayers(players);
    });

    newSocket.on('player-killed', (data: { killer: string; victim: string }) => {
      setMessages(prev => [...prev, `${data.victim} was killed by ${data.killer}!`]);
    });

    newSocket.on('polling-update', (pollData: Record<string, number>) => {
      setPollingData(pollData);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  // Handle username change
  const handleSetUsername = () => {
    if (!socket || !username.trim()) return;
    socket.emit('rename', { username: username.trim() });
    setMessages(prev => [...prev, `Username set to: ${username}`]);
  };

  // Create room
  const handleCreateRoom = () => {
    if (!socket || !roomInput.trim() || !passwordInput.trim() || !username.trim()) return;
    
    socket.emit('create-room', {
      roomID: roomInput.trim(),
      password: passwordInput.trim(),
      username: username.trim()
    });
    
    setGameState(prev => ({
      ...prev,
      roomID: roomInput.trim(),
      phase: 'waiting',
      isHost: true
    }));
    
    setShowCreateRoom(false);
  };

  // Join room
  const handleJoinRoom = () => {
    if (!socket || !roomInput.trim() || !passwordInput.trim() || !username.trim()) return;
    
    socket.emit('join-room', {
      roomID: roomInput.trim(),
      password: passwordInput.trim(),
      username: username.trim()
    });
    
    setGameState(prev => ({
      ...prev,
      roomID: roomInput.trim(),
      phase: 'waiting',
      isHost: false
    }));
  };

  // Start game (host only)
  const handleStartGame = () => {
    if (!socket || !gameState.isHost) return;
    socket.emit('startGame');
  };

  // Kill action (imposter only)
  const handleKill = () => {
    if (!socket || gameState.myRole !== 'imposter') return;
    socket.emit('kill');
  };

  // Vote for player
  const handleVote = (targetUsername: string) => {
    if (!socket) return;
    socket.emit('polling', { username: targetUsername });
  };

  // Game canvas and movement
  useEffect(() => {
    if (gameState.phase !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Initialize player position
    if (!myPlayer) {
      const newPlayer: Player = {
        username,
        dead: false,
        role: gameState.myRole || 'none',
        roomID: gameState.roomID || '',
        position: { x: 400, y: 300 }
      };
      setMyPlayer(newPlayer);
    }

    // Keyboard event handlers
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Game loop
    const gameLoop = () => {
      if (!myPlayer) return;

      let moved = false;
      const speed = 3;
      const newPosition = { ...myPlayer.position };

      // Movement
      if (keysRef.current['KeyW'] || keysRef.current['ArrowUp']) {
        newPosition.y -= speed;
        moved = true;
      }
      if (keysRef.current['KeyS'] || keysRef.current['ArrowDown']) {
        newPosition.y += speed;
        moved = true;
      }
      if (keysRef.current['KeyA'] || keysRef.current['ArrowLeft']) {
        newPosition.x -= speed;
        moved = true;
      }
      if (keysRef.current['KeyD'] || keysRef.current['ArrowRight']) {
        newPosition.x += speed;
        moved = true;
      }

      // Boundary checks
      newPosition.x = Math.max(20, Math.min(780, newPosition.x));
      newPosition.y = Math.max(20, Math.min(580, newPosition.y));

      if (moved) {
        const updatedPlayer = { ...myPlayer, position: newPosition };
        setMyPlayer(updatedPlayer);

        // Send movement to server
        if (socket) {
          socket.emit('movement', [updatedPlayer]);
        }
      }

      // Render game
      ctx.clearRect(0, 0, 800, 600);
      
      // Draw background
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(0, 0, 800, 600);

      // Draw all players
      allPlayers.forEach(player => {
        if (player.dead) return;

        // Player color based on role (only show for imposters)
        if (gameState.myRole === 'imposter' && player.role === 'imposter') {
          ctx.fillStyle = '#ff4444'; // Red for imposters
        } else if (player.username === username) {
          ctx.fillStyle = '#44ff44'; // Green for self
        } else {
          ctx.fillStyle = '#4444ff'; // Blue for others
        }

        ctx.beginPath();
        ctx.arc(player.position.x, player.position.y, 15, 0, 2 * Math.PI);
        ctx.fill();

        // Player name
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(player.username, player.position.x, player.position.y - 25);

        // Dead indicator
        if (player.dead) {
          ctx.fillStyle = '#ff0000';
          ctx.font = '20px Arial';
          ctx.fillText('💀', player.position.x, player.position.y + 5);
        }
      });

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState.phase, myPlayer, allPlayers, socket, username, gameState.myRole]);

  // Render lobby phase
  if (gameState.phase === 'lobby') {
    return (
      <div className="game-container">
        <div className="lobby">
          <h1>Multiplayer Game</h1>
          <div className="connection-status">
            Status: {connected ? '🟢 Connected' : '🔴 Disconnected'}
          </div>
          
          {error && <div className="error">{error}</div>}
          
          <div className="form-group">
            <input
              type="text"
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <button onClick={handleSetUsername}>Set Username</button>
          </div>

          <div className="room-actions">
            <button onClick={() => setShowCreateRoom(!showCreateRoom)}>
              {showCreateRoom ? 'Cancel' : 'Create Room'}
            </button>
            
            {!showCreateRoom && (
              <div className="form-group">
                <input
                  type="text"
                  placeholder="Room ID"
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                />
                <button onClick={handleJoinRoom}>Join Room</button>
              </div>
            )}

            {showCreateRoom && (
              <div className="form-group">
                <input
                  type="text"
                  placeholder="Room ID"
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                />
                <button onClick={handleCreateRoom}>Create Room</button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Render waiting room
  if (gameState.phase === 'waiting') {
    return (
      <div className="game-container">
        <div className="waiting-room">
          <h2>Room: {gameState.roomID}</h2>
          <div className="players-list">
            <h3>Players in room:</h3>
            {messages.map((msg, index) => (
              <div key={index}>{msg}</div>
            ))}
          </div>
          
          {gameState.isHost && (
            <button onClick={handleStartGame} className="start-game-btn">
              Start Game (Need 4+ players)
            </button>
          )}
          
          {error && <div className="error">{error}</div>}
        </div>
      </div>
    );
  }

  // Render game phase
  if (gameState.phase === 'playing') {
    return (
      <div className="game-container">
        <div className="game-ui">
          <div className="game-info">
            <div>Role: <span className={`role-${gameState.myRole}`}>{gameState.myRole}</span></div>
            <div>Room: {gameState.roomID}</div>
            <div>Players: {allPlayers.filter(p => !p.dead).length} alive</div>
          </div>

          <div className="game-actions">
            {gameState.myRole === 'imposter' && (
              <button onClick={handleKill} className="kill-btn">Kill</button>
            )}
          </div>

          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className="game-canvas"
          />

          <div className="controls">
            <p>Use WASD or Arrow Keys to move</p>
            {gameState.myRole === 'imposter' && (
              <p>You are an IMPOSTER! Kill other players and blend in.</p>
            )}
          </div>

          {Object.keys(pollingData).length > 0 && (
            <div className="voting-panel">
              <h3>Voting Results:</h3>
              {Object.entries(pollingData).map(([player, votes]) => (
                <div key={player} className="vote-item">
                  {player}: {votes} votes
                  <button onClick={() => handleVote(player)}>Vote</button>
                </div>
              ))}
            </div>
          )}

          <div className="messages">
            <h4>Game Messages:</h4>
            <div className="message-list">
              {messages.slice(-5).map((msg, index) => (
                <div key={index}>{msg}</div>
              ))}
            </div>
          </div>
        </div>

        <style jsx>{`
          .game-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 20px;
            font-family: Arial, sans-serif;
            background: #1a1a1a;
            color: white;
            min-height: 100vh;
          }

          .lobby, .waiting-room {
            background: #2a2a2a;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
            max-width: 500px;
            width: 100%;
          }

          .form-group {
            display: flex;
            gap: 10px;
            margin: 15px 0;
            flex-wrap: wrap;
          }

          .form-group input {
            flex: 1;
            padding: 10px;
            border: none;
            border-radius: 5px;
            background: #3a3a3a;
            color: white;
          }

          .form-group button, .start-game-btn, .kill-btn {
            padding: 10px 20px;
            border: none;
            border-radius: 5px;
            background: #4CAF50;
            color: white;
            cursor: pointer;
            transition: background 0.3s;
          }

          .form-group button:hover, .start-game-btn:hover {
            background: #45a049;
          }

          .kill-btn {
            background: #f44336;
          }

          .kill-btn:hover {
            background: #da190b;
          }

          .connection-status {
            margin: 10px 0;
            font-size: 14px;
          }

          .error {
            background: #f44336;
            color: white;
            padding: 10px;
            border-radius: 5px;
            margin: 10px 0;
          }

          .game-ui {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 20px;
          }

          .game-info {
            display: flex;
            gap: 20px;
            background: #2a2a2a;
            padding: 10px 20px;
            border-radius: 5px;
          }

          .role-imposter {
            color: #ff4444;
            font-weight: bold;
          }

          .game-canvas {
            border: 2px solid #444;
            border-radius: 5px;
          }

          .controls {
            text-align: center;
            background: #2a2a2a;
            padding: 10px;
            border-radius: 5px;
          }

          .voting-panel {
            background: #2a2a2a;
            padding: 15px;
            border-radius: 5px;
            min-width: 300px;
          }

          .vote-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 5px 0;
            padding: 5px;
            background: #3a3a3a;
            border-radius: 3px;
          }

          .vote-item button {
            padding: 5px 10px;
            border: none;
            border-radius: 3px;
            background: #666;
            color: white;
            cursor: pointer;
          }

          .vote-item button:hover {
            background: #777;
          }

          .messages {
            background: #2a2a2a;
            padding: 15px;
            border-radius: 5px;
            width: 100%;
            max-width: 800px;
          }

          .message-list {
            max-height: 100px;
            overflow-y: auto;
            font-size: 14px;
          }

          .message-list div {
            margin: 2px 0;
            padding: 2px 0;
            border-bottom: 1px solid #444;
          }

          h1, h2, h3, h4 {
            text-align: center;
            margin-bottom: 20px;
          }
        `}</style>
      </div>
    );
  }

  return null;
}