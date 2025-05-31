import Phaser from 'phaser';

export default class GameScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private walls!: Phaser.Tilemaps.TilemapLayer;

  constructor() {
    super('GameScene');
  }

  preload() {
    this.load.image('tileset', 'assets/tilesets/your-tileset.png'); // replace path
    this.load.tilemapTiledJSON('map', 'assets/tilemaps/your-map.json'); // replace path
    this.load.atlas('atlas', 'assets/atlas/atlas.png', 'assets/atlas/atlas.json'); // replace path
  }

  create() {
    const map = this.make.tilemap({ key: 'map' });

    const tileset = map.addTilesetImage('completing ', 'tileset');
    if (!tileset) throw new Error("Tileset 'completing ' not found. Check Tiled name.");

    const walls = map.createLayer('walls', tileset, 0, 0);
    if (!walls) throw new Error("Layer 'walls' not found. Check Tiled layer name.");

    walls.setCollisionByProperty({ collide: true });
    this.walls = walls;

    const spawnPoint = map.findObject('objects', obj => obj.name === 'Spawn Point') as Phaser.Types.Tilemaps.TiledObject;
    if (!spawnPoint || spawnPoint.x === undefined || spawnPoint.y === undefined) {
      throw new Error("Spawn Point not found or missing position.");
    }

    this.player = this.physics.add.sprite(spawnPoint.x, spawnPoint.y, 'atlas', 'misa-front');
    this.player.body.setSize(this.player.width * 0.5, this.player.height * 0.8);
    this.physics.add.collider(this.player, walls);

    this.cameras.main.startFollow(this.player);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    this.cursors = this.input.keyboard.createCursorKeys();
  }

  update() {
    const speed = 175;
    const prevVelocity = this.player.body.velocity.clone();

    this.player.body.setVelocity(0);

    if (this.cursors.left?.isDown) {
      this.player.body.setVelocityX(-speed);
    } else if (this.cursors.right?.isDown) {
      this.player.body.setVelocityX(speed);
    }

    if (this.cursors.up?.isDown) {
      this.player.body.setVelocityY(-speed);
    } else if (this.cursors.down?.isDown) {
      this.player.body.setVelocityY(speed);
    }

    this.player.body.velocity.normalize().scale(speed);

    if (this.cursors.left?.isDown) {
      this.player.anims.play('left-walk', true);
    } else if (this.cursors.right?.isDown) {
      this.player.anims.play('right-walk', true);
    } else if (this.cursors.up?.isDown) {
      this.player.anims.play('back-walk', true);
    } else if (this.cursors.down?.isDown) {
      this.player.anims.play('front-walk', true);
    } else {
      this.player.anims.stop();

      if (prevVelocity.x < 0) this.player.setTexture('atlas', 'misa-left');
      else if (prevVelocity.x > 0) this.player.setTexture('atlas', 'misa-right');
      else if (prevVelocity.y < 0) this.player.setTexture('atlas', 'misa-back');
      else if (prevVelocity.y > 0) this.player.setTexture('atlas', 'misa-front');
    }
  }
}
