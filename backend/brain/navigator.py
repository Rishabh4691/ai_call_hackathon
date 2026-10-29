"""Person B owns this file. Replace the stub with the RAG + LLM implementation.

Contract: see backend/contracts.py -> navigate().
"""


def navigate(session_id, history, user_text, language):
    # STUB so Person A and the frontend are never blocked.
    if not history:
        return {
            "reply_text": ("Pflegen Sie Ihre Mutter zu Hause?" if language == "de"
                           else "Do you care for your mother at home?"),
            "needs_more_info": True,
            "service": None,
        }
    return {
        "reply_text": ("Die Pflegeberatung für Angehörige passt am besten zu Ihnen."
                       if language == "de"
                       else "The care advice service for relatives fits you best."),
        "needs_more_info": False,
        "service": {
            "id": "svc_placeholder",
            "name": "Pflegeberatung für Angehörige (Platzhalter)",
            "why": ("Sie pflegen Ihre Mutter zu Hause. Diese Stelle berät pflegende Angehörige."
                    if language == "de"
                    else "You care for your mother at home. This service advises family carers."),
            "address": "Musterstraße 1, 97070 Würzburg",
            "phone": "+49 931 000000",
            "email": "info@example.org",
            "website": "https://example.org",
            "opening_hours": "Mo–Fr 9–12 Uhr",
            "languages": ["de", "en"],
        },
    }
