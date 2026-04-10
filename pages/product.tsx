"use client"

import { useState, useRef, FormEvent } from 'react';
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

function ConsultationForm() {
    const { getToken } = useAuth();

    // Form state
    const [patientName, setPatientName] = useState('');
    const [visitDate, setVisitDate] = useState<Date | null>(new Date());
    const [notes, setNotes] = useState('');
    const [specialty, setSpecialty] = useState('General Practice');
    const [urgency, setUrgency] = useState<string>('routine');

    // Streaming state
    const [output, setOutput] = useState('');
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const outputRef = useRef<HTMLDivElement>(null);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setOutput('');
        setLoading(true);

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

                <div className="space-y-2">
                    <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Consultation Notes
                    </label>
                    <textarea
                        id="notes"
                        required
                        rows={8}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        placeholder="Enter detailed consultation notes..."
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
