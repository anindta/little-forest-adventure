import { Scene } from 'phaser';
import { gameSfx } from '../audio/ProceduralSfx';
import { createSoundToggle } from '../ui/SoundToggle';

const GAME_WIDTH = 1024;
const GAME_HEIGHT = 768;
const PLAYER_FRAME_SIZE = 48;
const COIN_FRAME_SIZE = 24;
const SLIME_FRAME_SIZE = 32;
const DECOR_FRAME_SIZE = 32;

export class MainMenu extends Scene
{
    constructor ()
    {
        super('MainMenu');
    }

    preload ()
    {
        //  MainMenu adalah scene pertama, jadi aset yang dipakai menu dimuat di sini.
        //  Game tetap memeriksa cache sebelum memuat asetnya sendiri.
        if (!this.textures.exists('forest-bg'))
        {
            this.load.image('forest-bg', 'assets/forest-bg.png');
        }

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
        this.cameras.main.setBackgroundColor('#a8d5ba');

        this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'forest-bg');

        //  Sedikit gelap agar panel dan judul tetap terbaca di atas pepohonan.
        this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0b1a12, 0.18);

        this.add.image(92, GAME_HEIGHT, 'forest-decor', 0)
            .setOrigin(0.5, 1)
            .setScale(2);

        this.add.image(GAME_WIDTH - 92, GAME_HEIGHT, 'forest-decor', 1)
            .setOrigin(0.5, 1)
            .setScale(2)
            .setFlipX(true);

        this.add.rectangle(GAME_WIDTH / 2, 370, 720, 540, 0x102018, 0.72)
            .setStrokeStyle(4, 0xffd166);

        this.add.text(GAME_WIDTH / 2, 198, 'Little Forest\nAdventure', {
            fontFamily: 'monospace',
            fontSize: '56px',
            fontStyle: 'bold',
            color: '#ffd166',
            stroke: '#102018',
            strokeThickness: 10,
            align: 'center',
            lineSpacing: 4
        }).setOrigin(0.5);

        this.add.text(GAME_WIDTH / 2, 294, 'Petualangan pixel di hutan kecil', {
            fontFamily: 'monospace',
            fontSize: '20px',
            color: '#f2e8cc'
        }).setOrigin(0.5);

        this.add.rectangle(GAME_WIDTH / 2, 320, 360, 2, 0xffd166, 0.7);

        const menuPlayer = this.add.image(410, 374, 'player', 0).setScale(2);
        const menuCoin = this.add.image(505, 348, 'coin', 0).setScale(1.5);
        const menuSlime = this.add.image(596, 376, 'slime', 0).setScale(1.5).setFlipX(true);

        this.tweens.add({
            targets: menuPlayer,
            y: menuPlayer.y - 6,
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.tweens.add({
            targets: menuCoin,
            y: menuCoin.y - 4,
            duration: 700,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.tweens.add({
            targets: menuSlime,
            y: menuSlime.y - 4,
            duration: 1100,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        const playButton = this.add.text(GAME_WIDTH / 2, 470, 'PLAY', {
            fontFamily: 'monospace',
            fontSize: '38px',
            fontStyle: 'bold',
            color: '#102018',
            backgroundColor: '#ffd166',
            padding: { x: 44, y: 14 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        playButton.on('pointerover', () => playButton.setBackgroundColor('#fff0a8'));
        playButton.on('pointerout', () => playButton.setBackgroundColor('#ffd166'));
        playButton.once('pointerdown', () => this.startGame());

        this.add.text(
            GAME_WIDTH / 2,
            556,
            'A / D atau panah: bergerak    Space: lompat    Esc: pause',
            {
                fontFamily: 'monospace',
                fontSize: '16px',
                color: '#f2e8cc'
            }
        ).setOrigin(0.5);

        createSoundToggle(this, GAME_WIDTH - 24, 20, 50);
    }

    private startGame ()
    {
        //  Klik PLAY adalah gesture yang membuka AudioContext untuk sesi game.
        gameSfx.unlock();
        gameSfx.stopAll();
        this.scene.start('Game');
    }
}
