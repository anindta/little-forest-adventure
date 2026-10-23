import { Input, Math as PhaserMath, Scene } from 'phaser';
import { gameSfx } from '../audio/ProceduralSfx';
import { LEVELS, LevelDefinition, LevelFinish, LevelPlatform } from '../levels/LevelData';
import {
    LevelMissions,
    countStars,
    createEmptyMissions,
    formatStars
} from '../progress/StarRating';
import { progressStore } from '../progress/ProgressStore';
import { createSoundIcon, createSoundToggle, SoundIconHandle } from '../ui/SoundToggle';
import { MobileControls, shouldShowVirtualControls } from '../ui/MobileControls';

const GAME_WIDTH = 1024;
const GAME_HEIGHT = 768;
const MOVE_SPEED = 240;
const JUMP_SPEED = 560;
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
const STOMP_BOUNCE = 360;
const ENEMY_INVULNERABILITY_MS = 900;
const RESPAWN_INVULNERABILITY_MS = 1600;
const RESPAWN_PIT_GRACE_MS = 500;
const LIFE_LOSS_LOCK_MS = 150;
const PLAYER_SAFE_MARGIN = 12;
const CHECKPOINT_ZONE_WIDTH = 48;
const CHECKPOINT_ZONE_HEIGHT = 72;

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

type GameState = 'playing' | 'paused' | 'levelcomplete' | 'victory' | 'gameover';

type LifeLossReason = 'pit' | 'enemy';

interface GameInitData
{
    levelIndex?: number;
    score?: number;
    lives?: number;
}

interface SafeStand
{
    x: number;
    y: number;
}

export class Game extends Scene
{
    private player: Phaser.Physics.Arcade.Sprite;
    private playerBody: Phaser.Physics.Arcade.Body;
    private platforms: Phaser.GameObjects.Rectangle[] = [];
    private slimes: Phaser.Physics.Arcade.Sprite[] = [];
    private invulnerableUntil = 0;
    private wasOnGround = true;
    private landingDustSuppressedUntil = 0;
    private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
    private keyA: Phaser.Input.Keyboard.Key;
    private keyD: Phaser.Input.Keyboard.Key;
    private keyEsc: Phaser.Input.Keyboard.Key;
    private coins: Phaser.Physics.Arcade.StaticGroup;
    private coinText: Phaser.GameObjects.Text;
    private livesIcons: Phaser.GameObjects.Image[] = [];
    private soundIcon: SoundIconHandle | null = null;
    private mobileControls: MobileControls | null = null;
    private pitCheckSuppressedUntil = 0;
    private lifeLossLockedUntil = 0;
    private pauseElements: Phaser.GameObjects.GameObject[] = [];
    private checkpointFlags: Phaser.GameObjects.Rectangle[] = [];
    private checkpointGlows: Phaser.GameObjects.Arc[] = [];
    private checkpointLabels: Phaser.GameObjects.Text[] = [];
    private activeCheckpointIndex: number | null = null;
    private deathsThisAttempt = 0;
    private enemiesDefeated = 0;
    private resultMissions: LevelMissions = createEmptyMissions();
    private finishHandled = false;
    private levelIndex = 0;
    private levelStartScore = 0;
    private currentLevel: LevelDefinition = LEVELS[0];
    private score = 0;
    private lives = MAX_LIVES;
    private coinsCollected = 0;
    private resultStars = 0;
    private bestStarsForLevel = 0;
    private newBest = false;
    private gameState: GameState = 'playing';

    constructor ()
    {
        super('Game');
    }

    init (data: GameInitData = {})
    {
        //  Semua restart melewati init, sehingga level dan progres dapat
        //  dipindahkan tanpa menyisakan state dari level sebelumnya.
        const requestedLevel = data.levelIndex ?? 0;

        this.levelIndex = PhaserMath.Clamp(
            Math.floor(requestedLevel),
            0,
            LEVELS.length - 1
        );
        this.currentLevel = LEVELS[this.levelIndex];
        this.score = Math.max(0, Math.floor(data.score ?? 0));

        const requestedLives = typeof data.lives === 'number' && Number.isFinite(data.lives)
            ? Math.floor(data.lives)
            : MAX_LIVES;

        this.lives = PhaserMath.Clamp(requestedLives, 1, MAX_LIVES);
        this.levelStartScore = this.score;
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

        if (!this.textures.exists('chicken-leg'))
        {
            this.load.spritesheet('chicken-leg', 'assets/chicken-leg.png', {
                frameWidth: 24,
                frameHeight: 24
            });
        }
    }

    create ()
    {
        //  Scene restart memakai instance yang sama, jadi semua state transient
        //  harus direset. levelIndex, score, dan lives berasal dari init().
        const level = this.currentLevel;

        this.gameState = 'playing';
        this.platforms = [];
        this.slimes = [];
        this.livesIcons = [];
        this.checkpointFlags = [];
        this.checkpointGlows = [];
        this.checkpointLabels = [];
        this.activeCheckpointIndex = null;
        this.deathsThisAttempt = 0;
        this.enemiesDefeated = 0;
        this.resultMissions = createEmptyMissions();
        this.finishHandled = false;
        this.invulnerableUntil = 0;
        this.wasOnGround = true;
        this.landingDustSuppressedUntil = 0;
        this.pitCheckSuppressedUntil = 0;
        this.lifeLossLockedUntil = 0;
        this.soundIcon = null;
        this.mobileControls = null;
        this.pauseElements = [];
        this.coinsCollected = 0;
        this.resultStars = 0;
        this.bestStarsForLevel = progressStore.getBestStars(this.levelIndex);
        this.newBest = false;

        //  Pastikan state global tidak tertinggal jika scene di-restart dari pause.
        this.physics.world.resume();
        this.anims.resumeAll();
        this.tweens.resumeAll();

        this.cameras.main.setBackgroundColor('#a8d5ba');

        this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'forest-bg')
            .setDepth(DEPTH_BACKGROUND)
            .setScrollFactor(0);

        //  Dunia mengikuti lebar data level, bukan lebar viewport. Camera juga
        //  dibatasi ke area yang sama agar tidak memperlihatkan ruang kosong.
        this.physics.world.setBounds(0, 0, level.width, GAME_HEIGHT, true, true, true, false);
        this.cameras.main.setBounds(0, 0, level.width, GAME_HEIGHT);

        //  Rectangle tetap menjadi static body, lalu visual tanah digambar terpisah.
        const platformDefinitions = level.platforms;

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
        this.platforms = platforms;

        platformDefinitions.forEach((platform) => {
            this.createTerrain(platform.x, platform.y, platform.width, platform.height);
        });

        //  Zona finis sekarang tidak terlihat; pemain masuk melalui mulut gua
        //  yang digambar secara prosedural dari data finish.
        const finish = level.finish;
        const finishLine = this.add.rectangle(
            finish.x,
            finish.y,
            Math.max(48, finish.width),
            finish.height,
            0x000000,
            0
        );
        finishLine.setVisible(false);
        this.physics.add.existing(finishLine, true);
        this.createCave(finish);
        this.createStartArea();

        //  Karakter pixel art memakai dynamic body yang sama dengan placeholder lama.
        this.player = this.physics.add.sprite(level.spawn.x, level.spawn.y, 'player');
        this.playerBody = this.player.body as Phaser.Physics.Arcade.Body;
        this.playerBody.setSize(PLAYER_BODY_WIDTH, PLAYER_BODY_HEIGHT, false);
        this.playerBody.setOffset(PLAYER_BODY_OFFSET_X, 0);
        this.playerBody.setCollideWorldBounds(true);
        this.player.setDepth(DEPTH_PLAYER);

        //  Kamera mengikuti player secara horizontal. world height sama dengan
        //  viewport, jadi gerakan vertikal tetap terlihat tanpa scroll vertikal.
        this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

        this.createPlayerAnimations();
        this.player.anims.play('player-idle');

        this.physics.add.collider(this.player, platforms);
        this.physics.add.overlap(this.player, finishLine, this.reachFinish, undefined, this);
        this.createCheckpoints();

        //  Koin memakai static body agar diam di tempat dan tidak terkena gravitasi.
        this.coins = this.physics.add.staticGroup();
        this.createCoinAnimations();

        level.coins.forEach((position) => {

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

        this.createSlimeAnimations();
        this.createSlimes(platforms);

        this.createDecorations(platformDefinitions);

        this.cursors = this.input.keyboard!.createCursorKeys();
        this.keyA = this.input.keyboard!.addKey(Input.Keyboard.KeyCodes.A);
        this.keyD = this.input.keyboard!.addKey(Input.Keyboard.KeyCodes.D);
        this.keyEsc = this.input.keyboard!.addKey(Input.Keyboard.KeyCodes.ESC);
        this.input.keyboard!.resetKeys();

        this.setupAudio();

        this.createHud(level);
        this.setupResponsiveControls();

        if (import.meta.env.DEV)
        {
            (window as typeof window & { __game?: Game }).__game = this;
        }
    }

    private createHud (level: LevelDefinition)
    {
        const coinIcon = this.add.sprite(42, 38, 'coin', 0)
            .setDisplaySize(30, 30)
            .setDepth(DEPTH_HUD)
            .setScrollFactor(0);

        coinIcon.play('coin-spin');

        this.coinText = this.add.text(64, 23, `${this.coinsCollected}`, {
            fontFamily: 'monospace',
            fontSize: '28px',
            fontStyle: 'bold',
            color: '#1f3d2b',
            stroke: '#f2e8cc',
            strokeThickness: 4
        }).setDepth(DEPTH_HUD).setScrollFactor(0);

        this.createLivesHud();

        this.add.text(
            GAME_WIDTH / 2,
            16,
            `Level ${this.levelIndex + 1}/${LEVELS.length} — ${level.name}`,
            {
                fontFamily: 'monospace',
                fontSize: '20px',
                fontStyle: 'bold',
                color: '#1f3d2b',
                backgroundColor: '#f2e8cc',
                padding: { x: 12, y: 4 }
            }
        ).setOrigin(0.5, 0).setDepth(DEPTH_HUD).setScrollFactor(0);

        //  Ikon speaker menggantikan tombol teks SFX dan tetap memakai
        //  state audio global yang sama dengan menu lain.
        this.soundIcon = createSoundIcon(this, GAME_WIDTH - 52, 42, DEPTH_HUD + 1);
    }

    private setupResponsiveControls ()
    {
        this.syncMobileControls();

        this.scale.on('resize', this.handleScaleResize, this);
        this.events.once('shutdown', () => {
            this.scale.off('resize', this.handleScaleResize, this);
            this.mobileControls?.resetInput();
            this.mobileControls = null;
        });
    }

    private handleScaleResize = () =>
    {
        this.syncMobileControls();
    };

    private syncMobileControls ()
    {
        if (shouldShowVirtualControls(this))
        {
            if (!this.mobileControls)
            {
                this.mobileControls = new MobileControls(this, DEPTH_HUD);
            }

            return;
        }

        if (this.mobileControls)
        {
            this.mobileControls.destroy();
            this.mobileControls = null;
        }
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
        this.mobileControls?.resetInput();
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
        this.mobileControls?.resetInput();
        this.soundIcon?.refresh();
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
        ).setDepth(DEPTH_PAUSE_BACKDROP).setScrollFactor(0).setInteractive();

        const panel = this.add.rectangle(
            GAME_WIDTH / 2,
            GAME_HEIGHT / 2,
            560,
            450,
            0x1f3d2b,
            0.96
        ).setStrokeStyle(4, 0xffd166).setDepth(DEPTH_PAUSE_PANEL).setScrollFactor(0);

        const title = this.add.text(GAME_WIDTH / 2, 232, 'PAUSED', {
            fontFamily: 'monospace',
            fontSize: '54px',
            fontStyle: 'bold',
            color: '#ffd166',
            stroke: '#102018',
            strokeThickness: 8
        }).setOrigin(0.5).setDepth(DEPTH_PAUSE_UI).setScrollFactor(0);

        const subtitle = this.add.text(GAME_WIDTH / 2, 282, 'Game dihentikan sementara', {
            fontFamily: 'monospace',
            fontSize: '18px',
            color: '#f2e8cc'
        }).setOrigin(0.5).setDepth(DEPTH_PAUSE_UI).setScrollFactor(0);

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
        }).setOrigin(0.5).setDepth(DEPTH_PAUSE_UI).setScrollFactor(0);

        soundToggle.setScrollFactor(0);

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
        }).setOrigin(0.5).setDepth(depth).setScrollFactor(0).setInteractive({ useHandCursor: true });

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

        //  Restart mengulang level aktif. Skor kembali ke awal level agar coin
        //  yang sudah diambil tidak bisa di-farm dengan restart berulang.
        this.scene.restart({
            levelIndex: this.levelIndex,
            score: this.levelStartScore,
            lives: MAX_LIVES
        });
    }

    private nextLevel ()
    {
        if (this.gameState !== 'levelcomplete')
        {
            return;
        }

        const nextIndex = this.levelIndex + 1;

        if (nextIndex >= LEVELS.length)
        {
            this.gameState = 'victory';
            this.showFinalVictory();
            return;
        }

        //  completeLevel() sudah membuka level berikutnya. Guard ini menjaga
        //  agar tombol Continue tidak bisa melewati progres yang belum terbuka.
        if (!progressStore.isUnlocked(nextIndex))
        {
            this.goToWorldMap();
            return;
        }

        this.cleanupPauseForExit();
        gameSfx.stopAll();
        this.scene.restart({
            levelIndex: nextIndex,
            score: this.score,
            lives: MAX_LIVES
        });
    }

    private startNewRun ()
    {
        this.cleanupPauseForExit();
        gameSfx.stopAll();
        this.scene.restart({
            levelIndex: 0,
            score: 0,
            lives: MAX_LIVES
        });
    }

    private goToMainMenu ()
    {
        this.cleanupPauseForExit();
        gameSfx.stopAll();
        this.scene.start('MainMenu');
    }

    private goToWorldMap ()
    {
        this.cleanupPauseForExit();
        gameSfx.stopAll();
        this.scene.start('WorldMap');
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

    private createDecorations (platforms: LevelPlatform[])
    {
        const groundFrames = [0, 7, 1, 6, 3, 4, 2, 5];
        const platformFrames = [7, 3, 2, 6, 1];

        platforms.forEach((platform, platformIndex) => {
            const top = platform.y - platform.height / 2;
            const left = platform.x - platform.width / 2;
            const right = platform.x + platform.width / 2;

            if (platform.height > 32)
            {
                const count = platform.width >= 260 ? 4 : 3;

                for (let i = 0; i < count; i++)
                {
                    const x = left + 30 + ((platform.width - 60) * i) / Math.max(1, count - 1);
                    const frame = groundFrames[(platformIndex + i) % groundFrames.length];

                    this.addDecoration(Math.round(x), top, frame, i % 2 === 1);
                }

                return;
            }

            //  Platform kecil mendapat dua tanaman di atas dan sulur di bawah.
            this.addDecoration(
                Math.round(left + platform.width * 0.28),
                top,
                platformFrames[platformIndex % platformFrames.length]
            );
            this.addDecoration(
                Math.round(right - platform.width * 0.28),
                top,
                platformFrames[(platformIndex + 2) % platformFrames.length],
                true
            );

            this.addHangingDecoration(Math.round(left + 8), top + 24, 9);
            this.addHangingDecoration(Math.round(right - 8), top + 24, 9, true);
        });
    }

    private createStartArea ()
    {
        const spawn = this.currentLevel.spawn;
        const platform = this.findSupportingPlatform(spawn.x, spawn.y);
        const top = platform
            ? platform.y - platform.height / 2
            : spawn.y + PLAYER_BODY_HEIGHT / 2;

        //  Semak dan papan sederhana menandai titik awal tanpa aset eksternal.
        this.add.image(spawn.x - 52, top, 'forest-decor', 0)
            .setOrigin(0.5, 1)
            .setScale(1.15)
            .setDepth(DEPTH_DECOR + 1);
        this.add.image(spawn.x + 52, top, 'forest-decor', 6)
            .setOrigin(0.5, 1)
            .setScale(1.2)
            .setFlipX(true)
            .setDepth(DEPTH_DECOR + 1);

        this.add.rectangle(spawn.x, top, 4, 44, 0x4a2d18)
            .setOrigin(0.5, 1)
            .setDepth(DEPTH_DECOR + 2);
        this.add.rectangle(spawn.x, top - 58, 76, 26, 0x8a5a2b)
            .setStrokeStyle(2, 0x3a1d0e)
            .setDepth(DEPTH_DECOR + 2);
        this.add.text(spawn.x, top - 58, 'START', {
            fontFamily: 'monospace',
            fontSize: '14px',
            fontStyle: 'bold',
            color: '#f6d08a'
        }).setOrigin(0.5).setDepth(DEPTH_DECOR + 3);
    }

    private createCheckpoints ()
    {
        this.currentLevel.checkpoints.forEach((checkpoint, index) => {
            const platform = this.findSupportingPlatform(checkpoint.x, checkpoint.y);
            const top = platform
                ? platform.y - platform.height / 2
                : checkpoint.y + PLAYER_BODY_HEIGHT / 2;

            const pole = this.add.rectangle(checkpoint.x, top, 4, 38, 0x4a2d18)
                .setOrigin(0.5, 1)
                .setDepth(DEPTH_DECOR + 1);
            pole.setData('checkpointIndex', index);

            const flag = this.add.rectangle(
                checkpoint.x + 10,
                top - 34,
                24,
                14,
                0x8a9a90
            ).setOrigin(0, 0.5).setDepth(DEPTH_DECOR + 2);

            const glow = this.add.circle(
                checkpoint.x,
                top - 28,
                15,
                0xffd166,
                0
            ).setDepth(DEPTH_DECOR);

            const label = this.add.text(checkpoint.x, top - 58, 'CHECKPOINT', {
                fontFamily: 'monospace',
                fontSize: '11px',
                fontStyle: 'bold',
                color: '#a8d5ba'
            }).setOrigin(0.5).setDepth(DEPTH_DECOR + 2);

            this.checkpointFlags.push(flag);
            this.checkpointGlows.push(glow);
            this.checkpointLabels.push(label);

            const zone = this.add.rectangle(
                checkpoint.x,
                checkpoint.y,
                CHECKPOINT_ZONE_WIDTH,
                CHECKPOINT_ZONE_HEIGHT,
                0x000000,
                0
            );
            zone.setVisible(false);
            this.physics.add.existing(zone, true);
            this.physics.add.overlap(
                this.player,
                zone,
                () => this.activateCheckpoint(index),
                undefined,
                this
            );
        });
    }

    private activateCheckpoint (index: number)
    {
        if (this.gameState !== 'playing' || this.finishHandled)
        {
            return;
        }

        if (this.activeCheckpointIndex === index)
        {
            return;
        }

        this.activeCheckpointIndex = index;
        this.updateCheckpointVisuals();
        gameSfx.playCoin();

        const notice = this.add.text(
            GAME_WIDTH / 2,
            128,
            'CHECKPOINT AKTIF',
            {
                fontFamily: 'monospace',
                fontSize: '22px',
                fontStyle: 'bold',
                color: '#ffd166',
                stroke: '#102018',
                strokeThickness: 5
            }
        ).setOrigin(0.5).setDepth(DEPTH_HUD + 1).setScrollFactor(0);

        this.tweens.add({
            targets: notice,
            y: 108,
            alpha: 0,
            duration: 950,
            ease: 'Quad.easeOut',
            onComplete: () => notice.destroy()
        });
    }

    private updateCheckpointVisuals ()
    {
        this.checkpointFlags.forEach((flag, index) => {
            const active = index === this.activeCheckpointIndex;

            flag.setFillStyle(active ? 0xffd166 : 0x8a9a90);
            this.checkpointGlows[index]?.setAlpha(active ? 0.25 : 0);
            this.checkpointLabels[index]
                ?.setText(active ? 'CHECKPOINT OK' : 'CHECKPOINT')
                .setColor(active ? '#ffd166' : '#a8d5ba');
        });
    }

    private createCave (finish: LevelFinish)
    {
        const base = finish.y + finish.height / 2;
        const centerX = finish.x;
        const rock = this.add.graphics().setDepth(DEPTH_FINISH - 2);

        //  Gundukan batu dengan mulut gua gelap; pemain masuk dari kiri.
        rock.fillStyle(0x263a30, 1);
        rock.fillRect(centerX - 84, base - 136, 168, 136);
        rock.fillStyle(0x395548, 1);
        rock.fillRect(centerX - 72, base - 154, 144, 154);
        rock.fillRect(centerX - 92, base - 70, 24, 70);
        rock.fillRect(centerX + 68, base - 82, 28, 82);

        rock.fillStyle(0x070d0a, 1);
        rock.fillRect(centerX - 42, base - 102, 84, 102);
        rock.fillCircle(centerX, base - 102, 42);

        rock.fillStyle(0x58705f, 1);
        rock.fillRect(centerX - 58, base - 118, 16, 118);
        rock.fillRect(centerX + 42, base - 126, 18, 126);
        rock.fillRect(centerX - 42, base - 148, 84, 16);
        rock.fillStyle(0x6f8a6c, 1);
        rock.fillRect(centerX - 70, base - 118, 14, 10);
        rock.fillRect(centerX + 30, base - 76, 18, 8);

        this.add.text(centerX, base - 178, 'CAVE', {
            fontFamily: 'monospace',
            fontSize: '18px',
            fontStyle: 'bold',
            color: '#f2e8cc',
            stroke: '#102018',
            strokeThickness: 5
        }).setOrigin(0.5).setDepth(DEPTH_FINISH + 1);
    }

    private createLivesHud ()
    {
        this.livesIcons = [];

        for (let index = 0; index < MAX_LIVES; index++)
        {
            const icon = this.add.image(42 + index * 31, 80, 'chicken-leg', 0)
                .setDisplaySize(28, 28)
                .setDepth(DEPTH_HUD)
                .setScrollFactor(0);

            this.livesIcons.push(icon);
        }

        this.updateLivesHud();
    }

    private updateLivesHud ()
    {
        this.livesIcons.forEach((icon, index) => {
            icon.setFrame(index < this.lives ? 0 : 1);
        });
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

    private createSlimes (platforms: Phaser.GameObjects.Rectangle[])
    {
        this.currentLevel.enemies.forEach((enemy) => {
            const slime = this.physics.add.sprite(enemy.x, enemy.y, 'slime');
            const slimeBody = slime.body as Phaser.Physics.Arcade.Body;
            const speed = enemy.speed ?? SLIME_SPEED;
            const direction = enemy.direction ?? 1;

            slimeBody.setSize(SLIME_BODY_WIDTH, SLIME_BODY_HEIGHT, false);
            slimeBody.setOffset(SLIME_BODY_OFFSET_X, SLIME_BODY_OFFSET_Y);
            slimeBody.setVelocityX(speed * direction);
            slime.setDepth(DEPTH_ENEMY);
            slime.anims.play('slime-walk');

            //  Data patroli disimpan per-slime agar level bisa punya beberapa musuh.
            slime.setData('patrolLeft', enemy.patrolLeft);
            slime.setData('patrolRight', enemy.patrolRight);
            slime.setData('speed', speed);
            slime.setData('direction', direction);

            this.physics.add.collider(slime, platforms);
            this.physics.add.overlap(this.player, slime, this.handleEnemyCollision, undefined, this);
            this.slimes.push(slime);
        });
    }

    private updateSlimes ()
    {
        this.slimes.forEach((slime) => {
            if (!slime.active)
            {
                return;
            }

            const slimeBody = slime.body as Phaser.Physics.Arcade.Body;
            let direction = slime.getData('direction') as number;

            //  Balik arah sebelum menyentuh tepi area patroli.
            if (slime.x <= (slime.getData('patrolLeft') as number))
            {
                direction = 1;
            }
            else if (slime.x >= (slime.getData('patrolRight') as number))
            {
                direction = -1;
            }

            slime.setData('direction', direction);
            slimeBody.setVelocityX((slime.getData('speed') as number) * direction);
        });
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
        this.coinsCollected += 1;
        this.coinText.setText(`${this.coinsCollected}`);
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
            this.enemiesDefeated = Math.min(
                this.currentLevel.enemies.length,
                this.enemiesDefeated + 1
            );
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

        this.loseLife('enemy');
    }

    private findSupportingPlatform (
        x: number,
        playerCenterY: number
    ): Phaser.GameObjects.Rectangle | null
    {
        const targetBottom = playerCenterY + PLAYER_BODY_HEIGHT / 2;

        for (const platform of this.platforms)
        {
            const left = platform.x - platform.width / 2;
            const right = platform.x + platform.width / 2;
            const top = platform.y - platform.height / 2;

            if (
                x >= left
                && x <= right
                && Math.abs(targetBottom - top) <= 4
            )
            {
                return platform;
            }
        }

        return null;
    }

    private createSafeStand (
        platform: Phaser.GameObjects.Rectangle,
        preferredX: number
    ): SafeStand
    {
        const left = platform.x - platform.width / 2;
        const right = platform.x + platform.width / 2;
        const top = platform.y - platform.height / 2;
        const inset = PLAYER_BODY_WIDTH / 2 + PLAYER_SAFE_MARGIN;
        const minX = left + inset;
        const maxX = right - inset;
        const safeX = minX <= maxX
            ? PhaserMath.Clamp(preferredX, minX, maxX)
            : platform.x;

        return {
            x: safeX,
            //  Satu piksel di atas permukaan platform agar body tidak tertanam.
            y: top - PLAYER_BODY_HEIGHT / 2 - 1
        };
    }

    private getCheckpointRespawnPoint (): SafeStand
    {
        if (this.activeCheckpointIndex !== null)
        {
            const checkpoint = this.currentLevel.checkpoints[this.activeCheckpointIndex];

            if (checkpoint)
            {
                const platform = this.findSupportingPlatform(checkpoint.x, checkpoint.y);

                if (platform)
                {
                    return this.createSafeStand(platform, checkpoint.x);
                }
            }
        }

        const spawn = this.currentLevel.spawn;
        const spawnPlatform = this.findSupportingPlatform(spawn.x, spawn.y);

        if (spawnPlatform)
        {
            //  Spawn awal berada di dekat semak-semak pada platform kiri.
            return this.createSafeStand(spawnPlatform, spawn.x);
        }

        return {
            x: spawn.x,
            y: spawn.y
        };
    }

    private getPitRespawnPoint (): SafeStand
    {
        //  Jatuh ke pit selalu kembali ke checkpoint aktif. Spawn awal hanya
        //  dipakai jika checkpoint belum pernah diaktifkan.
        return this.getCheckpointRespawnPoint();
    }

    private respawnPlayer (reason: LifeLossReason)
    {
        const stand = reason === 'enemy'
            ? this.getCheckpointRespawnPoint()
            : this.getPitRespawnPoint();

        //  reset() mengembalikan posisi dan menghentikan velocity/acceleration.
        this.playerBody.reset(stand.x, stand.y);
        this.playerBody.setVelocity(0, 0);
        this.playerBody.setAcceleration(0, 0);
        this.playerBody.setAllowGravity(true);

        this.player.setFlipX(false);
        this.player.setAlpha(1);
        this.player.anims.play('player-idle', true);
        this.wasOnGround = true;
        this.landingDustSuppressedUntil = this.time.now + 250;
        //  Lindungi frame respawn dari pemeriksaan pit sebelum fisika stabil.
        this.pitCheckSuppressedUntil = this.time.now + RESPAWN_PIT_GRACE_MS;

        //  Setelah respawn jauh ke belakang, kamera langsung ikut agar
        //  pemain tidak muncul di luar layar.
        this.cameras.main.centerOn(stand.x, stand.y);
    }

    private reachFinish: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = () =>
    {
        if (this.gameState !== 'playing' || this.finishHandled)
        {
            return;
        }

        //  Tandai lebih dulu supaya overlap pada frame yang sama tidak
        //  menyimpan hasil dan membuka level dua kali.
        this.finishHandled = true;

        const missions = this.evaluateMissions();

        this.stopPlayer();
        this.physics.world.pause();
        this.anims.pauseAll();
        this.tweens.pauseAll();
        this.input.keyboard!.resetKeys();
        gameSfx.playWin();

        const completion = progressStore.completeLevel(
            this.levelIndex,
            missions,
            this.coinsCollected
        );

        this.resultMissions = missions;
        this.resultStars = countStars(missions);
        this.bestStarsForLevel = completion.bestStars;
        this.newBest = completion.newBest;

        if (this.levelIndex >= LEVELS.length - 1)
        {
            this.gameState = 'victory';
            this.showFinalVictory();
        }
        else
        {
            this.gameState = 'levelcomplete';
            this.showLevelComplete();
        }
    };

    private evaluateMissions (): LevelMissions
    {
        const totalCoins = this.currentLevel.coins.length;
        const totalEnemies = this.currentLevel.enemies.length;

        return {
            allCoins: this.coinsCollected >= totalCoins,
            noDeath: this.deathsThisAttempt === 0,
            //  Level tanpa musuh otomatis memenuhi misi All Enemies.
            allEnemies: this.enemiesDefeated >= totalEnemies
        };
    }

    private loseLife (reason: LifeLossReason)
    {
        if (
            this.gameState !== 'playing'
            || this.finishHandled
            || this.time.now < this.lifeLossLockedUntil
        )
        {
            return;
        }

        this.lifeLossLockedUntil = this.time.now + LIFE_LOSS_LOCK_MS;
        this.lives = Math.max(0, this.lives - 1);
        this.deathsThisAttempt += 1;
        this.updateLivesHud();

        if (this.lives <= 0)
        {
            this.endGame();
            return;
        }

        this.respawnPlayer(reason);
        this.invulnerableUntil = Math.max(
            this.invulnerableUntil,
            this.time.now + RESPAWN_INVULNERABILITY_MS
        );
    }

    private stopPlayer ()
    {
        //  Bekukan karakter agar gravitasi dan sisa velocity tidak menggerakkannya lagi.
        this.playerBody.setVelocity(0, 0);
        this.playerBody.setAcceleration(0, 0);
        this.playerBody.setAllowGravity(false);

        this.player.anims.play('player-idle', true);
        this.mobileControls?.resetInput();

        this.slimes.forEach((slime) => {
            if (slime.active)
            {
                const slimeBody = slime.body as Phaser.Physics.Arcade.Body;
                slimeBody.setVelocityX(0);
            }
        });
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
        this.createResultPanel(
            title,
            titleColor,
            '#ffffff',
            `Level ${this.levelIndex + 1}/${LEVELS.length} — ${this.currentLevel.name}`,
            `Skor: ${this.score}`
        );

        this.createMenuButton(
            GAME_WIDTH / 2 - 125,
            470,
            buttonLabel,
            () => this.restartGame(),
            101,
            '24px'
        );

        this.createMenuButton(
            GAME_WIDTH / 2 + 135,
            470,
            'MAIN MENU',
            () => this.goToMainMenu(),
            101,
            '24px'
        );
    }

    private showLevelComplete ()
    {
        const nextLevel = LEVELS[this.levelIndex + 1];

        if (!nextLevel)
        {
            this.gameState = 'victory';
            this.showFinalVictory();
            return;
        }

        this.createResultPanel(
            'LEVEL COMPLETE',
            '#ffd166',
            '#102018',
            `Level ${this.levelIndex + 1}/${LEVELS.length} — ${this.currentLevel.name}`,
            `Skor: ${this.score}`
        );

        this.addLevelResultDetails();

        this.add.text(GAME_WIDTH / 2, 500, `Berikutnya: ${nextLevel.name}`, {
            fontFamily: 'monospace',
            fontSize: '18px',
            color: '#f2e8cc'
        }).setOrigin(0.5).setDepth(100).setScrollFactor(0);

        this.createMenuButton(
            GAME_WIDTH / 2 - 125,
            556,
            'NEXT LEVEL',
            () => this.nextLevel(),
            101,
            '24px'
        );

        this.createMenuButton(
            GAME_WIDTH / 2 + 135,
            556,
            'WORLD MAP',
            () => this.goToWorldMap(),
            101,
            '24px'
        );
    }

    private showFinalVictory ()
    {
        this.createResultPanel(
            'FINAL VICTORY',
            '#ffd166',
            '#102018',
            `Semua ${LEVELS.length} level selesai!`,
            `Skor akhir: ${this.score}`
        );

        this.addLevelResultDetails();

        this.createMenuButton(
            GAME_WIDTH / 2 - 125,
            556,
            'PLAY AGAIN',
            () => this.startNewRun(),
            101,
            '24px'
        );

        this.createMenuButton(
            GAME_WIDTH / 2 + 135,
            556,
            'WORLD MAP',
            () => this.goToWorldMap(),
            101,
            '24px'
        );
    }

    private addLevelResultDetails ()
    {
        const totalCoins = this.currentLevel.coins.length;
        const totalEnemies = this.currentLevel.enemies.length;
        const bestStars = formatStars(this.bestStarsForLevel, 3);
        const bestNote = this.newBest ? '  ·  REKOR BARU!' : '';

        this.add.text(
            GAME_WIDTH / 2,
            390,
            `Bintang: ${formatStars(this.resultStars, 3)}  ·  Terbaik: ${bestStars}${bestNote}`,
            {
                fontFamily: 'monospace',
                fontSize: '20px',
                fontStyle: 'bold',
                color: '#ffd166',
                align: 'center'
            }
        ).setOrigin(0.5).setDepth(100).setScrollFactor(0);

        const missions = [
            {
                label: 'ALL COINS',
                earned: this.resultMissions.allCoins,
                detail: `${this.coinsCollected}/${totalCoins} coin`
            },
            {
                label: 'NO DEATH',
                earned: this.resultMissions.noDeath,
                detail: this.resultMissions.noDeath
                    ? 'tanpa kehilangan nyawa'
                    : `gagal (${this.deathsThisAttempt}x kehilangan nyawa)`
            },
            {
                label: 'ALL ENEMIES',
                earned: this.resultMissions.allEnemies,
                detail: totalEnemies === 0
                    ? 'tidak ada musuh - otomatis'
                    : `${this.enemiesDefeated}/${totalEnemies} musuh`
            }
        ];

        missions.forEach((mission, index) => {
            const y = 423 + index * 23;
            const color = mission.earned ? '#ffd166' : '#8a9a90';

            this.add.text(
                GAME_WIDTH / 2 - 220,
                y,
                `${mission.earned ? '★' : '☆'} ${mission.label}`,
                {
                    fontFamily: 'monospace',
                    fontSize: '17px',
                    fontStyle: 'bold',
                    color
                }
            ).setOrigin(0, 0.5).setDepth(100).setScrollFactor(0);

            this.add.text(
                GAME_WIDTH / 2 + 220,
                y,
                mission.detail,
                {
                    fontFamily: 'monospace',
                    fontSize: '15px',
                    color: mission.earned ? '#f2e8cc' : '#8a9a90'
                }
            ).setOrigin(1, 0.5).setDepth(100).setScrollFactor(0);
        });
    }

    private createResultPanel (
        title: string,
        titleColor: string,
        titleStroke: string,
        subtitle: string,
        scoreLabel: string
    )
    {
        this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x102018, 0.78)
            .setDepth(90).setScrollFactor(0);

        this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 720, 500, 0x102018, 0.58)
            .setStrokeStyle(4, 0xffd166)
            .setDepth(91).setScrollFactor(0);

        this.add.text(GAME_WIDTH / 2, 235, title, {
            fontFamily: 'monospace',
            fontSize: '64px',
            fontStyle: 'bold',
            color: titleColor,
            stroke: titleStroke,
            strokeThickness: 8
        }).setOrigin(0.5).setDepth(100).setScrollFactor(0);

        this.add.text(GAME_WIDTH / 2, 312, subtitle, {
            fontFamily: 'monospace',
            fontSize: '20px',
            color: '#f2e8cc',
            align: 'center'
        }).setOrigin(0.5).setDepth(100).setScrollFactor(0);

        this.add.text(GAME_WIDTH / 2, 352, scoreLabel, {
            fontFamily: 'monospace',
            fontSize: '22px',
            fontStyle: 'bold',
            color: '#a8d5ba'
        }).setOrigin(0.5).setDepth(100).setScrollFactor(0);
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

        //  Saat result screen (Game Over / Level Complete / Final Victory),
        //  update berhenti di sini sehingga input gameplay tidak diproses.
        if (this.gameState !== 'playing')
        {
            return;
        }

        if (Input.Keyboard.JustDown(this.keyEsc))
        {
            this.pauseGame();
            return;
        }

        if (
            this.time.now >= this.pitCheckSuppressedUntil
            && this.playerBody.y > GAME_HEIGHT
        )
        {
            this.loseLife('pit');
            return;
        }

        this.updateSlimes();

        const onGround = this.playerBody.blocked.down;

        //  Debu hanya saat transisi dari udara ke darat, bukan setiap frame.
        if (onGround && !this.wasOnGround && this.time.now >= this.landingDustSuppressedUntil)
        {
            this.spawnLandingDust();
        }

        const movingLeft = this.cursors.left.isDown
            || this.keyA.isDown
            || this.mobileControls?.leftPressed === true;
        const movingRight = this.cursors.right.isDown
            || this.keyD.isDown
            || this.mobileControls?.rightPressed === true;

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
        //  Antrian tombol virtual dikonsumsi setiap frame agar tidak menumpuk.
        const mobileJump = this.mobileControls?.consumeJump() ?? false;
        const jumped = (Input.Keyboard.JustDown(this.cursors.space) || mobileJump) && onGround;

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
