import { LEVELS } from '../levels/LevelData';
import {
    LevelMissions,
    countStars,
    createEmptyMissions,
    mergeMissions,
    normaliseMissions
} from './StarRating';

export const SAVE_VERSION = 2;
export const SAVE_KEY = 'little-forest-adventure.progress';

export interface ProgressSnapshot
{
    version: number;
    unlocked: boolean[];
    completed: boolean[];
    bestStars: number[];
    bestMissions: LevelMissions[];
    bestCollectibles: number[];
    totalCoinsCollected: number;
    totalCompletions: number;
}

export interface LevelCompletionResult
{
    stars: number;
    bestStars: number;
    newBest: boolean;
    unlockedLevelIndex: number | null;
    missions: LevelMissions;
    bestMissions: LevelMissions;
}

const createFreshProgress = (levelCount: number): ProgressSnapshot => ({
    version: SAVE_VERSION,
    unlocked: Array.from({ length: levelCount }, (_, index) => index === 0),
    completed: Array.from({ length: levelCount }, () => false),
    bestStars: Array.from({ length: levelCount }, () => 0),
    bestMissions: Array.from({ length: levelCount }, () => createEmptyMissions()),
    bestCollectibles: Array.from({ length: levelCount }, () => 0),
    totalCoinsCollected: 0,
    totalCompletions: 0
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const readBooleanArray = (value: unknown, length: number): boolean[] =>
{
    const source = Array.isArray(value) ? value : [];

    return Array.from({ length }, (_, index) => source[index] === true);
};

const readIntegerArray = (value: unknown, length: number, min: number, max: number): number[] =>
{
    const source = Array.isArray(value) ? value : [];

    return Array.from({ length }, (_, index) => {
        const rawValue = source[index];

        if (typeof rawValue !== 'number' || !Number.isFinite(rawValue))
        {
            return min;
        }

        return Math.max(min, Math.min(max, Math.floor(rawValue)));
    });
};

const readMissionArray = (value: unknown, length: number): LevelMissions[] =>
{
    const source = Array.isArray(value) ? value : [];

    return Array.from({ length }, (_, index) => normaliseMissions(source[index]));
};

const readNonNegativeInteger = (value: unknown, fallback = 0): number =>
{
    if (typeof value !== 'number' || !Number.isFinite(value))
    {
        return fallback;
    }

    return Math.max(0, Math.floor(value));
};

export class ProgressStore
{
    private readonly levelCount: number;
    private data: ProgressSnapshot;

    constructor ()
    {
        this.levelCount = LEVELS.length;
        this.data = this.load();
    }

    getSnapshot (): ProgressSnapshot
    {
        return {
            ...this.data,
            unlocked: [ ...this.data.unlocked ],
            completed: [ ...this.data.completed ],
            bestStars: [ ...this.data.bestStars ],
            bestMissions: this.data.bestMissions.map((missions) => ({ ...missions })),
            bestCollectibles: [ ...this.data.bestCollectibles ]
        };
    }

    isUnlocked (levelIndex: number): boolean
    {
        return this.data.unlocked[levelIndex] === true;
    }

    isCompleted (levelIndex: number): boolean
    {
        return this.data.completed[levelIndex] === true;
    }

    getBestStars (levelIndex: number): number
    {
        return this.data.bestStars[levelIndex] ?? 0;
    }

    getBestMissions (levelIndex: number): LevelMissions
    {
        const missions = this.data.bestMissions[levelIndex];

        return missions ? { ...missions } : createEmptyMissions();
    }

    getTotalStars (): number
    {
        return this.data.bestStars.reduce((total, stars) => total + stars, 0);
    }

    completeLevel (
        levelIndex: number,
        missions: LevelMissions,
        collected: number
    ): LevelCompletionResult
    {
        if (!Number.isInteger(levelIndex) || levelIndex < 0 || levelIndex >= this.levelCount)
        {
            return {
                stars: 0,
                bestStars: 0,
                newBest: false,
                unlockedLevelIndex: null,
                missions: createEmptyMissions(),
                bestMissions: createEmptyMissions()
            };
        }

        const attemptMissions = normaliseMissions(missions);
        const attemptStars = countStars(attemptMissions);
        const previousBest = this.data.bestStars[levelIndex] ?? 0;
        const previousMissions = this.data.bestMissions[levelIndex] ?? createEmptyMissions();
        const mergedMissions = mergeMissions(previousMissions, attemptMissions);
        const mergedStars = countStars(mergedMissions);
        const safeCollected = readNonNegativeInteger(collected);

        this.data.completed[levelIndex] = true;
        this.data.unlocked[levelIndex] = true;
        this.data.bestMissions[levelIndex] = mergedMissions;
        this.data.bestStars[levelIndex] = Math.max(previousBest, mergedStars);
        this.data.bestCollectibles[levelIndex] = Math.max(
            this.data.bestCollectibles[levelIndex] ?? 0,
            safeCollected
        );
        this.data.totalCoinsCollected += safeCollected;
        this.data.totalCompletions += 1;

        const nextIndex = levelIndex + 1;
        const unlockedLevelIndex = nextIndex < this.levelCount ? nextIndex : null;

        if (unlockedLevelIndex !== null)
        {
            this.data.unlocked[unlockedLevelIndex] = true;
        }

        this.save();

        return {
            stars: attemptStars,
            bestStars: this.data.bestStars[levelIndex],
            newBest: this.data.bestStars[levelIndex] > previousBest,
            unlockedLevelIndex,
            missions: attemptMissions,
            bestMissions: { ...mergedMissions }
        };
    }

    reset (): void
    {
        this.data = createFreshProgress(this.levelCount);

        try
        {
            window.localStorage.removeItem(SAVE_KEY);
        }
        catch
        {
            //  Jika localStorage tidak tersedia, state in-memory tetap aman.
        }
    }

    private load (): ProgressSnapshot
    {
        const fresh = createFreshProgress(this.levelCount);

        try
        {
            const raw = window.localStorage.getItem(SAVE_KEY);

            if (!raw)
            {
                return fresh;
            }

            const parsed: unknown = JSON.parse(raw);

            if (!isRecord(parsed))
            {
                return fresh;
            }

            const version = typeof parsed.version === 'number' ? parsed.version : 0;

            if (version === 1)
            {
                return this.migrateVersion1(parsed);
            }

            //  Versi yang lebih baru atau tidak dikenal tidak dipaksakan ke
            //  schema ini. Saat SAVE_VERSION naik, tambahkan migrasi di sini.
            if (version !== SAVE_VERSION)
            {
                return fresh;
            }

            return this.sanitise(parsed);
        }
        catch
        {
            //  JSON rusak, akses localStorage ditolak, atau quota error:
            //  jangan biarkan game crash; mulai dari progres awal.
            return fresh;
        }
    }

    private migrateVersion1 (raw: Record<string, unknown>): ProgressSnapshot
    {
        //  Save versi 1 hanya menyimpan jumlah bintang. Karena sistem baru
        //  memakai tiga misi, bintang lama dipetakan berurutan ke misi 1-3
        //  agar rekor lama tidak hilang. Save berikutnya memakai versi 2.
        const legacyStars = readIntegerArray(raw.bestStars, this.levelCount, 0, 3);
        const bestMissions = legacyStars.map((stars) => ({
            allCoins: stars >= 1,
            noDeath: stars >= 2,
            allEnemies: stars >= 3
        }));

        return this.sanitise({
            ...raw,
            version: SAVE_VERSION,
            bestMissions
        });
    }

    private sanitise (raw: Record<string, unknown>): ProgressSnapshot
    {
        const unlocked = readBooleanArray(raw.unlocked, this.levelCount);
        const completed = readBooleanArray(raw.completed, this.levelCount);
        const storedBestStars = readIntegerArray(raw.bestStars, this.levelCount, 0, 3);
        const bestMissions = readMissionArray(raw.bestMissions, this.levelCount);
        const bestCollectibles = readIntegerArray(
            raw.bestCollectibles,
            this.levelCount,
            0,
            Number.MAX_SAFE_INTEGER
        );
        const bestStars = [ ...storedBestStars ];

        //  Level pertama selalu terbuka. Rekor jumlah bintang dipertahankan
        //  walau data misi lama belum lengkap; misi diisi berurutan sebagai
        //  fallback supaya total bintang tidak turun.
        unlocked[0] = true;

        for (let index = 0; index < this.levelCount; index++)
        {
            const missionOrder: Array<keyof LevelMissions> = ['allCoins', 'noDeath', 'allEnemies'];
            let missionStars = countStars(bestMissions[index]);

            for (const mission of missionOrder)
            {
                if (missionStars >= storedBestStars[index])
                {
                    break;
                }

                if (!bestMissions[index][mission])
                {
                    bestMissions[index][mission] = true;
                    missionStars += 1;
                }
            }

            bestStars[index] = Math.max(storedBestStars[index], missionStars);

            if (bestStars[index] > 0)
            {
                completed[index] = true;
            }

            if (completed[index])
            {
                unlocked[index] = true;
            }
        }

        const fallbackCoins = bestCollectibles.reduce((total, value) => total + value, 0);

        return {
            version: SAVE_VERSION,
            unlocked,
            completed,
            bestStars,
            bestMissions,
            bestCollectibles,
            totalCoinsCollected: readNonNegativeInteger(
                raw.totalCoinsCollected,
                fallbackCoins
            ),
            totalCompletions: readNonNegativeInteger(
                raw.totalCompletions,
                completed.filter(Boolean).length
            )
        };
    }

    private save (): void
    {
        try
        {
            window.localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
        }
        catch
        {
            //  Gameplay tetap berjalan walaupun penyimpanan browser diblokir.
        }
    }
}

export const progressStore = new ProgressStore();
