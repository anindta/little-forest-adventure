export interface LevelPoint
{
    x: number;
    y: number;
}

export interface LevelPlatform
{
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface LevelEnemy extends LevelPoint
{
    patrolLeft: number;
    patrolRight: number;
    speed?: number;
    direction?: 1 | -1;
}

export interface LevelFinish
{
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface LevelCheckpoint extends LevelPoint
{
    //  y adalah posisi tengah player saat respawn di atas platform.
}

export interface LevelDefinition
{
    name: string;
    width: number;
    spawn: LevelPoint;
    platforms: LevelPlatform[];
    coins: LevelPoint[];
    enemies: LevelEnemy[];
    checkpoints: LevelCheckpoint[];
    finish: LevelFinish;
}

//  Tinggi lompat player sekitar 157 px dan jarak horizontal maksimal sekitar
//  268 px. Semua lompatan antar-platform di bawah ini berada dalam batas itu.
//  Level lebih lebar dari viewport agar kamera dapat mengikuti player.
export const LEVELS: LevelDefinition[] = [
    {
        name: 'Forest Entrance',
        width: 2048,
        spawn: { x: 100, y: 688 },
        platforms: [
            { x: 160, y: 740, width: 320, height: 56 },
            { x: 540, y: 740, width: 240, height: 56 },
            { x: 920, y: 740, width: 280, height: 56 },
            { x: 1240, y: 740, width: 260, height: 56 },
            { x: 1540, y: 740, width: 240, height: 56 },
            { x: 1800, y: 740, width: 368, height: 56 },
            { x: 300, y: 610, width: 220, height: 24 },
            { x: 600, y: 500, width: 220, height: 24 },
            { x: 850, y: 390, width: 180, height: 24 },
            { x: 1080, y: 600, width: 160, height: 24 },
            { x: 1300, y: 540, width: 160, height: 24 },
            { x: 1460, y: 620, width: 160, height: 24 },
            { x: 1720, y: 620, width: 140, height: 24 }
        ],
        coins: [
            { x: 260, y: 555 },
            { x: 340, y: 555 },
            { x: 560, y: 445 },
            { x: 640, y: 445 },
            { x: 810, y: 335 },
            { x: 890, y: 335 },
            { x: 1040, y: 545 },
            { x: 1120, y: 545 },
            { x: 1260, y: 485 },
            { x: 1340, y: 485 },
            { x: 1840, y: 669 },
            { x: 1900, y: 669 }
        ],
        enemies: [
            {
                x: 300,
                y: 582,
                patrolLeft: 230,
                patrolRight: 370,
                speed: 55,
                direction: 1
            },
            {
                x: 1240,
                y: 696,
                patrolLeft: 1150,
                patrolRight: 1340,
                speed: 55,
                direction: -1
            }
        ],
        checkpoints: [
            { x: 600, y: 464 },
            { x: 1540, y: 688 }
        ],
        finish: { x: 1940, y: 646, width: 12, height: 132 }
    },
    {
        name: 'Deep Forest',
        width: 2560,
        spawn: { x: 70, y: 688 },
        platforms: [
            { x: 140, y: 740, width: 280, height: 56 },
            { x: 500, y: 740, width: 240, height: 56 },
            { x: 900, y: 740, width: 260, height: 56 },
            { x: 1280, y: 740, width: 260, height: 56 },
            { x: 1650, y: 740, width: 240, height: 56 },
            { x: 2000, y: 740, width: 260, height: 56 },
            { x: 2350, y: 740, width: 420, height: 56 },
            { x: 310, y: 600, width: 160, height: 24 },
            { x: 520, y: 500, width: 170, height: 24 },
            { x: 750, y: 590, width: 150, height: 24 },
            { x: 900, y: 480, width: 160, height: 24 },
            { x: 1120, y: 600, width: 160, height: 24 },
            { x: 1320, y: 540, width: 160, height: 24 },
            { x: 1520, y: 610, width: 140, height: 24 },
            { x: 1840, y: 580, width: 160, height: 24 },
            { x: 2130, y: 600, width: 160, height: 24 },
            { x: 2300, y: 500, width: 150, height: 24 },
            { x: 2480, y: 400, width: 120, height: 24 }
        ],
        coins: [
            { x: 280, y: 545 },
            { x: 340, y: 545 },
            { x: 470, y: 445 },
            { x: 540, y: 445 },
            { x: 720, y: 535 },
            { x: 850, y: 425 },
            { x: 940, y: 425 },
            { x: 1080, y: 545 },
            { x: 1160, y: 545 },
            { x: 1300, y: 485 },
            { x: 1510, y: 555 },
            { x: 1800, y: 525 },
            { x: 1880, y: 525 },
            { x: 2100, y: 545 },
            { x: 2300, y: 445 },
            { x: 2440, y: 345 }
        ],
        enemies: [
            {
                x: 300,
                y: 572,
                patrolLeft: 240,
                patrolRight: 360,
                speed: 60,
                direction: 1
            },
            {
                x: 730,
                y: 562,
                patrolLeft: 690,
                patrolRight: 790,
                speed: 60,
                direction: -1
            },
            {
                x: 1320,
                y: 512,
                patrolLeft: 1260,
                patrolRight: 1380,
                speed: 65,
                direction: 1
            },
            {
                x: 2000,
                y: 696,
                patrolLeft: 1880,
                patrolRight: 2110,
                speed: 65,
                direction: -1
            }
        ],
        checkpoints: [
            { x: 520, y: 464 },
            { x: 1650, y: 688 }
        ],
        finish: { x: 2480, y: 340, width: 12, height: 96 }
    },
    {
        name: 'Forest Sanctuary',
        width: 3072,
        spawn: { x: 60, y: 688 },
        platforms: [
            { x: 100, y: 740, width: 200, height: 56 },
            { x: 455, y: 740, width: 250, height: 56 },
            { x: 872, y: 740, width: 304, height: 56 },
            { x: 1340, y: 740, width: 260, height: 56 },
            { x: 1620, y: 740, width: 240, height: 56 },
            { x: 2180, y: 740, width: 300, height: 56 },
            { x: 2700, y: 740, width: 372, height: 56 },
            { x: 310, y: 610, width: 140, height: 24 },
            { x: 500, y: 510, width: 130, height: 24 },
            { x: 670, y: 410, width: 120, height: 24 },
            { x: 840, y: 520, width: 130, height: 24 },
            { x: 940, y: 400, width: 90, height: 24 },
            { x: 1120, y: 460, width: 140, height: 24 },
            { x: 1250, y: 600, width: 150, height: 24 },
            { x: 1520, y: 590, width: 160, height: 24 },
            { x: 1810, y: 500, width: 150, height: 24 },
            { x: 2000, y: 420, width: 140, height: 24 },
            { x: 2110, y: 610, width: 150, height: 24 },
            { x: 2320, y: 510, width: 150, height: 24 },
            { x: 2510, y: 430, width: 130, height: 24 },
            { x: 2630, y: 610, width: 150, height: 24 },
            { x: 2820, y: 520, width: 140, height: 24 },
            { x: 2980, y: 430, width: 110, height: 24 }
        ],
        coins: [
            { x: 280, y: 555 },
            { x: 340, y: 555 },
            { x: 470, y: 455 },
            { x: 530, y: 455 },
            { x: 670, y: 355 },
            { x: 810, y: 465 },
            { x: 870, y: 465 },
            { x: 940, y: 345 },
            { x: 1110, y: 405 },
            { x: 1250, y: 545 },
            { x: 1530, y: 535 },
            { x: 1810, y: 445 },
            { x: 1980, y: 365 },
            { x: 2040, y: 365 },
            { x: 2130, y: 555 },
            { x: 2350, y: 455 },
            { x: 2500, y: 375 },
            { x: 2650, y: 555 },
            { x: 2820, y: 465 }
        ],
        enemies: [
            {
                x: 450,
                y: 696,
                patrolLeft: 350,
                patrolRight: 560,
                speed: 65,
                direction: 1
            },
            {
                x: 500,
                y: 482,
                patrolLeft: 450,
                patrolRight: 550,
                speed: 60,
                direction: -1
            },
            {
                x: 840,
                y: 492,
                patrolLeft: 790,
                patrolRight: 890,
                speed: 65,
                direction: 1
            },
            {
                x: 2180,
                y: 696,
                patrolLeft: 2050,
                patrolRight: 2300,
                speed: 70,
                direction: -1
            }
        ],
        checkpoints: [
            { x: 1120, y: 424 },
            { x: 1620, y: 688 },
            { x: 2320, y: 474 }
        ],
        finish: { x: 2980, y: 370, width: 12, height: 96 }
    }
];
