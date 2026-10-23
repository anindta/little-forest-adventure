import { Game as MainGame } from './scenes/Game';
import { MainMenu } from './scenes/MainMenu';
import { WorldMap } from './scenes/WorldMap';
import { AUTO, Game, Scale } from 'phaser';

//  Find out more information about the Game Config at:
//  https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    width: 1024,
    height: 768,
    parent: 'game-container',
    backgroundColor: '#a8d5ba',
    //  Desain tetap 1024x768 (4:3), lalu canvas mengikuti viewport tanpa
    //  mengubah koordinat dunia, kamera, platform, atau physics.
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH,
        autoRound: true
    },
    input: {
        //  Cukup untuk menahan kiri/kanan sekaligus menekan tombol lompat.
        activePointers: 3
    },
    //  Nearest-neighbor untuk semua tekstur, canvas tajam, dan posisi pixel dibulatkan.
    pixelArt: true,
    physics: {
        default: 'arcade',
        arcade: {
            //  Gravitasi menarik semua dynamic body ke bawah (dalam piksel/detik kuadrat).
            //  Ubah debug menjadi true untuk melihat kotak collision saat belajar.
            gravity: { x: 0, y: 1000 },
            debug: false
        }
    },
    scene: [ MainMenu, WorldMap, MainGame ]
};

const StartGame = (parent: string) => {

    return new Game({ ...config, parent });

}

export default StartGame;
