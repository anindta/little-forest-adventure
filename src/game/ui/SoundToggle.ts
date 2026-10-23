import { GameObjects, Scene } from 'phaser';
import { gameSfx } from '../audio/ProceduralSfx';

const getLabel = (): string => gameSfx.isMuted() ? 'SFX: OFF' : 'SFX: ON';

export interface SoundIconHandle
{
    container: GameObjects.Container;
    refresh: () => void;
}

/**
 * Tombol SFX yang dipakai di main menu dan pause menu.
 * Semua tombol membaca state global yang sama agar labelnya konsisten.
 */
export const createSoundToggle = (
    scene: Scene,
    x: number,
    y: number,
    depth: number,
    originX = 1,
    originY = 0
): GameObjects.Text =>
{
    const button = scene.add.text(x, y, getLabel(), {
        fontFamily: 'monospace',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#ffd166',
        backgroundColor: '#1f3d2b',
        padding: { x: 10, y: 6 }
    }).setOrigin(originX, originY).setDepth(depth).setInteractive({ useHandCursor: true });

    button.on('pointerdown', () => {
        //  Klik pertama sekaligus menjadi gesture untuk membuka AudioContext.
        gameSfx.unlock();
        gameSfx.toggleMuted();
        button.setText(getLabel());
    });

    return button;
};

/**
 * Ikon speaker untuk HUD gameplay. Ikon digambar secara prosedural supaya
 * tetap tajam, tidak menambah file aset, dan dapat berubah saat audio dimatikan.
 */
export const createSoundIcon = (
    scene: Scene,
    x: number,
    y: number,
    depth: number,
    size = 54
): SoundIconHandle =>
{
    const width = size;
    const height = Math.round(size * 0.84);
    const background = scene.add.rectangle(0, 0, width, height, 0x1f3d2b, 0.9)
        .setStrokeStyle(3, 0xffd166)
        .setInteractive({ useHandCursor: true });
    const icon = scene.add.graphics().setScale(size / 54);
    const container = scene.add.container(x, y, [ background, icon ])
        .setDepth(depth)
        .setScrollFactor(0);

    const drawIcon = () => {
        const muted = gameSfx.isMuted();
        const ink = muted ? 0xc9a98e : 0xffd166;

        icon.clear();
        icon.fillStyle(ink, 1);
        icon.fillRect(-19, -5, 8, 10);
        icon.beginPath();
        icon.moveTo(-11, -5);
        icon.lineTo(3, -18);
        icon.lineTo(3, 18);
        icon.lineTo(-11, 5);
        icon.closePath();
        icon.fillPath();

        if (muted)
        {
            icon.lineStyle(4, 0xff8b7a, 1);
            icon.lineBetween(7, -11, 20, 11);
            icon.lineBetween(20, -11, 7, 11);
        }
        else
        {
            icon.lineStyle(3, ink, 1);
            icon.beginPath();
            icon.arc(4, 0, 10, -Math.PI / 3, Math.PI / 3);
            icon.strokePath();
            icon.beginPath();
            icon.arc(4, 0, 16, -Math.PI / 3, Math.PI / 3);
            icon.strokePath();
        }

        background.setStrokeStyle(3, muted ? 0x8a5a4a : 0xffd166);
    };

    const refresh = () => drawIcon();

    background.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        pointer.event?.preventDefault?.();
        //  Klik pertama sekaligus menjadi gesture untuk membuka AudioContext.
        gameSfx.unlock();
        gameSfx.toggleMuted();
        refresh();
    });

    refresh();

    return { container, refresh };
};
