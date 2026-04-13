import json
import os
from fastapi import FastAPI, Depends
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi_clerk_auth import ClerkConfig, ClerkHTTPBearer, HTTPAuthorizationCredentials
from openai import OpenAI

app = FastAPI()

# Add CORS middleware (allows frontend to call backend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Clerk authentication setup
clerk_config = ClerkConfig(jwks_url=os.getenv("CLERK_JWKS_URL"))
clerk_guard = ClerkHTTPBearer(clerk_config)


class Visit(BaseModel):
    patient_name: str
    date_of_visit: str
    notes: str
    specialty: str = "General Practice"
    urgency: str = "routine"
    email_language: str = "English"


default_system_prompt = """
You are provided with notes written by a doctor from a patient's visit.
Your job is to summarize the visit for the doctor and provide an email.
Reply with exactly three sections with the headings:
### Summary of visit for the doctor's records
### Next steps for the doctor
### Draft of email to patient in patient-friendly language
"""

specialty_prompts = {
    "General Practice": default_system_prompt,
    "Cardiology": """
You are provided with notes written by a cardiologist from a patient's visit.
Focus on cardiac symptoms, cardiovascular health indicators, and heart-related conditions.
Include relevant cardiac metrics and risk factors in the summary.
Reply with exactly three sections with the headings:
### Summary of visit for the doctor's records
### Next steps for the doctor
### Draft of email to patient in patient-friendly language
""",
    "Pediatrics": """
You are provided with notes written by a pediatrician from a patient's visit.
Use child-friendly and parent-friendly language in patient communications.
Include developmental milestones and age-appropriate considerations.
Reply with exactly three sections with the headings:
### Summary of visit for the doctor's records
### Next steps for the doctor
### Draft of email to patient's parents in parent-friendly language
""",
    "Psychiatry": """
You are provided with notes written by a psychiatrist from a patient's visit.
Include mental health considerations, therapeutic progress, and relevant resources.
Use sensitive, non-stigmatizing language in patient communications.
Reply with exactly three sections with the headings:
### Summary of visit for the doctor's records
### Next steps for the doctor
### Draft of email to patient in supportive, patient-friendly language
""",
    "Orthopedics": """
You are provided with notes written by an orthopedic specialist from a patient's visit.
Focus on musculoskeletal findings, mobility assessments, and rehabilitation plans.
Reply with exactly three sections with the headings:
### Summary of visit for the doctor's records
### Next steps for the doctor
### Draft of email to patient in patient-friendly language
""",
    "Dermatology": """
You are provided with notes written by a dermatologist from a patient's visit.
Focus on skin conditions, lesion descriptions, and treatment protocols.
Reply with exactly three sections with the headings:
### Summary of visit for the doctor's records
### Next steps for the doctor
### Draft of email to patient in patient-friendly language
""",
}


def get_system_prompt(specialty: str, urgency: str, email_language: str) -> str:
    base = specialty_prompts.get(specialty, default_system_prompt)
    if urgency == "urgent":
        base += "\nNote: This is an URGENT case. Prioritize immediate action items and flag time-sensitive follow-ups."
    elif urgency == "emergency":
        base += "\nNote: This is an EMERGENCY case. Highlight critical actions required immediately and escalation steps."
    if email_language != "English":
        base += f"\nIMPORTANT: Write the patient email section in {email_language}. Keep the summary and next steps in English."
    return base


def user_prompt_for(visit: Visit) -> str:
    return f"""Create the summary, next steps and draft email for:
Patient Name: {visit.patient_name}
Date of Visit: {visit.date_of_visit}
Specialty: {visit.specialty}
Urgency: {visit.urgency}
Notes:
{visit.notes}"""


@app.post("/api/consultation")
def consultation_summary(
    visit: Visit,
    creds: HTTPAuthorizationCredentials = Depends(clerk_guard),
):
    client = OpenAI()

    sys_prompt = get_system_prompt(visit.specialty, visit.urgency, visit.email_language)
    user_prompt = user_prompt_for(visit)

    prompt = [
        {"role": "system", "content": sys_prompt},
        {"role": "user", "content": user_prompt},
    ]

    stream = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=prompt,
        stream=True,
    )

    def event_stream():
        for chunk in stream:
            text = chunk.choices[0].delta.content
            if text:
                yield f"data: {json.dumps(text)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/health")
def health_check():
    """Health check endpoint for AWS App Runner"""
    return {"status": "healthy"}


