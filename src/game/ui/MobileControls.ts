import { GameObjects, Input, Scene } from 'phaser';

const CONTROL_DEPTH_OFFSET = 3;
const CONTROL_MARGIN_X = 24;
const CONTROL_MARGIN_BOTTOM = 52;
const SIDE_BUTTON_SIZE = 100;
const JUMP_BUTTON_SIZE = 112;
const SIDE_BUTTON_GAP = 12;
const BUTTON_FILL = 0x1f3d2b;
const BUTTON_FILL_PRESSED = 0x355f49;
const BUTTON_STROKE = 0xffd166;
const BUTTON_INK = 0xffd166;

/**
 * Kontrol virtual hanya ditampilkan jika perangkat benar-benar punya
 * kemampuan sentuh. Ukuran layar dipakai sebagai fallback untuk perangkat
 * hybrid, bukan user-agent, supaya desktop biasa tetap memakai keyboard.
 */
export const shouldShowVirtualControls = (scene: Scene): boolean =>
{
    const device = scene.sys.game.device;
    const touchCapable = device.input.touch
        || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);

    if (!touchCapable)
    {
        return false;
    }

    const coarsePointer = typeof window.matchMedia === 'function'
        && window.matchMedia('(pointer: coarse)').matches;
    const compactViewport = Math.min(window.innerWidth, window.innerHeight) <= 900;

    return coarsePointer || compactViewport;
};

type ButtonVisual = {
    background: GameObjects.Rectangle;
    release: () => void;
};

export class MobileControls
{
    private readonly scene: Scene;
    private readonly containers: GameObjects.Container[] = [];
    private readonly visuals: ButtonVisual[] = [];
    private leftHeld = false;
    private rightHeld = false;
    private jumpQueued = false;

    constructor (scene: Scene, depth: number)
    {
        this.scene = scene;

        const width = scene.scale.width;
        const height = scene.scale.height;
        const sideY = height - CONTROL_MARGIN_BOTTOM - SIDE_BUTTON_SIZE / 2;
        const leftX = CONTROL_MARGIN_X + SIDE_BUTTON_SIZE / 2;
        const rightX = leftX + SIDE_BUTTON_SIZE + SIDE_BUTTON_GAP;
        const jumpX = width - CONTROL_MARGIN_X - JUMP_BUTTON_SIZE / 2;
        const jumpY = height - CONTROL_MARGIN_BOTTOM - JUMP_BUTTON_SIZE / 2 - 8;

        this.containers.push(
            this.createArrowButton(
                leftX,
                sideY,
                SIDE_BUTTON_SIZE,
                -1,
                depth,
                () => { this.leftHeld = true; },
                () => { this.leftHeld = false; }
            ),
            this.createArrowButton(
                rightX,
                sideY,
                SIDE_BUTTON_SIZE,
                1,
                depth,
                () => { this.rightHeld = true; },
                () => { this.rightHeld = false; }
            ),
            this.createJumpButton(
                jumpX,
                jumpY,
                JUMP_BUTTON_SIZE,
                depth
            )
        );
    }

    get leftPressed (): boolean
    {
        return this.leftHeld;
    }

    get rightPressed (): boolean
    {
        return this.rightHeld;
    }

    /**
     * Mengambil antrian lompat sekali saja. Pointerdown tetap responsif
     * walaupun jari sudah diangkat sebelum frame update berikutnya.
     */
    consumeJump (): boolean
    {
        const queued = this.jumpQueued;

        this.jumpQueued = false;

        return queued;
    }

    resetInput (): void
    {
        this.leftHeld = false;
        this.rightHeld = false;
        this.jumpQueued = false;

        this.visuals.forEach((visual) => visual.release());
    }

    destroy (): void
    {
        this.containers.forEach((container) => container.destroy(true));

        this.containers.length = 0;
        this.visuals.length = 0;
        this.resetInput();
    }

    private createArrowButton (
        x: number,
        y: number,
        size: number,
        direction: -1 | 1,
        depth: number,
        onPress: () => void,
        onRelease: () => void
    ): GameObjects.Container
    {
        return this.createButton(
            x,
            y,
            size,
            depth,
            (graphics) => {
                const tipX = direction > 0 ? 22 : -22;
                const backX = direction > 0 ? -20 : 20;

                graphics.fillStyle(BUTTON_INK, 1);
                graphics.fillTriangle(backX, -25, backX, 25, tipX, 0);
                graphics.lineStyle(4, 0x102018, 1);
                graphics.strokeTriangle(backX, -25, backX, 25, tipX, 0);
            },
            onPress,
            onRelease
        );
    }

    private createJumpButton (
        x: number,
        y: number,
        size: number,
        depth: number
    ): GameObjects.Container
    {
        return this.createButton(
            x,
            y,
            size,
            depth,
            (graphics) => {
                graphics.fillStyle(BUTTON_INK, 1);
                graphics.fillTriangle(0, -28, -25, 22, 25, 22);
                graphics.lineStyle(4, 0x102018, 1);
                graphics.strokeTriangle(0, -28, -25, 22, 25, 22);
            },
            () => { this.jumpQueued = true; },
            () => undefined
        );
    }

    private createButton (
        x: number,
        y: number,
        size: number,
        depth: number,
        drawIcon: (graphics: GameObjects.Graphics) => void,
        onPress: () => void,
        onRelease: () => void
    ): GameObjects.Container
    {
        const background = this.scene.add.rectangle(
            0,
            0,
            size,
            size,
            BUTTON_FILL,
            0.74
        )
            .setStrokeStyle(4, BUTTON_STROKE, 0.92)
            .setInteractive({ useHandCursor: true });

        const icon = this.scene.add.graphics();

        drawIcon(icon);

        const setPressedVisual = (pressed: boolean) => {
            background.setFillStyle(
                pressed ? BUTTON_FILL_PRESSED : BUTTON_FILL,
                pressed ? 0.92 : 0.74
            );
            background.setScale(pressed ? 0.96 : 1);
        };

        const release = () => {
            setPressedVisual(false);
            onRelease();
        };

        background.on('pointerdown', (pointer: Input.Pointer) => {
            pointer.event?.preventDefault?.();
            setPressedVisual(true);
            onPress();
        });
        background.on('pointerup', release);
        background.on('pointerout', release);
        background.on('pointerupoutside', release);

        const container = this.scene.add.container(x, y, [ background, icon ])
            .setDepth(depth + CONTROL_DEPTH_OFFSET)
            .setScrollFactor(0);

        this.visuals.push({ background, release });

        return container;
    }
}
