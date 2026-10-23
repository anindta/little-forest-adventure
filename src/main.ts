import StartGame from './game/main';

document.addEventListener('DOMContentLoaded', () => {

    const game = StartGame('game-container');

    if (import.meta.env.DEV)
    {
        (window as typeof window & { __phaserGame?: unknown }).__phaserGame = game;
    }

});