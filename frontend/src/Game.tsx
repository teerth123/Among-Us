import { useState, useEffect, useRef } from 'react';
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

export default function Game() {
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
  const gameLoopRef = useRef<number>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  
  // Player state
  const [myPlayer, setMyPlayer] = useState<Player | null>(null);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);

  // phase ref to capture latest phase
  const phaseRef = useRef(gameState.phase);

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

    // Listen for full player list updates
    newSocket.on('update-players', (players: Player[]) => {
      setAllPlayers(players);
    });

    newSocket.on('player-killed', (data: { killer: string; victim: string }) => {
      setMessages(prev => [...prev, `${data.victim} was killed by ${data.killer}!`]);
    });

    newSocket.on('polling-update', (pollData: Record<string, number>) => {
      setPollingData(pollData);
    });

    newSocket.on('player-eliminated', (username: string) => {
      setAllPlayers(prev => prev.map(p => p.username === username ? { ...p, dead: true } : p));
      setMessages(prev => [...prev, `${username} was eliminated by vote!`]);
    });

    newSocket.on('endGame', (msg: string) => {
      setGameState(prev => ({ ...prev, phase: 'results' }));
      setMessages(prev => [...prev, msg]);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  // keep ref in sync
  useEffect(() => {
    phaseRef.current = gameState.phase;
  }, [gameState.phase]);

  // single keydown listener on mount
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      console.log('Key pressed:', e.code, 'Current phase:', phaseRef.current);
      if (e.code === 'KeyP' && phaseRef.current === 'playing') {
        console.log('Opening voting panel');
        setGameState(prev => ({ ...prev, phase: 'voting' }));
        setPollingData({});
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Auto-close voting after 30 seconds
  useEffect(() => {
    if (gameState.phase === 'voting') {
      const timer = setTimeout(() => {
        handleDoneVoting();
      }, 30000);
      return () => clearTimeout(timer);
    }
  }, [gameState.phase]);

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

  // Call meeting (start voting phase)
  const handleCallMeeting = () => {
    if (!socket) return;
    setGameState(prev => ({ ...prev, phase: 'voting' }));
    setPollingData({});
  };

  // Done voting
  const handleDoneVoting = () => {
    if (!socket) return;
    socket.emit('donePolling');
    setGameState(prev => ({ ...prev, phase: 'playing' }));
    setPollingData({});
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

    // Only movement keys - NO global keydown listener here
    const handleMovementKeyDown = (e: KeyboardEvent) => {
      // Only handle movement keys, not P
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        keysRef.current[e.code] = true;
      }
    };

    const handleMovementKeyUp = (e: KeyboardEvent) => {
      // Only handle movement keys, not P
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        keysRef.current[e.code] = false;
      }
    };

    window.addEventListener('keydown', handleMovementKeyDown);
    window.addEventListener('keyup', handleMovementKeyUp);

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
      window.removeEventListener('keydown', handleMovementKeyDown);
      window.removeEventListener('keyup', handleMovementKeyUp);
    };
  }, [gameState.phase, myPlayer, allPlayers, socket, username, gameState.myRole]);

  return (
    <>
      {/* ALWAYS VISIBLE DEBUG BUTTON - SHOWS IN ALL PHASES */}

      <h1>Hi</h1>
      <div style={{position: 'fixed', top: '10px', left: '10px', zIndex: 9999, display: 'flex', gap: '10px'}}>
        <button onClick={handleCallMeeting} style={{background: 'red', padding: '15px 30px', border: 'none', borderRadius: '5px', color: 'white', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold'}}>
          🗳️ VOTE BUTTON (Phase: {gameState.phase})
        </button>
        <div style={{background: 'rgba(0,0,0,0.8)', color: 'white', padding: '10px', borderRadius: '5px'}}>
          Role: {gameState.myRole} | Players: {allPlayers.length} | Connected: {connected ? 'YES' : 'NO'}
        </div>
      </div>

      {/* Original phase-specific content */}
      {gameState.phase === 'lobby' && (
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
      )}

      {gameState.phase === 'waiting' && (
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
      )}

      {(gameState.phase === 'playing' || gameState.phase === 'voting') && (
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

            <div className="messages">
              <h4>Game Messages:</h4>
              <div className="message-list">
                {messages.slice(-5).map((msg, index) => (
                  <div key={index}>{msg}</div>
                ))}
              </div>
            </div>
          </div>

          {/* Voting overlay */}
          {gameState.phase === 'voting' && (
            <div className="overlay">
              <div className="voting-panel">
                <h3>Vote for player to eliminate:</h3>
                {allPlayers.filter(p => !p.dead && p.username !== username).map(p => (
                  <button key={p.username} onClick={() => handleVote(p.username)} disabled={!!pollingData[p.username]}>
                    {p.username} ({pollingData[p.username] || 0})
                  </button>
                ))}
                <button onClick={handleDoneVoting} className="done-vote-btn">Done Voting</button>
              </div>
            </div>
          )}

          <style>{`
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

            .form-group button, .start-game-btn, .kill-btn, .vote-btn {
              padding: 10px 20px;
              border: none;
              border-radius: 5px;
              background: #4CAF50;
              color: white;
              cursor: pointer;
              transition: background 0.3s;
            }

            .form-group button:hover, .start-game-btn:hover, .vote-btn:hover {
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

            .modal {
              background: rgba(0, 0, 0, 0.8);
              color: white;
              padding: 30px;
              border-radius: 10px;
              max-width: 500px;
              width: 100%;
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              z-index: 1000;
            }

            .modal h2 {
              margin-top: 0;
            }

            .done-vote-btn {
              background: #007bff;
            }

            .done-vote-btn:hover {
              background: #0056b3;
            }

            .overlay {
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background: rgba(0,0,0,0.8);
              display: flex;
              justify-content: center;
              align-items: center;
              z-index: 1000;
            }

            .voting-dialog {
              background: #2a2a2a;
              padding: 20px;
              border-radius: 10px;
              border: none;
              max-width: 400px;
              width: 100%;
              color: white;
              position: relative;
            }

            .voting-dialog h3 {
              margin-top: 0;
              margin-bottom: 15px;
              text-align: center;
            }

            .voting-dialog button {
              padding: 10px;
              border: none;
              border-radius: 5px;
              background: #4CAF50;
              color: white;
              cursor: pointer;
              width: 100%;
              margin: 5px 0;
              transition: background 0.3s;
            }

            .voting-dialog button:hover {
              background: #45a049;
            }

            .voting-dialog .close {
              position: absolute;
              top: 10px;
              right: 10px;
              background: transparent;
              border: none;
              color: white;
              font-size: 16px;
              cursor: pointer;
            }
          `}</style>
        </div>
      )}

      {gameState.phase === 'results' && (
        <div className="game-container">
          <div className="modal">
            <h2>Game Over</h2>
            {messages.slice(-1).map((msg, i) => <p key={i}>{msg}</p>)}
            <button onClick={() => window.location.reload()}>Play Again</button>
          </div>
        </div>
      )}
    </>
  );
}