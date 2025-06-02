import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import Phaser from "phaser";
import map from "./assets/practice.json"
import character from "./assets/player.png"
import tilesetimg from "./assets/Tileset.png"

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

// Game instance and global variables for Phaser
let gameInstance: Phaser.Game | null = null;
let currentSocket: Socket | null = null;
let currentGameState: GameState | null = null;
let currentUsername: string = '';
let allPlayersData: Player[] = [];

export default function MergedGame() {
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
  const [isPollingActive, setIsPollingActive] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  
  // Player state
  const [myPlayer, setMyPlayer] = useState<Player | null>(null);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);
    currentSocket = newSocket;

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
      setGameState(prev => {
        const newState = { ...prev, myRole: role, phase: 'playing' as const };
        currentGameState = newState;
        return newState;
      });
    });

    newSocket.on('movement', (players: Player[]) => {
      console.log('Received movement data:', players); // Debug log
      setAllPlayers(players);
      allPlayersData = players;
    });

    newSocket.on('player-killed', (data: { killer: string; victim: string }) => {
      setMessages(prev => [...prev, `${data.victim} was killed `]);
    });

    newSocket.on("player-eliminated", (eliminatedPlayer: string) => {
      setMessages(prev => [...prev, `${eliminatedPlayer} got eliminated`]);
      setIsPollingActive(false);
      setHasVoted(false);
      setPollingData({});
    });

    newSocket.on('polling-update', (pollData: Record<string, number>) => {
      setPollingData(pollData);
      setIsPollingActive(true);
    });

    newSocket.on("endGame", (gameConclusion: string) => {
      setMessages(prev => [...prev, gameConclusion]);
      setIsPollingActive(false);
      setHasVoted(false);
      setPollingData({});
    });

    return () => {
      newSocket.close();
    };
  }, []);

  // Clean up game instance when component unmounts
  useEffect(() => {
    return () => {
      if (gameInstance) {
        gameInstance.destroy(true);
        gameInstance = null;
      }
    };
  }, []);

  // Update global references when state changes
  useEffect(() => {
    currentGameState = gameState;
    currentUsername = username;
    allPlayersData = allPlayers;
  }, [gameState, username, allPlayers]);

  // Initialize Phaser game when entering playing phase
  useEffect(() => {
    if (gameState.phase === 'playing' && !gameInstance) {
      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        width: window.innerWidth,
        height: window.innerHeight,
        parent: "game-container",
        scene: {
          preload: Preload,
          create: Create,
          update: Update
        },
        physics: {
          default: "arcade",
          arcade: {
            gravity: { x: 0, y: 0 },
            debug: false
          }
        }
      };

      gameInstance = new Phaser.Game(config);
    }

    return () => {
      if (gameState.phase !== 'playing' && gameInstance) {
        gameInstance.destroy(true);
        gameInstance = null;
      }
    };
  }, [gameState.phase]);

  // Phaser scene functions - make these global to persist across re-renders
  var player: any;
  var moves: any;
  var qKey: any;
  var pKey: any;
  var otherPlayers: { [key: string]: any } = {};
  var mapWidth: number, mapHeight: number;
  var currentScene: Phaser.Scene;

  function Preload(this: Phaser.Scene) {
    this.load.tilemapTiledJSON('map', map);
    this.load.image('player', character);
    this.load.image('tileset', tilesetimg);
  }

  function Create(this: Phaser.Scene) {
    currentScene = this; // Store scene reference
    const newmap = this.make.tilemap({ key: 'map' });
    const tileset = newmap.addTilesetImage('completing ', 'tileset');
    if (!tileset) {
      console.error("tileset is not loaded");
      return;
    }

    const groundLayer = newmap.createLayer("ground", tileset, 0, 0);
    const wallsLayer = newmap.createLayer("walls", tileset, 0, 0);
    wallsLayer?.setVisible(true);
    groundLayer?.setVisible(true);
    
    // Get map dimensions for camera bounds
    mapWidth = newmap.widthInPixels;
    mapHeight = newmap.heightInPixels;
    
    // Set world bounds to match the map size
    this.physics.world.setBounds(0, 0, mapWidth, mapHeight);
    
    wallsLayer?.setCollisionByProperty({ collide: true });
    
    // Create main player
    player = this.physics.add.sprite(400, 300, 'player');
    player.setCollideWorldBounds(true);
    player.setTint(0x44ff44); // Green for self
    player.setScale(0.8); // Make players a bit smaller

    if (!wallsLayer) {
      console.error("wallsLayer is not defined");
      return;
    }
    this.physics.add.collider(player, wallsLayer);

    moves = this.input.keyboard?.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });

    // Add Q and P key listeners
    qKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    pKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.P);

    // Set up camera to follow player with zoom and tight focus
    this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);
    this.cameras.main.startFollow(player, true);
    this.cameras.main.setZoom(2.5); // Increased zoom for closer view
    this.cameras.main.setLerp(0.1, 0.1);
    this.cameras.main.setDeadzone(0, 0); // Camera stays centered on player

    // Initialize player position and send to backend
    if (currentSocket && currentUsername) {
      const initialPlayer: Player = {
        username: currentUsername,
        dead: false,
        role: currentGameState?.myRole || 'crewmate',
        roomID: currentGameState?.roomID || '',
        position: { x: 400, y: 300 }
      };
      
      // Send initial position to server
      currentSocket.emit('movement', [initialPlayer]);
      setMyPlayer(initialPlayer);
    }
  }

  function Update(this: Phaser.Scene) {
    if (!player) return;

    player.setVelocity(0);

    const speed = 150;
    let moved = false;
    let newX = player.x;
    let newY = player.y;
    
    // Handle movement input
    if (moves.up?.isDown) {
      player.setVelocityY(-speed);
      moved = true;
    }
    if (moves.down?.isDown) {
      player.setVelocityY(speed);
      moved = true;
    }
    if (moves.left?.isDown) {
      player.setVelocityX(-speed);
      moved = true;
    }
    if (moves.right?.isDown) {
      player.setVelocityX(speed);
      moved = true;
    }
    
    // Handle Q key for kill (only imposters)
    if (Phaser.Input.Keyboard.JustDown(qKey) && currentGameState?.myRole === 'imposter') {
      handleKill();
    }

    // Handle P key for polling
    if (Phaser.Input.Keyboard.JustDown(pKey)) {
      handleStartPolling();
    }
    
    // Normalize diagonal movement
    if ((moves.up?.isDown || moves.down?.isDown) && (moves.left?.isDown || moves.right?.isDown)) {
      const normalizedSpeed = speed * 0.707;
      player.body.velocity.normalize().scale(normalizedSpeed);
    }

    // Send movement to server if player moved
    if (moved && currentSocket && currentUsername) {
      const updatedPlayer: Player = {
        username: currentUsername,
        dead: false,
        role: currentGameState?.myRole || 'crewmate',
        roomID: currentGameState?.roomID || '',
        position: { x: player.x, y: player.y }
      };
      
      // Send updated position to server
      currentSocket.emit('movement', [updatedPlayer]);
      setMyPlayer(updatedPlayer);
    }

    // Update other players positions
    if (allPlayersData && allPlayersData.length > 0) {
      allPlayersData.forEach(playerData => {
        // Skip self
        if (playerData.username === currentUsername) return;
        
        // Skip dead players (but don't remove them yet)
        if (playerData.dead) {
          if (otherPlayers[playerData.username]) {
            otherPlayers[playerData.username].setVisible(false);
          }
          return;
        }

        // Create or update other player sprites
        if (!otherPlayers[playerData.username]) {
          // Create new player sprite
          otherPlayers[playerData.username] = this.physics.add.sprite(
            playerData.position.x, 
            playerData.position.y, 
            'player'
          );
          otherPlayers[playerData.username].setCollideWorldBounds(true);
          otherPlayers[playerData.username].setScale(0.8);
          
          // Color based on role (only show for imposters)
          if (currentGameState?.myRole === 'imposter' && playerData.role === 'imposter') {
            otherPlayers[playerData.username].setTint(0xff4444); // Red for imposters
          } else {
            otherPlayers[playerData.username].setTint(0x4444ff); // Blue for others
          }
          
          console.log(`Created player sprite for: ${playerData.username}`);
        } else {
          // Update existing player position smoothly
          otherPlayers[playerData.username].setVisible(true);
          
          // Smooth movement interpolation
          const currentX = otherPlayers[playerData.username].x;
          const currentY = otherPlayers[playerData.username].y;
          const targetX = playerData.position.x;
          const targetY = playerData.position.y;
          
          // If the distance is significant, update position
          const distance = Math.sqrt((targetX - currentX) ** 2 + (targetY - currentY) ** 2);
          if (distance > 5) {
            // Interpolate for smooth movement
            const lerpFactor = 0.3;
            otherPlayers[playerData.username].x = currentX + (targetX - currentX) * lerpFactor;
            otherPlayers[playerData.username].y = currentY + (targetY - currentY) * lerpFactor;
          }
        }
      });
    }

    // Clean up disconnected players
    Object.keys(otherPlayers).forEach(username => {
      const stillExists = allPlayersData.find(p => p.username === username);
      if (!stillExists) {
        console.log(`Removing player sprite for: ${username}`);
        otherPlayers[username].destroy();
        delete otherPlayers[username];
      }
    });
  }

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

  // Start polling
  const handleStartPolling = () => {
    if (!socket || !isPollingActive) return;
    setMessages(prev => [...prev, 'Polling started! Vote for who you think is the imposter.']);
  };

  // Vote for player
  const handleVote = (targetUsername: string) => {
    if (!socket || hasVoted) return;
    socket.emit('polling', { username: targetUsername });
    setHasVoted(true);
    setMessages(prev => [...prev, `You voted for ${targetUsername}`]);
  };

  // End polling (for debugging/testing - you might want to remove this or make it host-only)
  const handleEndPolling = () => {
    if (!socket) return;
    socket.emit('donePolling');
  };

  // Render lobby phase
  if (gameState.phase === 'lobby') {
    return (
      <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}>
          <h1>Among Us - Multiplayer Game</h1>
          <div style={{ marginBottom: '20px' }}>
            Status: {connected ? '🟢 Connected' : '🔴 Disconnected'}
          </div>
          
          {error && <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}
          
          <div style={{ marginBottom: '20px' }}>
            <input
              type="text"
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{ padding: '10px', marginRight: '10px', width: '200px' }}
            />
            <button onClick={handleSetUsername} style={{ padding: '10px' }}>Set Username</button>
          </div>

          <div>
            <button 
              onClick={() => setShowCreateRoom(!showCreateRoom)}
              style={{ padding: '10px', marginBottom: '10px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px' }}
            >
              {showCreateRoom ? 'Cancel' : 'Create Room'}
            </button>
            
            {!showCreateRoom && (
              <div style={{ marginTop: '10px' }}>
                <input
                  type="text"
                  placeholder="Room ID"
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                  style={{ padding: '10px', marginRight: '10px', width: '150px' }}
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  style={{ padding: '10px', marginRight: '10px', width: '150px' }}
                />
                <button 
                  onClick={handleJoinRoom}
                  style={{ padding: '10px', backgroundColor: '#008CBA', color: 'white', border: 'none', borderRadius: '4px' }}
                >
                  Join Room
                </button>
              </div>
            )}

            {showCreateRoom && (
              <div style={{ marginTop: '10px' }}>
                <input
                  type="text"
                  placeholder="Room ID"
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                  style={{ padding: '10px', marginRight: '10px', width: '150px' }}
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  style={{ padding: '10px', marginRight: '10px', width: '150px' }}
                />
                <button 
                  onClick={handleCreateRoom}
                  style={{ padding: '10px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px' }}
                >
                  Create Room
                </button>
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
      <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
          <h2>Room: {gameState.roomID}</h2>
          <div style={{ marginBottom: '20px' }}>
            <h3>Players in room:</h3>
            <div style={{ textAlign: 'left', maxHeight: '200px', overflowY: 'auto', backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
              {messages.map((msg, index) => (
                <div key={index} style={{ marginBottom: '5px' }}>{msg}</div>
              ))}
            </div>
          </div>
          
          {gameState.isHost && (
            <button 
              onClick={handleStartGame}
              style={{ padding: '15px 30px', backgroundColor: '#ff4444', color: 'white', border: 'none', borderRadius: '4px', fontSize: '16px' }}
            >
              Start Game (Need 4+ players)
            </button>
          )}
          
          {error && <div style={{ color: 'red', marginTop: '10px' }}>{error}</div>}
        </div>
      </div>
    );
  }

  // Render game phase
  if (gameState.phase === 'playing') {
    return (
      <div style={{ 
        position: 'relative', 
        width: '100vw', 
        height: '100vh', 
        overflow: 'hidden',
        fontFamily: 'Arial, sans-serif'
      }}>
        {/* Top Left - Role and Game Info */}
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          zIndex: 1000,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '10px',
          borderRadius: '8px',
          fontSize: '14px'
        }}>
          <div>Role: <span style={{ 
            color: gameState.myRole === 'imposter' ? '#ff4444' : '#44ff44',
            fontWeight: 'bold'
          }}>{gameState.myRole}</span></div>
          <div>Room: {gameState.roomID}</div>
          <div>Players: {allPlayers.filter(p => !p.dead).length} alive</div>
          {error && <div style={{ color: '#ff6666', fontSize: '12px', marginTop: '5px' }}>{error}</div>}
        </div>

        {/* Top Center - Kill Button (for imposters only) */}
        {gameState.myRole === 'imposter' && (
          <div style={{
            position: 'absolute',
            top: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000
          }}>
            <button 
              onClick={handleKill}
              style={{ 
                padding: '10px 20px', 
                backgroundColor: '#ff4444', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                fontSize: '16px',
                fontWeight: 'bold'
              }}
            >
              Kill (Q)
            </button>
          </div>
        )}

        {/* Right Side - Messages and Voting */}
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          width: '300px',
          maxHeight: '80vh',
          zIndex: 1000,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '15px',
          borderRadius: '8px',
          overflowY: 'auto'
        }}>
          {/* Voting Section */}
          {isPollingActive && Object.keys(pollingData).length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#ffaa00' }}>🗳️ Voting Active</h3>
              <div style={{ fontSize: '12px', marginBottom: '10px' }}>
                Press P to start voting | Click to vote
              </div>
              {Object.entries(pollingData).map(([player, votes]) => (
                <div key={player} style={{ 
                  marginBottom: '8px', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  padding: '5px 8px',
                  borderRadius: '4px'
                }}>
                  <span style={{ fontSize: '14px' }}>{player}: {votes} votes</span>
                  <button 
                    onClick={() => handleVote(player)}
                    disabled={hasVoted}
                    style={{ 
                      padding: '4px 12px', 
                      backgroundColor: hasVoted ? '#666' : '#008CBA', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: hasVoted ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {hasVoted ? 'Voted' : 'Vote'}
                  </button>
                </div>
              ))}
              {hasVoted && (
                <div style={{ fontSize: '12px', color: '#44ff44', textAlign: 'center', marginTop: '10px' }}>
                  ✓ You have voted! Waiting for others...
                </div>
              )}
            </div>
          )}

          {/* Messages Section */}
          <div>
            <h4 style={{ margin: '0 0 10px 0', color: '#44ff44' }}>📨 Game Messages</h4>
            <div style={{ 
              maxHeight: '300px', 
              overflowY: 'auto',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              padding: '8px',
              borderRadius: '4px'
            }}>
              {messages.slice(-10).map((msg, index) => (
                <div key={index} style={{ 
                  marginBottom: '4px', 
                  fontSize: '13px',
                  padding: '2px 0',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  {msg}
                </div>
              ))}
              {messages.length === 0 && (
                <div style={{ fontSize: '12px', color: '#888', fontStyle: 'italic' }}>
                  No messages yet...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Center - Controls */}
        <div style={{
          position: 'absolute',
          bottom: '10px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '8px 15px',
          borderRadius: '8px',
          fontSize: '12px',
          textAlign: 'center'
        }}>
          <div>WASD: Move | Q: Kill {gameState.myRole !== 'imposter' && '(Imposters only)'} | P: Polling</div>
          {gameState.myRole === 'imposter' && (
            <div style={{ color: '#ff4444', fontWeight: 'bold', fontSize: '11px' }}>
              You are an IMPOSTER! Kill other players and blend in.
            </div>
          )}
        </div>

        {/* Game Container - Full Screen */}
        <div 
          id="game-container" 
          style={{ 
            width: '100vw', 
            height: '100vh',
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 1
          }}
        ></div>
      </div>
    );
  }

  return null;
}