import { Input, Math as PhaserMath, Scene } from 'phaser';
import { gameSfx } from '../audio/ProceduralSfx';
import { createSoundToggle } from '../ui/SoundToggle';

const GAME_WIDTH = 1024;
const GAME_HEIGHT = 768;
const MOVE_SPEED = 240;
const JUMP_SPEED = 560;
const START_X = 100;
const START_Y = 688;
const MAX_LIVES = 3;
const PLAYER_FRAME_SIZE = 48;
const PLAYER_BODY_WIDTH = 36;
const PLAYER_BODY_HEIGHT = 48;
const PLAYER_BODY_OFFSET_X = 6;
const COIN_FRAME_SIZE = 24;
const COIN_BODY_SIZE = 22;
const DECOR_FRAME_SIZE = 32;
const TERRAIN_GRASS_HEIGHT = 12;
const SLIME_FRAME_SIZE = 32;
const SLIME_BODY_WIDTH = 28;
const SLIME_BODY_HEIGHT = 22;
const SLIME_BODY_OFFSET_X = 2;
const SLIME_BODY_OFFSET_Y = 10;
const SLIME_SPEED = 55;
const SLIME_START_X = 300;
const SLIME_START_Y = 582;
const SLIME_PATROL_LEFT = 220;
const SLIME_PATROL_RIGHT = 380;
const STOMP_BOUNCE = 360;
const ENEMY_INVULNERABILITY_MS = 900;

const DEPTH_BACKGROUND = -100;
const DEPTH_TERRAIN = -20;
const DEPTH_DECOR = 5;
const DEPTH_FINISH = 10;
const DEPTH_COIN = 15;
const DEPTH_ENEMY = 18;
const DEPTH_EFFECT_DUST = 19;
const DEPTH_PLAYER = 20;
const DEPTH_EFFECT_SPARKLE = 24;
const DEPTH_HUD = 30;
const DEPTH_PAUSE_BACKDROP = 200;
const DEPTH_PAUSE_PANEL = 201;
const DEPTH_PAUSE_UI = 202;

type GameState = 'playing' | 'paused' | 'gameover' | 'win';

export class Game extends Scene
{
    private player: Phaser.Physics.Arcade.Sprite;
    private playerBody: Phaser.Physics.Arcade.Body;
    private slime: Phaser.Physics.Arcade.Sprite;
    private slimeBody: Phaser.Physics.Arcade.Body;
    private slimeDirection = 1;
    private invulnerableUntil = 0;
    private wasOnGround = true;
    private landingDustSuppressedUntil = 0;
    private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
    private keyA: Phaser.Input.Keyboard.Key;
    private keyD: Phaser.Input.Keyboard.Key;
    private keyEsc: Phaser.Input.Keyboard.Key;
    private coins: Phaser.Physics.Arcade.StaticGroup;
    private scoreText: Phaser.GameObjects.Text;
    private livesText: Phaser.GameObjects.Text;
    private muteText: Phaser.GameObjects.Text;
    private pauseElements: Phaser.GameObjects.GameObject[] = [];
    private score = 0;
    private lives = MAX_LIVES;
    private gameState: GameState = 'playing';

    constructor ()
    {
        super('Game');
    }

    preload ()
    {
        //  Muat sekali saja; saat scene restart, texture sudah ada di cache.
        if (!this.textures.exists('player'))
        {
            this.load.spritesheet('player', 'assets/player.png', {
                frameWidth: PLAYER_FRAME_SIZE,
                frameHeight: PLAYER_FRAME_SIZE
            });
        }

        if (!this.textures.exists('coin'))
        {
            this.load.spritesheet('coin', 'assets/coin.png', {
                frameWidth: COIN_FRAME_SIZE,
                frameHeight: COIN_FRAME_SIZE
            });
        }

        if (!this.textures.exists('slime'))
        {
            this.load.spritesheet('slime', 'assets/slime.png', {
                frameWidth: SLIME_FRAME_SIZE,
                frameHeight: SLIME_FRAME_SIZE
            });
        }

        if (!this.textures.exists('dust'))
        {
            this.load.image('dust', 'assets/dust.png');
        }

        if (!this.textures.exists('sparkle'))
        {
            this.load.image('sparkle', 'assets/sparkle.png');
        }

        if (!this.textures.exists('forest-bg'))
        {
            this.load.image('forest-bg', 'assets/forest-bg.png');
        }

        if (!this.textures.exists('terrain-grass'))
        {
            this.load.image('terrain-grass', 'assets/terrain-grass.png');
        }

        if (!this.textures.exists('terrain-dirt'))
        {
            this.load.image('terrain-dirt', 'assets/terrain-dirt.png');
        }

        if (!this.textures.exists('forest-decor'))
        {
            this.load.spritesheet('forest-decor', 'assets/forest-decor.png', {
                frameWidth: DECOR_FRAME_SIZE,
                frameHeight: DECOR_FRAME_SIZE
            });
        }
    }

    create ()
    {
        //  Scene restart memakai instance yang sama, jadi semua state harus direset di sini.
        this.score = 0;
        this.lives = MAX_LIVES;
        this.gameState = 'playing';
        this.slimeDirection = 1;
        this.invulnerableUntil = 0;
        this.wasOnGround = true;
        this.landingDustSuppressedUntil = 0;
        this.pauseElements = [];

        //  Pastikan state global tidak tertinggal jika scene di-restart dari pause.
        this.physics.world.resume();
        this.anims.resumeAll();
        this.tweens.resumeAll();

        this.cameras.main.setBackgroundColor('#a8d5ba');

        this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'forest-bg')
            .setDepth(DEPTH_BACKGROUND)
            .setScrollFactor(0);

        //  Sisi kiri, kanan, dan atas tetap dibatasi. Sisi bawah sengaja dibuka
        //  supaya karakter bisa jatuh melewati batas bawah game.
        this.physics.world.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT, true, true, true, false);

        //  Angka posisi dan ukuran ini sama dengan level sebelumnya.
        //  Rectangle tetap menjadi static body, lalu visual tanah digambar terpisah.
        const platformDefinitions = [
            { x: 150, y: 740, width: 300, height: 56 },
            { x: 540, y: 740, width: 240, height: 56 },
            { x: 902, y: 740, width: 244, height: 56 },
            { x: 300, y: 610, width: 220, height: 24 },
            { x: 600, y: 500, width: 220, height: 24 },
            { x: 850, y: 390, width: 180, height: 24 }
        ];

        const platforms = platformDefinitions.map((platform) => {

            const rectangle = this.add.rectangle(
                platform.x,
                platform.y,
                platform.width,
                platform.height,
                0x2f5d46
            );

            rectangle.setVisible(false);

            return rectangle;
        });

        platforms.forEach((platform) => this.physics.add.existing(platform, true));
        platformDefinitions.forEach((platform) => {
            this.createTerrain(platform.x, platform.y, platform.width, platform.height);
        });

        //  Garis finis di ujung kanan level, memakai overlap agar bisa dilewati.
        const finishLine = this.add.rectangle(GAME_WIDTH - 44, 646, 12, 132, 0xffd166);
        finishLine.setStrokeStyle(3, 0x8a5a00);
        finishLine.setDepth(DEPTH_FINISH);
        this.physics.add.existing(finishLine, true);

        this.add.text(GAME_WIDTH - 44, 552, 'FINISH', {
            fontFamily: 'monospace',
            fontSize: '18px',
            fontStyle: 'bold',
            color: '#1f3d2b'
        }).setOrigin(0.5).setDepth(DEPTH_FINISH + 1);

        //  Karakter pixel art memakai dynamic body yang sama dengan placeholder lama.
        this.player = this.physics.add.sprite(START_X, START_Y, 'player');
        this.playerBody = this.player.body as Phaser.Physics.Arcade.Body;
        this.playerBody.setSize(PLAYER_BODY_WIDTH, PLAYER_BODY_HEIGHT, false);
        this.playerBody.setOffset(PLAYER_BODY_OFFSET_X, 0);
        this.playerBody.setCollideWorldBounds(true);
        this.player.setDepth(DEPTH_PLAYER);

        this.createPlayerAnimations();
        this.player.anims.play('player-idle');

        this.physics.add.collider(this.player, platforms);
        this.physics.add.overlap(this.player, finishLine, this.reachFinish, undefined, this);

        //  Koin memakai static body agar diam di tempat dan tidak terkena gravitasi.
        this.coins = this.physics.add.staticGroup();
        this.createCoinAnimations();

        const coinPositions = [
            { x: 260, y: 555 }, { x: 340, y: 555 },
            { x: 560, y: 445 }, { x: 640, y: 445 },
            { x: 810, y: 335 }, { x: 890, y: 335 }
        ];

        coinPositions.forEach((position) => {

            //  Sprite 24x24 dengan body 22x22, sesuai ukuran koin lama.
            const coin = this.add.sprite(position.x, position.y, 'coin');
            coin.setDepth(DEPTH_COIN);
            coin.play('coin-spin');

            this.coins.add(coin);

            const coinBody = coin.body as Phaser.Physics.Arcade.StaticBody;
            coinBody.setSize(COIN_BODY_SIZE, COIN_BODY_SIZE, true);

        });

        //  Overlap hanya mendeteksi sentuhan; karakter tidak terhalang oleh koin.
        this.physics.add.overlap(this.player, this.coins, this.collectCoin, undefined, this);

        //  Slime berpatroli di Platform A. Batas patroli berada di dalam
        //  platform (190..410), jadi slime tidak bisa berjalan keluar tepi.
        this.createSlimeAnimations();
        this.createSlime(platforms);

        this.createDecorations();

        this.cursors = this.input.keyboard!.createCursorKeys();
        this.keyA = this.input.keyboard!.addKey(Input.Keyboard.KeyCodes.A);
        this.keyD = this.input.keyboard!.addKey(Input.Keyboard.KeyCodes.D);
        this.keyEsc = this.input.keyboard!.addKey(Input.Keyboard.KeyCodes.ESC);
        this.input.keyboard!.resetKeys();

        this.setupAudio();

        this.scoreText = this.add.text(24, 20, 'Skor: 0', {
            fontFamily: 'monospace',
            fontSize: '24px',
            fontStyle: 'bold',
            color: '#1f3d2b'
        }).setDepth(DEPTH_HUD);

        this.livesText = this.add.text(24, 54, `Nyawa: ${this.lives}`, {
            fontFamily: 'monospace',
            fontSize: '20px',
            fontStyle: 'bold',
            color: '#1f3d2b'
        }).setDepth(DEPTH_HUD);

        this.add.text(24, 86, 'A / D atau Panah Kiri/Kanan: bergerak    Space: lompat    Esc: pause', {
            fontFamily: 'monospace',
            fontSize: '16px',
            color: '#1f3d2b'
        }).setDepth(DEPTH_HUD);

        this.muteText = createSoundToggle(this, GAME_WIDTH - 24, 20, DEPTH_HUD + 1);
    }

    private setupAudio ()
    {
        //  AudioContext baru dibuat setelah keyboard/pointer pertama,
        //  supaya sesuai kebijakan autoplay browser.
        this.input.keyboard!.once('keydown', () => gameSfx.unlock());
        this.input.once('pointerdown', () => gameSfx.unlock());

        //  Hentikan SFX dan pastikan manager global tidak tertinggal dalam state pause.
        this.events.once('shutdown', () => {
            gameSfx.stopAll();
            this.anims.resumeAll();
            this.tweens.resumeAll();
        });
    }

    private pauseGame ()
    {
        if (this.gameState !== 'playing')
        {
            return;
        }

        this.gameState = 'paused';
        this.playerBody.setVelocityX(0);
        this.input.keyboard!.resetKeys();
        this.physics.world.pause();
        this.anims.pauseAll();
        this.tweens.pauseAll();
        gameSfx.stopAll();
        this.showPauseOverlay();
    }

    private resumeGame ()
    {
        if (this.gameState !== 'paused')
        {
            return;
        }

        this.hidePauseOverlay();
        this.gameState = 'playing';
        this.physics.world.resume();
        this.anims.resumeAll();
        this.tweens.resumeAll();
        this.input.keyboard!.resetKeys();
        this.playerBody.setVelocityX(0);
        this.muteText.setText(gameSfx.isMuted() ? 'SFX: OFF' : 'SFX: ON');
    }

    private showPauseOverlay ()
    {
        if (this.pauseElements.length > 0)
        {
            return;
        }

        const backdrop = this.add.rectangle(
            GAME_WIDTH / 2,
            GAME_HEIGHT / 2,
            GAME_WIDTH,
            GAME_HEIGHT,
            0x102018,
            0.78
        ).setDepth(DEPTH_PAUSE_BACKDROP).setInteractive();

        const panel = this.add.rectangle(
            GAME_WIDTH / 2,
            GAME_HEIGHT / 2,
            560,
            450,
            0x1f3d2b,
            0.96
        ).setStrokeStyle(4, 0xffd166).setDepth(DEPTH_PAUSE_PANEL);

        const title = this.add.text(GAME_WIDTH / 2, 232, 'PAUSED', {
            fontFamily: 'monospace',
            fontSize: '54px',
            fontStyle: 'bold',
            color: '#ffd166',
            stroke: '#102018',
            strokeThickness: 8
        }).setOrigin(0.5).setDepth(DEPTH_PAUSE_UI);

        const subtitle = this.add.text(GAME_WIDTH / 2, 282, 'Game dihentikan sementara', {
            fontFamily: 'monospace',
            fontSize: '18px',
            color: '#f2e8cc'
        }).setOrigin(0.5).setDepth(DEPTH_PAUSE_UI);

        const resumeButton = this.createMenuButton(
            GAME_WIDTH / 2,
            340,
            'RESUME',
            () => this.resumeGame()
        );

        const restartButton = this.createMenuButton(
            GAME_WIDTH / 2,
            400,
            'RESTART',
            () => this.restartGame()
        );

        const menuButton = this.createMenuButton(
            GAME_WIDTH / 2,
            460,
            'MAIN MENU',
            () => this.goToMainMenu()
        );

        const soundToggle = createSoundToggle(
            this,
            GAME_WIDTH / 2,
            535,
            DEPTH_PAUSE_UI,
            0.5,
            0.5
        );

        const hint = this.add.text(GAME_WIDTH / 2, 580, 'Esc: lanjutkan', {
            fontFamily: 'monospace',
            fontSize: '14px',
            color: '#a8d5ba'
        }).setOrigin(0.5).setDepth(DEPTH_PAUSE_UI);

        this.pauseElements.push(
            backdrop,
            panel,
            title,
            subtitle,
            resumeButton,
            restartButton,
            menuButton,
            soundToggle,
            hint
        );
    }

    private hidePauseOverlay ()
    {
        for (const element of this.pauseElements)
        {
            element.destroy();
        }

        this.pauseElements = [];
    }

    private createMenuButton (
        x: number,
        y: number,
        label: string,
        onClick: () => void,
        depth = DEPTH_PAUSE_UI,
        fontSize = '28px'
    ): Phaser.GameObjects.Text
    {
        const button = this.add.text(x, y, label, {
            fontFamily: 'monospace',
            fontSize,
            fontStyle: 'bold',
            color: '#102018',
            backgroundColor: '#ffd166',
            padding: { x: 26, y: 10 }
        }).setOrigin(0.5).setDepth(depth).setInteractive({ useHandCursor: true });

        button.on('pointerover', () => button.setBackgroundColor('#fff0a8'));
        button.on('pointerout', () => button.setBackgroundColor('#ffd166'));
        button.once('pointerdown', onClick);

        return button;
    }

    private cleanupPauseForExit ()
    {
        this.hidePauseOverlay();
        this.physics.world.resume();
        this.anims.resumeAll();
        this.tweens.resumeAll();
        this.input.keyboard!.resetKeys();
    }

    private restartGame ()
    {
        this.cleanupPauseForExit();
        gameSfx.stopAll();
        this.scene.restart();
    }

    private goToMainMenu ()
    {
        this.cleanupPauseForExit();
        gameSfx.stopAll();
        this.scene.start('MainMenu');
    }

    private spawnLandingDust ()
    {
        this.spawnDustPuff(this.player.x, this.playerBody.bottom - 2, 7, 12, 6, 12);
    }

    private spawnJumpDust ()
    {
        this.spawnDustPuff(this.player.x, this.playerBody.bottom - 2, 4, 7, 4, 9);
    }

    private spawnDustPuff (
        x: number,
        y: number,
        count: number,
        spreadX: number,
        minLift: number,
        maxLift: number
    )
    {
        for (let i = 0; i < count; i++)
        {
            const startX = x + PhaserMath.Between(-spreadX, spreadX);
            const dust = this.add.image(
                startX,
                y + PhaserMath.Between(-2, 3),
                'dust'
            );

            dust.setDepth(DEPTH_EFFECT_DUST)
                .setScale(PhaserMath.FloatBetween(0.55, 0.9))
                .setAlpha(0.8);

            this.tweens.add({
                targets: dust,
                x: startX + PhaserMath.Between(-10, 10),
                y: y - PhaserMath.Between(minLift, maxLift),
                alpha: 0,
                scaleX: 0.35,
                scaleY: 0.35,
                duration: PhaserMath.Between(220, 360),
                ease: 'Quad.easeOut',
                onComplete: () => dust.destroy()
            });
        }
    }

    private spawnCoinSparkle (x: number, y: number)
    {
        const sparkleCount = 6;

        for (let i = 0; i < sparkleCount; i++)
        {
            const angle = (Math.PI * 2 * i) / sparkleCount
                + PhaserMath.FloatBetween(-0.2, 0.2);
            const distance = PhaserMath.Between(18, 30);
            const sparkle = this.add.image(x, y, 'sparkle');

            sparkle.setDepth(DEPTH_EFFECT_SPARKLE)
                .setScale(PhaserMath.FloatBetween(0.55, 0.85));

            this.tweens.add({
                targets: sparkle,
                x: x + Math.cos(angle) * distance,
                y: y + Math.sin(angle) * distance,
                alpha: 0,
                scaleX: 0.2,
                scaleY: 0.2,
                duration: PhaserMath.Between(240, 360),
                ease: 'Quad.easeOut',
                onComplete: () => sparkle.destroy()
            });
        }

        const centerFlash = this.add.image(x, y, 'sparkle')
            .setDepth(DEPTH_EFFECT_SPARKLE)
            .setScale(0.9);

        this.tweens.add({
            targets: centerFlash,
            alpha: 0,
            scaleX: 0.2,
            scaleY: 0.2,
            duration: 180,
            ease: 'Quad.easeOut',
            onComplete: () => centerFlash.destroy()
        });
    }

    private createTerrain (x: number, y: number, width: number, height: number)
    {
        const top = y - height / 2;
        const grassHeight = Math.min(TERRAIN_GRASS_HEIGHT, height);
        const dirtHeight = height - grassHeight;

        const grass = this.add.tileSprite(x, top + grassHeight / 2, width, grassHeight, 'terrain-grass');
        grass.setDepth(DEPTH_TERRAIN - 1);
        grass.setTilePosition(Math.floor(x * 0.37), 0);

        if (dirtHeight > 0)
        {
            const dirt = this.add.tileSprite(x, top + grassHeight + dirtHeight / 2, width, dirtHeight, 'terrain-dirt');
            dirt.setDepth(DEPTH_TERRAIN - 2);
            dirt.setTilePosition(Math.floor(x * 0.53), 0);
        }

        //  Garis tipis di bawah platform memberi kesan tanah yang lebih padat.
        this.add.rectangle(x, y + height / 2 - 1, width, 2, 0x4a2d18)
            .setDepth(DEPTH_TERRAIN);
    }

    private addDecoration (x: number, y: number, frame: number, flipX = false)
    {
        this.add.image(x, y, 'forest-decor', frame)
            .setOrigin(0.5, 1)
            .setDepth(DEPTH_DECOR)
            .setFlipX(flipX);
    }

    private addHangingDecoration (x: number, y: number, frame: number, flipX = false)
    {
        this.add.image(x, y, 'forest-decor', frame)
            .setOrigin(0.5, 0)
            .setDepth(DEPTH_DECOR - 1)
            .setFlipX(flipX);
    }

    private createDecorations ()
    {
        //  Area tanah kiri.
        this.addDecoration(42, 712, 0);
        this.addDecoration(78, 712, 7, true);
        this.addDecoration(138, 712, 1);
        this.addDecoration(214, 712, 6, true);
        this.addDecoration(282, 712, 3);

        //  Area tanah tengah.
        this.addDecoration(438, 712, 4);
        this.addDecoration(505, 712, 2);
        this.addDecoration(575, 712, 7, true);
        this.addDecoration(638, 712, 5);

        //  Area tanah kanan.
        this.addDecoration(796, 712, 6);
        this.addDecoration(862, 712, 1, true);
        this.addDecoration(932, 712, 7);
        this.addDecoration(1008, 712, 0, true);

        //  Platform A.
        this.addDecoration(205, 598, 7);
        this.addDecoration(300, 598, 3);
        this.addDecoration(388, 598, 2);

        //  Platform B.
        this.addDecoration(506, 488, 6, true);
        this.addDecoration(598, 488, 7);
        this.addDecoration(694, 488, 1);

        //  Platform C.
        this.addDecoration(772, 378, 7, true);
        this.addDecoration(848, 378, 3);
        this.addDecoration(922, 378, 2);

        //  Sulur yang menggantung di bawah platform, tanpa physics.
        this.addHangingDecoration(203, 622, 9);
        this.addHangingDecoration(397, 622, 9);
        this.addHangingDecoration(502, 512, 9);
        this.addHangingDecoration(698, 512, 9, true);
        this.addHangingDecoration(772, 402, 9);
        this.addHangingDecoration(928, 402, 9, true);
    }

    private createCoinAnimations ()
    {
        if (!this.anims.exists('coin-spin'))
        {
            this.anims.create({
                key: 'coin-spin',
                frames: this.anims.generateFrameNumbers('coin', { start: 0, end: 5 }),
                frameRate: 10,
                repeat: -1
            });
        }
    }

    private createSlimeAnimations ()
    {
        if (!this.anims.exists('slime-walk'))
        {
            this.anims.create({
                key: 'slime-walk',
                frames: this.anims.generateFrameNumbers('slime', { start: 0, end: 3 }),
                frameRate: 6,
                repeat: -1
            });
        }
    }

    private createPlayerAnimations ()
    {
        //  Animasi disimpan di AnimationManager global, jadi jangan dibuat ulang saat restart.
        if (!this.anims.exists('player-idle'))
        {
            this.anims.create({
                key: 'player-idle',
                frames: this.anims.generateFrameNumbers('player', { start: 0, end: 3 }),
                frameRate: 6,
                repeat: -1
            });
        }

        if (!this.anims.exists('player-run'))
        {
            this.anims.create({
                key: 'player-run',
                frames: this.anims.generateFrameNumbers('player', { start: 4, end: 9 }),
                frameRate: 10,
                repeat: -1
            });
        }

        if (!this.anims.exists('player-jump'))
        {
            this.anims.create({
                key: 'player-jump',
                frames: this.anims.generateFrameNumbers('player', { start: 10, end: 11 }),
                frameRate: 8,
                repeat: 0
            });
        }
    }

    private createSlime (platforms: Phaser.GameObjects.Rectangle[])
    {
        this.slime = this.physics.add.sprite(SLIME_START_X, SLIME_START_Y, 'slime');
        this.slimeBody = this.slime.body as Phaser.Physics.Arcade.Body;
        this.slimeBody.setSize(SLIME_BODY_WIDTH, SLIME_BODY_HEIGHT, false);
        this.slimeBody.setOffset(SLIME_BODY_OFFSET_X, SLIME_BODY_OFFSET_Y);
        this.slimeBody.setVelocityX(SLIME_SPEED);
        this.slime.setDepth(DEPTH_ENEMY);
        this.slime.anims.play('slime-walk');

        //  Collider hanya dengan platform; slime tidak memakai jalur fisika player.
        this.physics.add.collider(this.slime, platforms);
        this.physics.add.overlap(this.player, this.slime, this.handleEnemyCollision, undefined, this);
    }

    private updateSlime ()
    {
        if (!this.slime.active)
        {
            return;
        }

        //  Balik arah sebelum menyentuh tepi area patroli.
        if (this.slime.x <= SLIME_PATROL_LEFT)
        {
            this.slimeDirection = 1;
        }
        else if (this.slime.x >= SLIME_PATROL_RIGHT)
        {
            this.slimeDirection = -1;
        }

        this.slimeBody.setVelocityX(SLIME_SPEED * this.slimeDirection);
    }

    private collectCoin: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (_player, coin) =>
    {
        if (this.gameState !== 'playing')
        {
            return;
        }

        const coinObject = coin as Phaser.Physics.Arcade.Sprite;

        //  Setelah dihancurkan, koin tidak bisa menambah skor lagi.
        if (!coinObject.active)
        {
            return;
        }

        const coinX = coinObject.x;
        const coinY = coinObject.y;

        coinObject.destroy();
        this.spawnCoinSparkle(coinX, coinY);
        gameSfx.playCoin();

        this.score += 1;
        this.scoreText.setText(`Skor: ${this.score}`);
    };

    private handleEnemyCollision: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (_player, enemy) =>
    {
        if (this.gameState !== 'playing')
        {
            return;
        }

        const slime = enemy as Phaser.Physics.Arcade.Sprite;

        if (!slime.active)
        {
            return;
        }

        const slimeBody = slime.body as Phaser.Physics.Arcade.Body;

        //  Hanya kontak saat player jatuh dari atas yang dianggap stomp.
        //  Toleransi 16 px mencegah stomp gagal pada frame dengan penetrasi kecil.
        const stompedFromAbove = this.playerBody.velocity.y > 0
            && this.playerBody.center.y < slimeBody.center.y
            && this.playerBody.bottom <= slimeBody.top + 16;

        if (stompedFromAbove)
        {
            slime.destroy();
            this.playerBody.setVelocityY(-STOMP_BOUNCE);
            gameSfx.playEnemyDefeat();
            return;
        }

        //  Cooldown singkat mencegah satu kontak mengurangi nyawa berkali-kali.
        if (this.time.now < this.invulnerableUntil)
        {
            return;
        }

        this.takeEnemyDamage();
    };

    private takeEnemyDamage ()
    {
        this.invulnerableUntil = this.time.now + ENEMY_INVULNERABILITY_MS;
        gameSfx.playDamage();

        //  Kedip singkat sebagai umpan balik bahwa player sedang kebal.
        this.tweens.add({
            targets: this.player,
            alpha: 0.35,
            duration: 90,
            yoyo: true,
            repeat: 4,
            onComplete: () => {
                if (this.player.active)
                {
                    this.player.setAlpha(1);
                }
            }
        });

        this.loseLife();
    }

    private respawnPlayer ()
    {
        //  reset() mengembalikan posisi dan menghentikan velocity/acceleration.
        this.playerBody.reset(START_X, START_Y);
        this.playerBody.setVelocity(0, 0);
        this.playerBody.setAcceleration(0, 0);

        this.player.setFlipX(false);
        this.player.anims.play('player-idle', true);
        this.wasOnGround = true;
        this.landingDustSuppressedUntil = this.time.now + 250;
    }

    private reachFinish: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = () =>
    {
        if (this.gameState !== 'playing')
        {
            return;
        }

        this.gameState = 'win';
        this.stopPlayer();
        gameSfx.playWin();
        this.showEndScreen('YOU WIN!', '#1f6b3a', 'PLAY AGAIN');
    };

    private loseLife ()
    {
        if (this.gameState !== 'playing')
        {
            return;
        }

        this.lives -= 1;
        this.livesText.setText(`Nyawa: ${this.lives}`);

        //  Langsung kembali ke titik awal, sehingga satu kali jatuh hanya
        //  mengurangi satu nyawa dan tidak memicu pengecekan berkali-kali.
        this.respawnPlayer();

        if (this.lives <= 0)
        {
            this.endGame();
        }
    }

    private stopPlayer ()
    {
        //  Bekukan karakter agar gravitasi dan sisa velocity tidak menggerakkannya lagi.
        this.playerBody.setVelocity(0, 0);
        this.playerBody.setAcceleration(0, 0);
        this.playerBody.setAllowGravity(false);

        this.player.anims.play('player-idle', true);

        if (this.slime?.active)
        {
            this.slimeBody.setVelocityX(0);
        }
    }

    private endGame ()
    {
        this.gameState = 'gameover';
        this.stopPlayer();
        this.time.delayedCall(120, () => gameSfx.playGameOver());
        this.showEndScreen('GAME OVER', '#7a1f1f', 'RESTART');
    }

    private showEndScreen (title: string, titleColor: string, buttonLabel: string)
    {
        this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x102018, 0.72)
            .setDepth(90);

        this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 700, 430, 0x102018, 0.55)
            .setStrokeStyle(4, 0xffd166)
            .setDepth(91);

        this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 70, title, {
            fontFamily: 'monospace',
            fontSize: '72px',
            fontStyle: 'bold',
            color: titleColor,
            stroke: '#ffffff',
            strokeThickness: 8
        }).setOrigin(0.5).setDepth(100);

        this.createMenuButton(
            GAME_WIDTH / 2 - 125,
            GAME_HEIGHT / 2 + 80,
            buttonLabel,
            () => this.restartGame(),
            101,
            '26px'
        );

        this.createMenuButton(
            GAME_WIDTH / 2 + 135,
            GAME_HEIGHT / 2 + 80,
            'MAIN MENU',
            () => this.goToMainMenu(),
            101,
            '26px'
        );
    }

    update ()
    {
        //  Saat pause, update hanya menunggu Esc; input gameplay tidak diproses.
        if (this.gameState === 'paused')
        {
            if (Input.Keyboard.JustDown(this.keyEsc))
            {
                this.resumeGame();
            }

            return;
        }

        //  Saat Game Over atau You Win, update berhenti di sini sehingga input tidak diproses.
        if (this.gameState !== 'playing')
        {
            return;
        }

        if (Input.Keyboard.JustDown(this.keyEsc))
        {
            this.pauseGame();
            return;
        }

        if (this.playerBody.y > GAME_HEIGHT)
        {
            this.loseLife();
            return;
        }

        this.updateSlime();

        const onGround = this.playerBody.blocked.down;

        //  Debu hanya saat transisi dari udara ke darat, bukan setiap frame.
        if (onGround && !this.wasOnGround && this.time.now >= this.landingDustSuppressedUntil)
        {
            this.spawnLandingDust();
        }

        const movingLeft = this.cursors.left.isDown || this.keyA.isDown;
        const movingRight = this.cursors.right.isDown || this.keyD.isDown;

        if (movingLeft === movingRight)
        {
            //  Tidak ada tombol yang ditekan, atau keduanya ditekan bersamaan.
            this.playerBody.setVelocityX(0);
        }
        else if (movingLeft)
        {
            this.playerBody.setVelocityX(-MOVE_SPEED);
            this.player.setFlipX(true);
        }
        else
        {
            this.playerBody.setVelocityX(MOVE_SPEED);
            this.player.setFlipX(false);
        }

        //  JustDown memastikan satu tekanan Space hanya menghasilkan satu lompatan.
        //  blocked.down berarti karakter sedang menapak di tanah atau platform.
        const jumped = Input.Keyboard.JustDown(this.cursors.space) && onGround;

        if (jumped)
        {
            this.playerBody.setVelocityY(-JUMP_SPEED);
            this.spawnJumpDust();
            gameSfx.playJump();
        }

        //  Simpan status darat untuk mendeteksi pendaratan pada frame berikutnya.
        this.wasOnGround = jumped ? false : this.playerBody.blocked.down;

        //  Pilih animasi berdasarkan kondisi fisika karakter.
        const inAir = !this.playerBody.blocked.down || this.playerBody.velocity.y < 0;

        if (inAir)
        {
            this.player.anims.play('player-jump', true);
        }
        else if (this.playerBody.velocity.x !== 0)
        {
            this.player.anims.play('player-run', true);
        }
        else
        {
            this.player.anims.play('player-idle', true);
        }
    }
}
