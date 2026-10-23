const MUTE_STORAGE_KEY = 'little-forest-adventure-sfx-muted';

type ToneType = 'sine' | 'square' | 'sawtooth' | 'triangle';

type Voice = {
    oscillator: OscillatorNode;
    gain: GainNode;
};

//  SFX dibuat langsung dengan Web Audio API, tanpa file audio eksternal.
export class ProceduralSfx
{
    private context: AudioContext | null = null;
    private master: GainNode | null = null;
    private activeVoices = new Set<Voice>();
    private muted: boolean;

    constructor ()
    {
        this.muted = this.readMuted();
    }

    isMuted (): boolean
    {
        return this.muted;
    }

    unlock (): void
    {
        const AudioContextClass = window.AudioContext
            ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

        if (!AudioContextClass)
        {
            return;
        }

        if (!this.context)
        {
            this.context = new AudioContextClass();
            this.master = this.context.createGain();
            this.master.gain.value = this.muted ? 0 : 1;
            this.master.connect(this.context.destination);
        }

        if (this.context.state !== 'running')
        {
            void this.context.resume();
        }
    }

    toggleMuted (): boolean
    {
        this.muted = !this.muted;
        this.writeMuted();

        if (this.master && this.context)
        {
            this.master.gain.setTargetAtTime(
                this.muted ? 0 : 1,
                this.context.currentTime,
                0.01
            );
        }

        if (this.muted)
        {
            this.stopAll();
        }

        return this.muted;
    }

    stopAll (): void
    {
        for (const voice of this.activeVoices)
        {
            try
            {
                voice.oscillator.stop();
            }
            catch
            {
                //  Oscillator mungkin sudah selesai; tidak ada yang perlu dihentikan.
            }

            try
            {
                voice.oscillator.disconnect();
                voice.gain.disconnect();
            }
            catch
            {
                //  Node sudah terputus.
            }
        }

        this.activeVoices.clear();
    }

    playCoin (): void
    {
        this.playTone(880, 1320, 0.09, 0, 'triangle', 0.05);
        this.playTone(1320, 1760, 0.1, 0.055, 'triangle', 0.04);
    }

    playJump (): void
    {
        this.playTone(180, 360, 0.14, 0, 'square', 0.035);
    }

    playDamage (): void
    {
        this.playTone(220, 90, 0.24, 0, 'sawtooth', 0.05);
        this.playTone(110, 70, 0.28, 0.04, 'square', 0.025);
    }

    playEnemyDefeat (): void
    {
        this.playTone(340, 90, 0.16, 0, 'square', 0.04);
    }

    playWin (): void
    {
        const notes = [523, 659, 784, 1047];

        notes.forEach((frequency, index) => {
            this.playTone(frequency, frequency, 0.15, index * 0.11, 'triangle', 0.04);
        });
    }

    playGameOver (): void
    {
        const notes = [392, 330, 262];

        notes.forEach((frequency, index) => {
            this.playTone(frequency, frequency * 0.96, 0.22, index * 0.14, 'triangle', 0.045);
        });
    }

    private playTone (
        frequency: number,
        endFrequency: number,
        duration: number,
        delay: number,
        type: ToneType,
        volume: number
    ): void
    {
        if (!this.context || !this.master || this.muted)
        {
            return;
        }

        const start = this.context.currentTime + delay;
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();
        const voice = { oscillator, gain };

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, start);
        oscillator.frequency.exponentialRampToValueAtTime(
            Math.max(20, endFrequency),
            start + duration
        );

        //  Envelope singkat mencegah klik dan menjaga SFX tetap pelan.
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

        oscillator.connect(gain);
        gain.connect(this.master);
        oscillator.start(start);
        oscillator.stop(start + duration + 0.03);

        this.activeVoices.add(voice);

        oscillator.onended = () => {
            this.activeVoices.delete(voice);

            try
            {
                oscillator.disconnect();
                gain.disconnect();
            }
            catch
            {
                //  Node sudah dibersihkan oleh stopAll().
            }
        };
    }

    private readMuted (): boolean
    {
        try
        {
            return window.localStorage.getItem(MUTE_STORAGE_KEY) === '1';
        }
        catch
        {
            return false;
        }
    }

    private writeMuted (): void
    {
        try
        {
            window.localStorage.setItem(MUTE_STORAGE_KEY, this.muted ? '1' : '0');
        }
        catch
        {
            //  localStorage bisa diblokir; mute tetap berlaku selama sesi.
        }
    }
}

export const gameSfx = new ProceduralSfx();
