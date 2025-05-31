// src/GameScene.ts
import Phaser from 'phaser';

// This should match the Player interface in your Game.tsx and backend
interface PlayerData {
  username: string;
  dead: boolean;
  role: string;
  roomID: string;
  position: { x: number; y: number };
}

export class GameScene extends Phaser.Scene {
    private localPlayerSprite: Phaser.Physics.Arcade.Sprite | null = null;
    private playerSprites: Map<string, Phaser.Physics.Arcade.Sprite> = new Map(); // Map username to Sprite
    private playerNameTags: Map<string, Phaser.GameObjects.Text> = new Map();
    private playerDeadIndicators: Map<string, Phaser.GameObjects.Text> = new Map();


    private keys!: Record<string, Phaser.Input.Keyboard.Key>; // Definite assignment
    private tileMap!: Phaser.Tilemaps.Tilemap; // Definite assignment
    private wallsLayer!: Phaser.Tilemaps.TilemapLayer | null; // Can be null if layer not found

    private onPlayerMoveCallback: ((x: number, y: number) => void) | null = null;
    private localUsername: string = '';
    private myRole: string | null = null;

    constructor() {
        super({ key: 'GameScene' });
    }

    // Called by React to pass initial data and callbacks
    init(data: {
        localUsername: string;
        onPlayerMove: (x: number, y: number) => void;
        // initialPlayers: PlayerData[]; // We'll use updatePlayers for initial setup too
        myRole: string | null;
    }) {
        this.localUsername = data.localUsername;
        this.onPlayerMoveCallback = data.onPlayerMove;
        this.myRole = data.myRole;
        console.log(`[PhaserScene] Init called. LocalUser: ${this.localUsername}, Role: ${this.myRole}`);
    }

    preload() {
        console.log('[PhaserScene] Preloading assets...');
        // Paths are relative to the 'public' folder
        this.load.tilemapTiledJSON('map', 'assets/practice.json');
        this.load.image('tilesetImage', 'assets/Tileset.png'); // Use a clear key like 'tilesetImage'
        this.load.image('playerSprite', 'assets/player.png');  // Use a clear key
    }

    create() {
        console.log('[PhaserScene] Creating scene...');
        this.tileMap = this.make.tilemap({ key: 'map' });

        // The first parameter is the name of the tileset in your Tiled JSON file.
        // The second is the key of the image loaded in preload().
        // Check your practice.json: find the "tilesets" array, look for the "name" property of your tileset.
        // For example, if Tiled JSON has tileset name "MyTiles", use:
        // const tileset = this.tileMap.addTilesetImage('MyTiles', 'tilesetImage');
        const tileset = this.tileMap.addTilesetImage('completing ', 'tilesetImage'); // Assuming 'completing ' is the name in Tiled

        if (!tileset) {
            console.error("Failed to load tileset! Check name in Tiled JSON ('completing ') and Phaser load key ('tilesetImage').");
            return;
        }

        // Create layers (ensure layer names "ground" and "walls" exist in your Tiled map)
        this.tileMap.createLayer('ground', tileset, 0, 0);
        this.wallsLayer = this.tileMap.createLayer('walls', tileset, 0, 0);

        if (!this.wallsLayer) {
            console.warn("Walls layer not found in Tiled map!");
        } else {
            // Set collisions. Ensure your 'walls' tiles in Tiled have a custom property (e.g., 'collides: true')
            this.wallsLayer.setCollisionByProperty({ collide: true });
            console.log('[PhaserScene] Walls layer created and collision set.');
        }

        this.physics.world.setBounds(0, 0, this.tileMap.widthInPixels, this.tileMap.heightInPixels);

        // Input
        this.keys = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            right: Phaser.Input.Keyboard.KeyCodes.D,
            arrowUp: Phaser.Input.Keyboard.KeyCodes.UP,
            arrowLeft: Phaser.Input.Keyboard.KeyCodes.LEFT,
            arrowDown: Phaser.Input.Keyboard.KeyCodes.DOWN,
            arrowRight: Phaser.Input.Keyboard.KeyCodes.RIGHT,
        }) as Record<string, Phaser.Input.Keyboard.Key>;

        // Camera setup will be done when localPlayerSprite is identified/created
        this.cameras.main.setZoom(1.5); // Adjust as needed

        // Store scene instance for React to access
        this.sys.game.registry.set('gameSceneInstance', this);
        console.log('[PhaserScene] Scene creation complete.');
    }

    public updatePlayers(allPlayersData: PlayerData[], currentMyRole: string | null) {
        if (!this.tileMap) { // Scene not fully created
            console.warn("[PhaserScene] updatePlayers called before scene fully created.");
            return;
        }
        this.myRole = currentMyRole;
        // console.log(`[PhaserScene] Updating players. Count: ${allPlayersData.length}. MyRole: ${this.myRole}`);

        const activeUsernames = new Set<string>();

        allPlayersData.forEach(playerData => {
            activeUsernames.add(playerData.username);
            let sprite = this.playerSprites.get(playerData.username);

            if (!sprite) {
                // Create new sprite
                sprite = this.physics.add.sprite(playerData.position.x, playerData.position.y, 'playerSprite');
                sprite.setCollideWorldBounds(true);
                if (this.wallsLayer) {
                    this.physics.add.collider(sprite, this.wallsLayer);
                }
                this.playerSprites.set(playerData.username, sprite);
                console.log(`[PhaserScene] Created sprite for ${playerData.username} at ${playerData.position.x}, ${playerData.position.y}`);

                // Create name tag
                const nameTag = this.add.text(sprite.x, sprite.y - 20, playerData.username, {
                    font: '12px Arial',
                    color: '#ffffff',
                    align: 'center'
                }).setOrigin(0.5);
                this.playerNameTags.set(playerData.username, nameTag);

                if (playerData.username === this.localUsername) {
                    this.localPlayerSprite = sprite;
                    this.cameras.main.startFollow(this.localPlayerSprite, true, 0.1, 0.1);
                    this.cameras.main.setBounds(0,0, this.tileMap.widthInPixels, this.tileMap.heightInPixels);
                    console.log(`[PhaserScene] Local player sprite set and camera following ${this.localUsername}`);
                }
            }

            // Update existing sprite position (if not the local player moving themselves)
            // Local player position is driven by input, then sent to server, then server broadcasts.
            // So, the server's position for the local player is the authoritative one to render.
            if (sprite.x !== playerData.position.x || sprite.y !== playerData.position.y) {
                sprite.setPosition(playerData.position.x, playerData.position.y);
            }


            // Update visual state (tint, dead indicator, name tag visibility)
            const nameTag = this.playerNameTags.get(playerData.username);
            let deadIndicator = this.playerDeadIndicators.get(playerData.username);

            if (playerData.dead) {
                sprite.setVisible(false);
                nameTag?.setVisible(false);
                if (!deadIndicator) {
                    deadIndicator = this.add.text(playerData.position.x, playerData.position.y, '💀', {
                        fontSize: '20px', color: '#FF0000'
                    }).setOrigin(0.5);
                    this.playerDeadIndicators.set(playerData.username, deadIndicator);
                }
                deadIndicator.setPosition(playerData.position.x, playerData.position.y);
                deadIndicator.setVisible(true);
            } else {
                sprite.setVisible(true);
                nameTag?.setVisible(true);
                deadIndicator?.setVisible(false);

                // Tint based on role (example)
                if (this.myRole === 'imposter' && playerData.role === 'imposter') {
                    sprite.setTint(0xff4444); // Red for fellow imposters (if you're imposter)
                } else if (playerData.username === this.localUsername) {
                    sprite.setTint(0x44ff44); // Green for self
                } else {
                    sprite.clearTint(); // Default appearance for others
                }
            }
        });

        // Remove sprites for players no longer in the game
        this.playerSprites.forEach((sprite, username) => {
            if (!activeUsernames.has(username)) {
                sprite.destroy();
                this.playerSprites.delete(username);
                this.playerNameTags.get(username)?.destroy();
                this.playerNameTags.delete(username);
                this.playerDeadIndicators.get(username)?.destroy();
                this.playerDeadIndicators.delete(username);
                console.log(`[PhaserScene] Removed sprite for disconnected player ${username}`);
                if (this.localPlayerSprite === sprite) {
                    this.localPlayerSprite = null; // Should not happen if server handles disconnects well
                }
            }
        });
    }


    update(time: number, delta: number) {
        if (!this.localPlayerSprite || !this.localPlayerSprite.body) {
            return;
        }

        // Check if local player is dead
        const localPlayerData = Array.from(this.playerSprites.keys()).map(key => ({ key, sprite: this.playerSprites.get(key) })).find(p => p.key === this.localUsername);
        const isLocalPlayerDead = !localPlayerData || !localPlayerData.sprite || !localPlayerData.sprite.visible; // A bit indirect, check if sprite is visible

        if (isLocalPlayerDead) {
            this.localPlayerSprite.setVelocity(0,0);
            return;
        }

        const speed = 150;
        let dx = 0;
        let dy = 0;

        if (this.keys.left.isDown || this.keys.arrowLeft.isDown) dx = -1;
        else if (this.keys.right.isDown || this.keys.arrowRight.isDown) dx = 1;

        if (this.keys.up.isDown || this.keys.arrowUp.isDown) dy = -1;
        else if (this.keys.down.isDown || this.keys.arrowDown.isDown) dy = 1;

        const currentVelocityX = this.localPlayerSprite.body.velocity.x;
        const currentVelocityY = this.localPlayerSprite.body.velocity.y;

        this.localPlayerSprite.setVelocity(0,0); // Stop first

        if (dx !== 0 || dy !== 0) {
             // Normalize diagonal speed
            const magnitude = Math.sqrt(dx * dx + dy * dy);
            this.localPlayerSprite.setVelocity( (dx / magnitude) * speed, (dy / magnitude) * speed);
        }

        // If velocity changed, emit movement
        if (this.localPlayerSprite.body.velocity.x !== 0 || this.localPlayerSprite.body.velocity.y !== 0 ||
            ( (dx !==0 || dy !==0) && (currentVelocityX === 0 && currentVelocityY === 0) ) || // started moving
            ( (dx ===0 && dy ===0) && (currentVelocityX !== 0 || currentVelocityY !== 0) )    // stopped moving
           ) {
            if (this.onPlayerMoveCallback) {
                this.onPlayerMoveCallback(this.localPlayerSprite.x, this.localPlayerSprite.y);
                console.log(this.localPlayerSprite.x, this.localPlayerSprite.y)
            }
        }

        // Update name tags and dead indicators to follow sprites
        this.playerSprites.forEach((sprite, username) => {
            const nameTag = this.playerNameTags.get(username);
            if (nameTag && nameTag.visible) {
                nameTag.setPosition(sprite.x, sprite.y - 20); // Adjust offset as needed
            }
            const deadIndicator = this.playerDeadIndicators.get(username);
            if (deadIndicator && deadIndicator.visible) {
                deadIndicator.setPosition(sprite.x, sprite.y);
            }
        });
    }
    
    shutdown() {
        console.log("[PhaserScene] Shutting down scene...");
        this.playerSprites.forEach(sprite => sprite.destroy());
        this.playerSprites.clear();
        this.playerNameTags.forEach(tag => tag.destroy());
        this.playerNameTags.clear();
        this.playerDeadIndicators.forEach(indicator => indicator.destroy());
        this.playerDeadIndicators.clear();
        
        this.localPlayerSprite = null;
        if (this.tileMap) this.tileMap.destroy();
        
        // Important: remove from registry if set
        if (this.sys.game.registry.has('gameSceneInstance')) {
            this.sys.game.registry.remove('gameSceneInstance');
        }
        console.log("[PhaserScene] Shutdown complete.");
    }
}