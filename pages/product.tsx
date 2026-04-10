"use client"

import { useState, useRef, useEffect, FormEvent } from 'react';
import { useAuth } from '@clerk/nextjs';
import DatePicker from 'react-datepicker';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { Protect, PricingTable, UserButton } from '@clerk/nextjs';

const SPECIALTIES = [
    'General Practice',
    'Cardiology',
    'Pediatrics',
    'Psychiatry',
    'Orthopedics',
    'Dermatology',
];

const URGENCY_LEVELS = [
    { value: 'routine', label: 'Routine', color: 'bg-green-100 text-green-800 border-green-300' },
    { value: 'urgent', label: 'Urgent', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
    { value: 'emergency', label: 'Emergency', color: 'bg-red-100 text-red-800 border-red-300' },
];

const LANGUAGES = [
    'English', 'Spanish', 'French', 'German', 'Portuguese',
    'Chinese', 'Japanese', 'Korean', 'Arabic', 'Hindi',
    'Turkish', 'Russian', 'Italian', 'Dutch', 'Polish',
];

const TEMPLATES: Record<string, { name: string; notes: string }[]> = {
    'General Practice': [
        {
            name: 'Annual Physical',
            notes: 'Annual wellness exam. Vitals: BP 120/80, HR 72, Temp 98.6F. BMI 24.5. General appearance normal. Heart and lungs clear. No abnormalities noted. Labs ordered: CBC, CMP, Lipid panel, A1C. Due for flu vaccine and tetanus booster.',
        },
        {
            name: 'Upper Respiratory Infection',
            notes: 'Patient presents with 3-day history of nasal congestion, sore throat, mild cough. No fever. Lungs clear bilateral. Throat mildly erythematous. No exudates. Likely viral URI. Recommend rest, fluids, OTC symptomatic relief. Return if symptoms worsen or fever develops.',
        },
        {
            name: 'Hypertension Follow-up',
            notes: 'Follow-up for hypertension management. Current meds: Lisinopril 10mg daily. BP today 138/88. Home readings averaging 135/85. Discussed lifestyle modifications including sodium restriction and exercise. Increasing Lisinopril to 20mg daily. Recheck in 4 weeks.',
        },
    ],
    'Cardiology': [
        {
            name: 'Chest Pain Evaluation',
            notes: 'Patient reports intermittent chest tightness with exertion, relieved by rest. No radiation to arm or jaw. No shortness of breath at rest. ECG shows normal sinus rhythm, no ST changes. Troponin negative. Ordering stress test and echocardiogram. Started on aspirin 81mg daily.',
        },
        {
            name: 'Heart Failure Follow-up',
            notes: 'CHF follow-up. NYHA Class II. Current meds: Metoprolol 50mg BID, Lisinopril 20mg, Furosemide 40mg. Weight stable. No peripheral edema. Lungs clear. BNP 250. Echo shows EF 35%, unchanged. Continue current regimen. Consider adding spironolactone.',
        },
    ],
    'Pediatrics': [
        {
            name: 'Well-Child Visit (2 years)',
            notes: 'Well-child visit, 2-year-old. Weight 28 lbs (50th percentile), Height 34 inches (55th percentile). Meeting developmental milestones: speaks 50+ words, runs well, kicks ball. Immunizations up to date. Administered Hep A vaccine. Normal exam. Next visit at 30 months.',
        },
        {
            name: 'Ear Infection',
            notes: 'Child presents with right ear pain x2 days, low-grade fever 100.4F. Right TM erythematous and bulging. Left ear clear. Throat normal. Diagnosis: acute otitis media, right ear. Prescribed Amoxicillin 250mg TID x10 days. Tylenol for pain. Follow up if no improvement in 48-72 hours.',
        },
    ],
    'Psychiatry': [
        {
            name: 'Depression Follow-up',
            notes: 'Follow-up for major depressive disorder. PHQ-9 score: 12 (moderate). Patient reports improved sleep with trazodone but persistent low mood and anhedonia. Currently on Sertraline 100mg. Increasing to 150mg. Continue weekly therapy. No suicidal ideation. Safety plan reviewed.',
        },
        {
            name: 'Anxiety Assessment',
            notes: 'Initial evaluation for generalized anxiety. GAD-7 score: 15 (severe). Patient reports persistent worry, difficulty concentrating, muscle tension, poor sleep for 6+ months. No panic attacks. No substance use. Starting Buspirone 5mg TID, titrate to 10mg TID. Referral for CBT.',
        },
    ],
    'Orthopedics': [
        {
            name: 'Knee Pain Evaluation',
            notes: 'Right knee pain x6 weeks, worse with stairs and prolonged sitting. No locking or giving way. Exam: mild effusion, positive patellar grind test, full ROM. McMurray negative. X-ray shows mild patellofemoral joint narrowing. Diagnosis: patellofemoral syndrome. PT referral, NSAIDs, quad strengthening exercises.',
        },
    ],
    'Dermatology': [
        {
            name: 'Suspicious Mole',
            notes: 'Patient presents with changing mole on upper back. Lesion 8mm, asymmetric, irregular borders, variegated color (brown/black). ABCDE criteria positive. Performed shave biopsy, sent to pathology. Discussed sun protection. Will call with results in 5-7 business days.',
        },
    ],
};

function ConsultationForm() {
    const { getToken } = useAuth();

    // Form state
    const [patientName, setPatientName] = useState('');
    const [visitDate, setVisitDate] = useState<Date | null>(new Date());
    const [notes, setNotes] = useState('');
    const [specialty, setSpecialty] = useState('General Practice');
    const [urgency, setUrgency] = useState<string>('routine');
    const [emailLanguage, setEmailLanguage] = useState('English');

    // Streaming state
    const [output, setOutput] = useState('');
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const outputRef = useRef<HTMLDivElement>(null);

    // Voice input state
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<SpeechRecognition | null>(null);

    // Template state
    const [showTemplates, setShowTemplates] = useState(false);
    const templates = TEMPLATES[specialty] || [];

    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, []);

    function toggleVoiceInput() {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('Voice input is not supported in this browser. Try Chrome or Edge.');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        let finalTranscript = notes;

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += (finalTranscript ? ' ' : '') + transcript;
                    setNotes(finalTranscript);
                } else {
                    interim += transcript;
                }
            }
            if (interim) {
                setNotes(finalTranscript + (finalTranscript ? ' ' : '') + interim);
            }
        };

        recognition.onerror = () => {
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
        setIsListening(true);
    }

    function applyTemplate(template: { name: string; notes: string }) {
        setNotes(template.notes);
        setShowTemplates(false);
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setOutput('');
        setLoading(true);

        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
        }

        const jwt = await getToken();
        if (!jwt) {
            setOutput('Authentication required');
            setLoading(false);
            return;
        }

        const controller = new AbortController();
        let buffer = '';

        const apiUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:8000/api' : '/api';
        await fetchEventSource(apiUrl, {
            signal: controller.signal,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jwt}`,
            },
            body: JSON.stringify({
                patient_name: patientName,
                date_of_visit: visitDate?.toISOString().slice(0, 10),
                notes,
                specialty,
                urgency,
                email_language: emailLanguage,
            }),
            onmessage(ev) {
                if (ev.data === '[DONE]') return;
                try {
                    buffer += JSON.parse(ev.data);
                } catch {
                    buffer += ev.data;
                }
                setOutput(buffer);
            },
            onclose() {
                setLoading(false);
            },
            onerror(err) {
                console.error('SSE error:', err);
                controller.abort();
                setLoading(false);
            },
        });
    }

    function extractEmailSection(text: string): string {
        const emailHeader = '### Draft of email to patient';
        const idx = text.toLowerCase().indexOf(emailHeader.toLowerCase());
        if (idx === -1) {
            const altIdx = text.indexOf('### Draft of email');
            if (altIdx === -1) return text;
            return text.slice(altIdx);
        }
        return text.slice(idx);
    }

    async function handleCopyEmail() {
        const email = extractEmailSection(output);
        await navigator.clipboard.writeText(email);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    async function handleCopyAll() {
        await navigator.clipboard.writeText(output);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    function handlePrint() {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        const html = outputRef.current?.innerHTML || '';
        printWindow.document.write(`
            <html><head><title>Consultation Summary - ${patientName}</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; }
                h3 { color: #1e40af; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
                ul { padding-left: 20px; }
                li { margin: 4px 0; }
                p { line-height: 1.6; }
            </style></head>
            <body>
                <h2>Consultation Summary</h2>
                <p><strong>Patient:</strong> ${patientName} | <strong>Date:</strong> ${visitDate?.toISOString().slice(0, 10)} | <strong>Specialty:</strong> ${specialty} | <strong>Urgency:</strong> ${urgency}</p>
                <hr/>
                ${html}
            </body></html>
        `);
        printWindow.document.close();
        printWindow.print();
    }

    return (
        <div className="container mx-auto px-4 py-12 max-w-3xl">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-8">
                Consultation Notes
            </h1>

            <form onSubmit={handleSubmit} className="space-y-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label htmlFor="patient" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Patient Name
                        </label>
                        <input
                            id="patient"
                            type="text"
                            required
                            value={patientName}
                            onChange={(e) => setPatientName(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                            placeholder="Enter patient's full name"
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Date of Visit
                        </label>
                        <DatePicker
                            id="date"
                            selected={visitDate}
                            onChange={(d: Date | null) => setVisitDate(d)}
                            dateFormat="yyyy-MM-dd"
                            placeholderText="Select date"
                            required
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label htmlFor="specialty" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Specialty
                        </label>
                        <select
                            id="specialty"
                            value={specialty}
                            onChange={(e) => setSpecialty(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        >
                            {SPECIALTIES.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Urgency Level
                        </label>
                        <div className="flex gap-2">
                            {URGENCY_LEVELS.map((level) => (
                                <button
                                    key={level.value}
                                    type="button"
                                    onClick={() => setUrgency(level.value)}
                                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                                        urgency === level.value
                                            ? level.color + ' ring-2 ring-offset-1 ring-blue-500'
                                            : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-100'
                                    }`}
                                >
                                    {level.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Email Language */}
                <div className="space-y-2">
                    <label htmlFor="language" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Patient Email Language
                    </label>
                    <select
                        id="language"
                        value={emailLanguage}
                        onChange={(e) => setEmailLanguage(e.target.value)}
                        className="w-full md:w-1/2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    >
                        {LANGUAGES.map((lang) => (
                            <option key={lang} value={lang}>{lang}</option>
                        ))}
                    </select>
                    {emailLanguage !== 'English' && (
                        <p className="text-xs text-blue-600 dark:text-blue-400">
                            Summary and next steps will remain in English. Patient email will be in {emailLanguage}.
                        </p>
                    )}
                </div>

                {/* Notes with voice input and templates */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Consultation Notes
                        </label>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setShowTemplates(!showTemplates)}
                                className="text-xs px-3 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            >
                                Templates
                            </button>
                            <button
                                type="button"
                                onClick={toggleVoiceInput}
                                className={`text-xs px-3 py-1 rounded-md transition-colors ${
                                    isListening
                                        ? 'bg-red-100 text-red-700 animate-pulse'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                            >
                                {isListening ? 'Stop Dictation' : 'Dictate'}
                            </button>
                        </div>
                    </div>

                    {/* Template selector */}
                    {showTemplates && templates.length > 0 && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 space-y-2">
                            <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
                                Select a template for {specialty}:
                            </p>
                            {templates.map((t) => (
                                <button
                                    key={t.name}
                                    type="button"
                                    onClick={() => applyTemplate(t)}
                                    className="block w-full text-left px-3 py-2 rounded-md bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 text-sm text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                                >
                                    <span className="font-medium">{t.name}</span>
                                    <span className="block text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                        {t.notes.slice(0, 80)}...
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                    {showTemplates && templates.length === 0 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                            No templates available for {specialty} yet.
                        </p>
                    )}

                    {isListening && (
                        <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                            <span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                            Listening... Speak your consultation notes.
                        </div>
                    )}

                    <textarea
                        id="notes"
                        required
                        rows={8}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        placeholder="Enter detailed consultation notes or use dictation..."
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
                >
                    {loading ? 'Generating Summary...' : 'Generate Summary'}
                </button>
            </form>

            {output && (
                <section className="mt-8 bg-gray-50 dark:bg-gray-800 rounded-xl shadow-lg p-8">
                    {/* Export buttons */}
                    <div className="flex gap-3 mb-6 flex-wrap">
                        <button
                            onClick={handleCopyEmail}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                        >
                            {copied ? 'Copied!' : 'Copy Email Draft'}
                        </button>
                        <button
                            onClick={handleCopyAll}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                        >
                            Copy All
                        </button>
                        <button
                            onClick={handlePrint}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                        >
                            Print / Save PDF
                        </button>
                    </div>

                    <div ref={outputRef} className="markdown-content prose prose-blue dark:prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                            {output}
                        </ReactMarkdown>
                    </div>
                </section>
            )}
        </div>
    );
}

export default function Product() {
    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
            {/* User Menu in Top Right */}
            <div className="absolute top-4 right-4">
                <UserButton showName={true} />
            </div>

            {/* Subscription Protection */}
            <Protect
                plan="premium_subscription"
                fallback={
                    <div className="container mx-auto px-4 py-12">
                        <header className="text-center mb-12">
                            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-4">
                                Healthcare Professional Plan
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400 text-lg mb-8">
                                Streamline your patient consultations with AI-powered summaries
                            </p>
                        </header>
                        <div className="max-w-4xl mx-auto">
                            <PricingTable />
                        </div>
                    </div>
                }
            >
                <ConsultationForm />
            </Protect>
        </main>
    );
}
