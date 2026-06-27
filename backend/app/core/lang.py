"""
Accept-Language parser for i18n.
Returns 'es' or 'en'. Handles formats: es, es-ES, en, en-US, en;q=0.9, etc.
"""


def parse_lang(accept_lang: str | None) -> str:
    if not accept_lang:
        return 'es'
    tag = accept_lang.split(',')[0].split(';')[0].strip().lower()[:2]
    return 'en' if tag == 'en' else 'es'
