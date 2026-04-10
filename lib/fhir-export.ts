// FHIR R4 compatible export for EHR integration
// Can be imported into Epic, Cerner, and other FHIR-compatible systems

export interface ConsultationData {
    patientName: string;
    dateOfVisit: string;
    specialty: string;
    urgency: string;
    notes: string;
    summary: string;
}

export function toFHIRDocumentReference(data: ConsultationData) {
    const [firstName, ...lastParts] = data.patientName.split(' ');
    const lastName = lastParts.join(' ') || firstName;

    return {
        resourceType: 'Bundle',
        type: 'document',
        timestamp: new Date().toISOString(),
        entry: [
            {
                resource: {
                    resourceType: 'Patient',
                    name: [{
                        use: 'official',
                        family: lastName,
                        given: [firstName],
                    }],
                },
            },
            {
                resource: {
                    resourceType: 'DocumentReference',
                    status: 'current',
                    type: {
                        coding: [{
                            system: 'http://loinc.org',
                            code: '11488-4',
                            display: 'Consult note',
                        }],
                    },
                    date: new Date().toISOString(),
                    description: `${data.specialty} consultation - ${data.urgency}`,
                    content: [{
                        attachment: {
                            contentType: 'text/markdown',
                            data: btoa(unescape(encodeURIComponent(data.summary))),
                        },
                    }],
                    context: {
                        period: {
                            start: data.dateOfVisit,
                        },
                        practiceSetting: {
                            coding: [{
                                system: 'http://snomed.info/sct',
                                display: data.specialty,
                            }],
                        },
                    },
                },
            },
            {
                resource: {
                    resourceType: 'Encounter',
                    status: 'finished',
                    class: {
                        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
                        code: 'AMB',
                        display: 'ambulatory',
                    },
                    period: {
                        start: data.dateOfVisit,
                    },
                    reasonCode: [{
                        text: data.notes.slice(0, 200),
                    }],
                    priority: {
                        coding: [{
                            system: 'http://terminology.hl7.org/CodeSystem/v3-ActPriority',
                            code: data.urgency === 'emergency' ? 'EM' : data.urgency === 'urgent' ? 'UR' : 'R',
                            display: data.urgency,
                        }],
                    },
                },
            },
        ],
    };
}

export function downloadFHIRBundle(data: ConsultationData) {
    const bundle = toFHIRDocumentReference(data);
    const json = JSON.stringify(bundle, null, 2);
    const blob = new Blob([json], { type: 'application/fhir+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `consultation-${data.patientName.replace(/\s+/g, '-')}-${data.dateOfVisit}.fhir.json`;
    a.click();
    URL.revokeObjectURL(url);
}
