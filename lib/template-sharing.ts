export interface SharedTemplate {
    name: string;
    notes: string;
}

export interface TemplatePack {
    version: 1;
    author: string;
    specialty: string;
    createdAt: string;
    templates: SharedTemplate[];
}

const CUSTOM_TEMPLATES_KEY = 'medinotes_custom_templates';

export function getCustomTemplates(): Record<string, SharedTemplate[]> {
    if (typeof window === 'undefined') return {};
    try {
        const data = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
        return data ? JSON.parse(data) : {};
    } catch {
        return {};
    }
}

export function saveCustomTemplate(specialty: string, template: SharedTemplate) {
    const all = getCustomTemplates();
    if (!all[specialty]) all[specialty] = [];
    all[specialty].push(template);
    localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(all));
}

export function removeCustomTemplate(specialty: string, name: string) {
    const all = getCustomTemplates();
    if (all[specialty]) {
        all[specialty] = all[specialty].filter(t => t.name !== name);
        if (all[specialty].length === 0) delete all[specialty];
        localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(all));
    }
}

export function exportTemplatePack(specialty: string, author: string, templates: SharedTemplate[]): void {
    const pack: TemplatePack = {
        version: 1,
        author,
        specialty,
        createdAt: new Date().toISOString(),
        templates,
    };
    const json = JSON.stringify(pack, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `templates-${specialty.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

export function importTemplatePack(file: File): Promise<TemplatePack> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const pack = JSON.parse(reader.result as string) as TemplatePack;
                if (pack.version !== 1 || !pack.specialty || !Array.isArray(pack.templates)) {
                    reject(new Error('Invalid template pack format'));
                    return;
                }
                // Save imported templates
                const all = getCustomTemplates();
                if (!all[pack.specialty]) all[pack.specialty] = [];
                for (const t of pack.templates) {
                    if (!all[pack.specialty].some(existing => existing.name === t.name)) {
                        all[pack.specialty].push(t);
                    }
                }
                localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(all));
                resolve(pack);
            } catch {
                reject(new Error('Failed to parse template file'));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}
