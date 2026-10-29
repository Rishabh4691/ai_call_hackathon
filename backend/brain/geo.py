import re

from .config import REGIONS
from .textutil import normalize

_ALIASES = {r: [normalize(a) for a in al] for r, al in REGIONS.items()}


def region_of_text(text):
    """Return the first region mentioned in free text (a user's words), or None."""
    t = normalize(text)
    for region, aliases in _ALIASES.items():
        for a in aliases:
            if re.search(r"(?<![a-z])" + re.escape(a) + r"(?![a-z])", t):
                return region
    return None


def region_of_city(city):
    """Region for a service's city field. Nationwide / network-wide entries have no region."""
    if not city:
        return None
    n = normalize(city)
    if "nationwide" in n or "unterfranken" in n or "main-rhon" in n:
        return None
    return region_of_text(city)
