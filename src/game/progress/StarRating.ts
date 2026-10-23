export interface LevelMissions
{
    allCoins: boolean;
    noDeath: boolean;
    allEnemies: boolean;
}

export const createEmptyMissions = (): LevelMissions => ({
    allCoins: false,
    noDeath: false,
    allEnemies: false
});

export const normaliseMissions = (value: unknown): LevelMissions =>
{
    const record = typeof value === 'object' && value !== null
        ? value as Record<string, unknown>
        : {};

    return {
        allCoins: record.allCoins === true,
        noDeath: record.noDeath === true,
        allEnemies: record.allEnemies === true
    };
};

export const mergeMissions = (
    base: LevelMissions,
    update: LevelMissions
): LevelMissions => ({
    allCoins: base.allCoins || update.allCoins,
    noDeath: base.noDeath || update.noDeath,
    allEnemies: base.allEnemies || update.allEnemies
});

/**
 * Setiap misi adalah satu bintang. Tidak ada rating persentase di sini:
 * bintang hanya dihitung dari misi yang benar-benar selesai.
 */
export const countStars = (missions: Partial<LevelMissions> | null | undefined): number =>
{
    const safe = normaliseMissions(missions);

    return (safe.allCoins ? 1 : 0)
        + (safe.noDeath ? 1 : 0)
        + (safe.allEnemies ? 1 : 0);
};

export const formatStars = (stars: number, total = 3): string =>
{
    const safeTotal = Number.isFinite(total) ? Math.max(1, Math.floor(total)) : 3;
    const safeStars = Number.isFinite(stars)
        ? Math.max(0, Math.min(safeTotal, Math.floor(stars)))
        : 0;

    return '★'.repeat(safeStars) + '☆'.repeat(safeTotal - safeStars);
};
