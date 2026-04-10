"use client"

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { getAnalytics, clearAnalytics, type AnalyticsSummary } from '../lib/analytics';

export default function Analytics() {
    const [stats, setStats] = useState<AnalyticsSummary | null>(null);

    useEffect(() => {
        setStats(getAnalytics());
    }, []);

    function handleClear() {
        if (confirm('Clear all analytics data? This cannot be undone.')) {
            clearAnalytics();
            setStats(getAnalytics());
        }
    }

    if (!stats) return null;

    const topSpecialties = Object.entries(stats.bySpecialty)
        .sort(([, a], [, b]) => b - a);

    const topLanguages = Object.entries(stats.byLanguage)
        .sort(([, a], [, b]) => b - a);

    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
            <div className="absolute top-4 right-4">
                <UserButton showName={true} />
            </div>

            <div className="container mx-auto px-4 py-12 max-w-4xl">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
                        Analytics
                    </h1>
                    <Link
                        href="/product"
                        className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                        Back to Consultations
                    </Link>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 text-center">
                        <p className="text-3xl font-bold text-blue-600">{stats.totalConsultations}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Total Consultations</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 text-center">
                        <p className="text-3xl font-bold text-green-600">{stats.totalTimeSavedMinutes}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Minutes Saved</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 text-center">
                        <p className="text-3xl font-bold text-purple-600">{stats.last7Days}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Last 7 Days</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 text-center">
                        <p className="text-3xl font-bold text-orange-600">{stats.avgGenerationTimeSec}s</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Avg Generation</p>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    {/* By Specialty */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">By Specialty</h2>
                        {topSpecialties.length === 0 ? (
                            <p className="text-sm text-gray-500">No data yet</p>
                        ) : (
                            <div className="space-y-3">
                                {topSpecialties.map(([name, count]) => (
                                    <div key={name}>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-gray-700 dark:text-gray-300">{name}</span>
                                            <span className="text-gray-500">{count}</span>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                            <div
                                                className="bg-blue-600 h-2 rounded-full"
                                                style={{ width: `${(count / stats.totalConsultations) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* By Urgency */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">By Urgency</h2>
                        {Object.keys(stats.byUrgency).length === 0 ? (
                            <p className="text-sm text-gray-500">No data yet</p>
                        ) : (
                            <div className="space-y-3">
                                {Object.entries(stats.byUrgency).map(([level, count]) => {
                                    const colors: Record<string, string> = {
                                        routine: 'bg-green-500',
                                        urgent: 'bg-yellow-500',
                                        emergency: 'bg-red-500',
                                    };
                                    return (
                                        <div key={level}>
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="text-gray-700 dark:text-gray-300 capitalize">{level}</span>
                                                <span className="text-gray-500">{count}</span>
                                            </div>
                                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                                <div
                                                    className={`${colors[level] || 'bg-gray-500'} h-2 rounded-full`}
                                                    style={{ width: `${(count / stats.totalConsultations) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* By Language */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Email Languages</h2>
                        {topLanguages.length === 0 ? (
                            <p className="text-sm text-gray-500">No data yet</p>
                        ) : (
                            <div className="space-y-2">
                                {topLanguages.map(([lang, count]) => (
                                    <div key={lang} className="flex justify-between text-sm">
                                        <span className="text-gray-700 dark:text-gray-300">{lang}</span>
                                        <span className="text-gray-500">{count}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Time Saved */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Time Saved</h2>
                        <div className="text-center py-4">
                            <p className="text-5xl font-bold text-green-600">
                                {Math.round(stats.totalTimeSavedMinutes / 60 * 10) / 10}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">hours saved</p>
                            <p className="text-xs text-gray-400 mt-4">
                                Based on ~15 min saved per consultation vs manual documentation
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-8 text-center">
                    <button
                        onClick={handleClear}
                        className="text-xs text-red-500 hover:text-red-700 transition-colors"
                    >
                        Clear Analytics Data
                    </button>
                </div>
            </div>
        </main>
    );
}
