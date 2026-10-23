import { GameObjects, Scene } from 'phaser';
import { gameSfx } from '../audio/ProceduralSfx';

const getLabel = (): string => gameSfx.isMuted() ? 'SFX: OFF' : 'SFX: ON';

/**
 * Tombol SFX yang dipakai di main menu, HUD, dan pause menu.
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
