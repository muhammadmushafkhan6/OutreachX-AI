"""Maps scraper package. Submodules import lazily to avoid optional deps (playwright) at startup."""

__all__ = ["MapsScraperV2", "BrowserManager", "MapsSelectors", "GoogleMapsScraperV3"]


def __getattr__(name: str):
    if name == "MapsScraperV2":
        from .scraper import MapsScraperV2

        return MapsScraperV2
    if name == "BrowserManager":
        from .browser_manager import BrowserManager

        return BrowserManager
    if name == "MapsSelectors":
        from .selectors import MapsSelectors

        return MapsSelectors
    if name == "GoogleMapsScraperV3":
        from .scraper_v3 import GoogleMapsScraperV3

        return GoogleMapsScraperV3
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
