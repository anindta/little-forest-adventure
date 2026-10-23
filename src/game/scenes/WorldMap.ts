import { Input, Scene } from 'phaser';
import { gameSfx } from '../audio/ProceduralSfx';
import { LEVELS } from '../levels/LevelData';
import { formatStars } from '../progress/StarRating';
import { progressStore } from '../progress/ProgressStore';
import { createSoundToggle } from '../ui/SoundToggle';

const GAME_WIDTH = 1024;
const GAME_HEIGHT = 768;
const DECOR_FRAME_SIZE = 32;

interface NodePosition
{
    x: number;
    y: number;
}

const NODE_POSITIONS: NodePosition[] = [
    { x: 240, y: 560 },
    { x: 512, y: 410 },
    { x: 784, y: 260 }
];

export class WorldMap extends Scene
{
    private selectedIndex = 0;
    private nodeObjects: Phaser.GameObjects.GameObject[] = [];
    private pathObjects: Phaser.GameObjects.GameObject[] = [];
    private resetElements: Phaser.GameObjects.GameObject[] = [];
    private resetOpen = false;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private keyA!: Phaser.Input.Keyboard.Key;
    private keyD!: Phaser.Input.Keyboard.Key;
    private keyEnter!: Phaser.Input.Keyboard.Key;
    private keyEsc!: Phaser.Input.Keyboard.Key;
    private progressText!: Phaser.GameObjects.Text;
    private messageText!: Phaser.GameObjects.Text;

    constructor ()
    {
        super('WorldMap');
    }

    preload ()
    {
        if (!this.textures.exists('forest-bg'))
        {
            this.load.image('forest-bg', 'assets/forest-bg.png');
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
        this.resetOpen = false;
        this.nodeObjects = [];
        this.pathObjects = [];
        this.resetElements = [];
        this.selectedIndex = this.findSuggestedIndex();

        this.cameras.main.setBackgroundColor('#0b1a12');

        this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'forest-bg')
            .setAlpha(0.9);

        //  Lapisan gelap membuat jalur dan node tetap terbaca di atas hutan.
        this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0b1a12, 0.48);

        this.add.image(74, GAME_HEIGHT, 'forest-decor', 0)
            .setOrigin(0.5, 1)
            .setScale(2.4);

        this.add.image(GAME_WIDTH - 72, GAME_HEIGHT, 'forest-decor', 1)
            .setOrigin(0.5, 1)
            .setScale(2.4)
            .setFlipX(true);

        this.add.image(174, 214, 'forest-decor', 2)
            .setOrigin(0.5, 1)
            .setScale(1.8);

        this.add.image(862, 468, 'forest-decor', 6)
            .setOrigin(0.5, 1)
            .setScale(1.8)
            .setFlipX(true);

        this.createHeader();
        this.renderPath();
        this.renderNodes();
        this.createFooter();

        this.cursors = this.input.keyboard!.createCursorKeys();
        this.keyA = this.input.keyboard!.addKey(Input.Keyboard.KeyCodes.A);
        this.keyD = this.input.keyboard!.addKey(Input.Keyboard.KeyCodes.D);
        this.keyEnter = this.input.keyboard!.addKey(Input.Keyboard.KeyCodes.ENTER);
        this.keyEsc = this.input.keyboard!.addKey(Input.Keyboard.KeyCodes.ESC);
        this.input.keyboard!.resetKeys();

        this.input.keyboard!.once('keydown', () => gameSfx.unlock());
        this.input.once('pointerdown', () => gameSfx.unlock());
    }

    update ()
    {
        if (this.resetOpen)
        {
            if (Input.Keyboard.JustDown(this.keyEsc))
            {
                this.cancelReset();
                return;
            }

            if (Input.Keyboard.JustDown(this.keyEnter) || Input.Keyboard.JustDown(this.cursors.space))
            {
                this.confirmReset();
            }

            return;
        }

        if (Input.Keyboard.JustDown(this.cursors.left) || Input.Keyboard.JustDown(this.cursors.up) || Input.Keyboard.JustDown(this.keyA))
        {
            this.selectNode(this.selectedIndex - 1);
            return;
        }

        if (Input.Keyboard.JustDown(this.cursors.right) || Input.Keyboard.JustDown(this.cursors.down) || Input.Keyboard.JustDown(this.keyD))
        {
            this.selectNode(this.selectedIndex + 1);
            return;
        }

        if (Input.Keyboard.JustDown(this.keyEnter) || Input.Keyboard.JustDown(this.cursors.space))
        {
            this.attemptStart(this.selectedIndex);
            return;
        }

        if (Input.Keyboard.JustDown(this.keyEsc))
        {
            this.goToMainMenu();
        }
    }

    private findSuggestedIndex (): number
    {
        const snapshot = progressStore.getSnapshot();
        const firstIncomplete = snapshot.unlocked.findIndex(
            (unlocked, index) => unlocked && !snapshot.completed[index]
        );

        if (firstIncomplete >= 0)
        {
            return firstIncomplete;
        }

        for (let index = snapshot.unlocked.length - 1; index >= 0; index--)
        {
            if (snapshot.unlocked[index])
            {
                return index;
            }
        }

        return 0;
    }

    private createHeader ()
    {
        this.add.rectangle(GAME_WIDTH / 2, 74, 710, 104, 0x102018, 0.82)
            .setStrokeStyle(3, 0xffd166);

        this.add.text(GAME_WIDTH / 2, 47, 'WORLD MAP', {
            fontFamily: 'monospace',
            fontSize: '42px',
            fontStyle: 'bold',
            color: '#ffd166',
            stroke: '#102018',
            strokeThickness: 7
        }).setOrigin(0.5);

        this.add.text(GAME_WIDTH / 2, 93, 'Pilih level · A / D atau panah · Enter: mainkan · Esc: menu', {
            fontFamily: 'monospace',
            fontSize: '15px',
            color: '#f2e8cc'
        }).setOrigin(0.5);

        this.progressText = this.add.text(
            GAME_WIDTH / 2,
            148,
            '',
            {
                fontFamily: 'monospace',
                fontSize: '17px',
                fontStyle: 'bold',
                color: '#a8d5ba'
            }
        ).setOrigin(0.5);

        this.refreshProgressText();
    }

    private createFooter ()
    {
        this.createButton(150, 704, 'MAIN MENU', () => this.goToMainMenu(), 17);

        this.createButton(872, 704, 'RESET PROGRESS', () => this.showResetConfirmation(), 17);

        this.messageText = this.add.text(
            GAME_WIDTH / 2,
            670,
            'Level pertama sudah terbuka. Selesaikan level untuk membuka jalur berikutnya.',
            {
                fontFamily: 'monospace',
                fontSize: '15px',
                color: '#d6e8d8',
                align: 'center',
                wordWrap: { width: 760 }
            }
        ).setOrigin(0.5);

        createSoundToggle(this, GAME_WIDTH - 24, 20, 50);
    }

    private refreshProgressText ()
    {
        this.progressText.setText(
            `Bintang terkumpul: ${progressStore.getTotalStars()}/${LEVELS.length * 3}`
        );
    }

    private renderPath ()
    {
        this.pathObjects.forEach((object) => object.destroy());
        this.pathObjects = [];

        const snapshot = progressStore.getSnapshot();

        for (let index = 1; index < NODE_POSITIONS.length; index++)
        {
            this.drawTrail(
                NODE_POSITIONS[index - 1],
                NODE_POSITIONS[index],
                snapshot.completed[index - 1]
            );
        }
    }

    private drawTrail (from: NodePosition, to: NodePosition, active: boolean)
    {
        const distance = Math.hypot(to.x - from.x, to.y - from.y);
        const steps = Math.max(6, Math.floor(distance / 22));

        for (let step = 0; step <= steps; step++)
        {
            const t = step / steps;
            const x = from.x + (to.x - from.x) * t;
            const y = from.y + (to.y - from.y) * t;
            const marker = this.add.rectangle(
                Math.round(x),
                Math.round(y),
                8,
                8,
                active ? 0xffd166 : 0x52645a,
                active ? 0.95 : 0.7
            );

            marker.setDepth(2);
            this.pathObjects.push(marker);
        }
    }

    private renderNodes ()
    {
        this.nodeObjects.forEach((object) => object.destroy());
        this.nodeObjects = [];

        const snapshot = progressStore.getSnapshot();

        LEVELS.forEach((level, index) => {
            const position = NODE_POSITIONS[index];
            const unlocked = snapshot.unlocked[index] === true;
            const completed = snapshot.completed[index] === true;
            const stars = snapshot.bestStars[index] ?? 0;
            const selected = this.selectedIndex === index;
            const accent = completed ? 0xffd166 : unlocked ? 0xa8d5ba : 0x5f6b63;
            const fill = completed ? 0x2f5d46 : unlocked ? 0x1f3d2b : 0x1a2620;
            const textColor = completed ? '#ffd166' : unlocked ? '#f2e8cc' : '#8a9a90';
            const status = completed
                ? `COMPLETED ${formatStars(stars)}`
                : unlocked
                    ? `READY ${formatStars(0)}`
                    : 'LOCKED';

            if (selected)
            {
                const selectionRing = this.add.circle(position.x, position.y, 58, 0xfff0a8, 0)
                    .setStrokeStyle(3, 0xfff0a8, 1);

                selectionRing.setDepth(9);
                this.nodeObjects.push(selectionRing);
            }

            const shadow = this.add.circle(position.x, position.y + 5, 46, 0x000000, 0.28);
            shadow.setDepth(3);

            const outer = this.add.circle(position.x, position.y, 46, 0x102018, 1)
                .setStrokeStyle(5, accent);

            outer.setDepth(10);
            outer.setInteractive({ useHandCursor: unlocked });
            outer.on('pointerover', () => this.selectNode(index));
            outer.on('pointerdown', () => this.attemptStart(index));

            const inner = this.add.circle(position.x, position.y, 35, fill, 0.98)
                .setStrokeStyle(2, 0x102018, 0.7);

            inner.setDepth(11);

            const number = this.add.text(position.x, position.y - 2, String(index + 1), {
                fontFamily: 'monospace',
                fontSize: '30px',
                fontStyle: 'bold',
                color: textColor,
                stroke: '#102018',
                strokeThickness: 5
            }).setOrigin(0.5).setDepth(12);

            const name = this.add.text(position.x, position.y + 60, level.name, {
                fontFamily: 'monospace',
                fontSize: '18px',
                fontStyle: 'bold',
                color: textColor,
                backgroundColor: '#102018',
                padding: { x: 8, y: 4 }
            }).setOrigin(0.5).setDepth(12);

            const statusText = this.add.text(position.x, position.y + 88, status, {
                fontFamily: 'monospace',
                fontSize: '14px',
                fontStyle: 'bold',
                color: completed ? '#ffd166' : unlocked ? '#a8d5ba' : '#8a9a90'
            }).setOrigin(0.5).setDepth(12);

            this.nodeObjects.push(shadow, outer, inner, number, name, statusText);
        });
    }

    private selectNode (index: number)
    {
        const wrapped = (index + LEVELS.length) % LEVELS.length;

        if (wrapped === this.selectedIndex)
        {
            return;
        }

        this.selectedIndex = wrapped;
        this.renderNodes();

        const level = LEVELS[wrapped];

        if (!progressStore.isUnlocked(wrapped))
        {
            this.showMessage(`Level ${wrapped + 1} — ${level.name} masih terkunci.`);
        }
        else
        {
            this.showMessage(`Level ${wrapped + 1} — ${level.name} siap dimainkan.`);
        }
    }

    private attemptStart (index: number)
    {
        if (this.resetOpen)
        {
            return;
        }

        if (!progressStore.isUnlocked(index))
        {
            this.showMessage('Level ini masih terkunci. Selesaikan level sebelumnya terlebih dahulu.');
            return;
        }

        this.input.keyboard!.resetKeys();
        gameSfx.unlock();
        gameSfx.stopAll();
        this.scene.start('Game', {
            levelIndex: index,
            score: 0
        });
    }

    private goToMainMenu ()
    {
        this.input.keyboard!.resetKeys();
        gameSfx.stopAll();
        this.scene.start('MainMenu');
    }

    private showMessage (text: string)
    {
        //  Scene bisa sedang shutdown jika input datang tepat saat transisi.
        //  Jangan update Text yang sudah tidak aktif.
        if (!this.messageText || !this.messageText.active)
        {
            return;
        }

        this.messageText.setText(text);
    }

    private createButton (
        x: number,
        y: number,
        label: string,
        onClick: () => void,
        fontSize = 18,
        depth = 20
    ): Phaser.GameObjects.Text
    {
        const button = this.add.text(x, y, label, {
            fontFamily: 'monospace',
            fontSize: `${fontSize}px`,
            fontStyle: 'bold',
            color: '#102018',
            backgroundColor: '#ffd166',
            padding: { x: 18, y: 9 }
        }).setOrigin(0.5).setDepth(depth).setInteractive({ useHandCursor: true });

        button.on('pointerover', () => button.setBackgroundColor('#fff0a8'));
        button.on('pointerout', () => button.setBackgroundColor('#ffd166'));
        button.once('pointerdown', onClick);

        return button;
    }

    private showResetConfirmation ()
    {
        if (this.resetOpen || this.resetElements.length > 0)
        {
            return;
        }

        this.resetOpen = true;

        const backdrop = this.add.rectangle(
            GAME_WIDTH / 2,
            GAME_HEIGHT / 2,
            GAME_WIDTH,
            GAME_HEIGHT,
            0x000000,
            0.72
        ).setDepth(70).setInteractive();

        const panel = this.add.rectangle(
            GAME_WIDTH / 2,
            GAME_HEIGHT / 2,
            700,
            360,
            0x102018,
            0.98
        ).setStrokeStyle(4, 0xffd166).setDepth(71);

        const title = this.add.text(GAME_WIDTH / 2, 292, 'RESET PROGRESS?', {
            fontFamily: 'monospace',
            fontSize: '38px',
            fontStyle: 'bold',
            color: '#ffd166',
            stroke: '#102018',
            strokeThickness: 6
        }).setOrigin(0.5).setDepth(72);

        const warning = this.add.text(
            GAME_WIDTH / 2,
            356,
            'Semua level terbuka, bintang terbaik, dan statistik\nakan dihapus dari browser ini.',
            {
                fontFamily: 'monospace',
                fontSize: '18px',
                color: '#f2e8cc',
                align: 'center',
                lineSpacing: 8
            }
        ).setOrigin(0.5).setDepth(72);

        const yesButton = this.createButton(
            GAME_WIDTH / 2 - 130,
            472,
            'YES, RESET',
            () => this.confirmReset(),
            19,
            72
        );

        const cancelButton = this.createButton(
            GAME_WIDTH / 2 + 140,
            472,
            'CANCEL',
            () => this.cancelReset(),
            19,
            72
        );

        this.resetElements.push(
            backdrop,
            panel,
            title,
            warning,
            yesButton,
            cancelButton
        );

        this.showMessage('Konfirmasi reset progress. Enter: hapus · Esc: batal.');
    }

    private confirmReset ()
    {
        if (!this.resetOpen)
        {
            return;
        }

        progressStore.reset();
        this.closeResetOverlay();
        this.selectedIndex = 0;
        this.refreshProgressText();
        this.renderPath();
        this.renderNodes();
        this.showMessage('Progress direset. Level pertama kembali terbuka.');
    }

    private cancelReset ()
    {
        if (!this.resetOpen && this.resetElements.length === 0)
        {
            return;
        }

        this.closeResetOverlay();
        this.showMessage('Reset progress dibatalkan.');
    }

    private closeResetOverlay ()
    {
        this.resetOpen = false;
        this.resetElements.forEach((object) => object.destroy());
        this.resetElements = [];
    }
}
