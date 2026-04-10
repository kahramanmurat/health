export interface ConsultationRecord {
    id: string;
    timestamp: number;
    specialty: string;
    urgency: string;
    emailLanguage: string;
    generationTimeMs: number;
}

const STORAGE_KEY = 'medinotes_analytics';

function getRecords(): ConsultationRecord[] {
    if (typeof window === 'undefined') return [];
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

function saveRecords(records: ConsultationRecord[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function trackConsultation(record: Omit<ConsultationRecord, 'id' | 'timestamp'>) {
    const records = getRecords();
    records.push({
        ...record,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
    });
    saveRecords(records);
}

export interface AnalyticsSummary {
    totalConsultations: number;
    totalTimeSavedMinutes: number;
    bySpecialty: Record<string, number>;
    byUrgency: Record<string, number>;
    byLanguage: Record<string, number>;
    avgGenerationTimeSec: number;
    last7Days: number;
    last30Days: number;
}

export function getAnalytics(): AnalyticsSummary {
    const records = getRecords();
    const now = Date.now();
    const day7 = now - 7 * 24 * 60 * 60 * 1000;
    const day30 = now - 30 * 24 * 60 * 60 * 1000;

    const bySpecialty: Record<string, number> = {};
    const byUrgency: Record<string, number> = {};
    const byLanguage: Record<string, number> = {};
    let totalGenTime = 0;

    for (const r of records) {
        bySpecialty[r.specialty] = (bySpecialty[r.specialty] || 0) + 1;
        byUrgency[r.urgency] = (byUrgency[r.urgency] || 0) + 1;
        byLanguage[r.emailLanguage] = (byLanguage[r.emailLanguage] || 0) + 1;
        totalGenTime += r.generationTimeMs;
    }

    // Estimate: each consultation saves ~15 min of manual documentation
    const timeSaved = records.length * 15;

    return {
        totalConsultations: records.length,
        totalTimeSavedMinutes: timeSaved,
        bySpecialty,
        byUrgency,
        byLanguage,
        avgGenerationTimeSec: records.length > 0 ? Math.round(totalGenTime / records.length / 1000) : 0,
        last7Days: records.filter(r => r.timestamp > day7).length,
        last30Days: records.filter(r => r.timestamp > day30).length,
    };
}

export function clearAnalytics() {
    localStorage.removeItem(STORAGE_KEY);
}
