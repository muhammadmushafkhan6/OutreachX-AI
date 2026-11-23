import re
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from app.services.scraper.phone_utils import extract_phone_candidates_from_text, filter_and_format_phones

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
OBFUSCATED_EMAIL_RE = re.compile(
    r"([a-zA-Z0-9._%+-]+)\s*(?:@|\[at\]|\(at\)|&#64;)\s*([a-zA-Z0-9.-]+)\s*(?:\.|\[dot\]|\(dot\))\s*([a-zA-Z]{2,})",
    re.I,
)
JUNK_EMAIL_DOMAINS = frozenset(
    {"example.com", "email.com", "test.com", "domain.com", "yoursite.com", "sentry.io", "wixpress.com"}
)
SOCIAL_DOMAINS = {
    "linkedin.com": "linkedin",
    "twitter.com": "twitter",
    "x.com": "twitter",
    "facebook.com": "facebook",
    "instagram.com": "instagram",
    "youtube.com": "youtube",
}
TECH_KEYWORDS = [
    "wordpress", "shopify", "react", "vue", "angular", "next.js", "hubspot",
    "google analytics", "gtm", "stripe", "woocommerce", "webflow", "squarespace",
]


class HTMLParser:
    """Parse HTML and extract business information."""

    def parse(self, html: str, base_url: str) -> dict:
        soup = BeautifulSoup(html, "lxml")
        cleaned = self.clean_html(soup)

        title = soup.title.string.strip() if soup.title and soup.title.string else None
        meta_desc = ""
        meta = soup.find("meta", attrs={"name": re.compile("description", re.I)})
        if meta and meta.get("content"):
            meta_desc = meta["content"].strip()

        text = cleaned.get_text(separator=" ", strip=True)
        emails = self._extract_emails(soup, html)
        phones = self._extract_phones(soup, text, html)

        social = self._extract_social(soup, base_url)
        services = self._extract_services(text)
        contact_pages = self._extract_contact_links(soup, base_url)
        tech_stack = self._detect_tech(html.lower())
        company_name = self._guess_company_name(soup, title)
        pricing = self._extract_pricing(text)

        return {
            "company_name": company_name,
            "title": title,
            "meta_description": meta_desc,
            "emails": emails[:20],
            "phones": phones[:10],
            "social_links": social,
            "services": services,
            "pricing": pricing,
            "contact_pages": contact_pages,
            "business_text": text[:5000],
            "tech_stack": tech_stack,
            "cleaned_html": str(cleaned),
        }

    def clean_html(self, soup: BeautifulSoup) -> BeautifulSoup:
        for tag in soup(["script", "style", "noscript", "iframe", "svg"]):
            tag.decompose()
        for selector in ["[class*='ad-']", "[id*='ad-']", ".advertisement", ".adsbygoogle"]:
            for el in soup.select(selector):
                el.decompose()
        return soup

    def _extract_social(self, soup: BeautifulSoup, base_url: str) -> dict[str, str]:
        links: dict[str, str] = {}
        for a in soup.find_all("a", href=True):
            href = urljoin(base_url, a["href"])
            for domain, name in SOCIAL_DOMAINS.items():
                if domain in href and name not in links:
                    links[name] = href
        return links

    def _extract_services(self, text: str) -> list[str]:
        keywords = [
            "seo", "web design", "development", "marketing", "branding",
            "paid ads", "ppc", "content marketing", "social media", "consulting",
        ]
        found = []
        lower = text.lower()
        for kw in keywords:
            if kw in lower:
                found.append(kw.title())
        return list(dict.fromkeys(found))[:15]

    def _extract_emails(self, soup: BeautifulSoup, html: str) -> list[str]:
        found: set[str] = set(EMAIL_RE.findall(html))
        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            if href.lower().startswith("mailto:"):
                addr = href[7:].split("?")[0].strip()
                if addr:
                    found.add(addr)
        for m in OBFUSCATED_EMAIL_RE.finditer(html):
            found.add(f"{m.group(1)}@{m.group(2)}.{m.group(3)}".lower())
        return self.filter_emails(list(found))

    def _extract_phones(self, soup: BeautifulSoup, text: str, html: str) -> list[str]:
        found: list[str] = []
        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            if href.lower().startswith("tel:"):
                found.append(href)
        for tag in soup.select('[itemprop="telephone"], [class*="phone"], [class*="tel"]'):
            t = tag.get_text(" ", strip=True)
            if t and re.search(r"\d", t):
                found.append(t)
        found.extend(extract_phone_candidates_from_text(html))
        # Short contact/footer snippets only (not full page — avoids garbage numbers)
        for tag in soup.select("footer, [class*='contact'], [class*='footer'], address"):
            snippet = tag.get_text(" ", strip=True)[:3000]
            found.extend(extract_phone_candidates_from_text(snippet))
        return self.filter_phones(found)

    @staticmethod
    def filter_emails(emails: list[str]) -> list[str]:
        out: list[str] = []
        for raw in emails:
            e = raw.strip().lower()
            if "@" not in e or len(e) > 254:
                continue
            domain = e.split("@")[-1]
            if domain in JUNK_EMAIL_DOMAINS or domain.endswith(".png") or domain.endswith(".jpg"):
                continue
            if e.startswith("noreply@") or e.startswith("no-reply@"):
                continue
            if e not in out:
                out.append(e)
        return out[:20]

    @staticmethod
    def filter_phones(phones: list[str]) -> list[str]:
        return filter_and_format_phones(phones)

    def _extract_contact_links(self, soup: BeautifulSoup, base_url: str) -> list[str]:
        keywords = (
            "contact",
            "get-in-touch",
            "quote",
            "book",
            "about",
            "support",
            "help",
            "customer",
            "reach",
        )
        pages = []
        for a in soup.find_all("a", href=True):
            href = a["href"].lower()
            label = (a.get_text() or "").lower()
            if any(k in href for k in keywords) or any(k in label for k in keywords):
                pages.append(urljoin(base_url, a["href"]))
        return list(dict.fromkeys(pages))[:15]

    def _detect_tech(self, html_lower: str) -> list[str]:
        return [t.title() for t in TECH_KEYWORDS if t in html_lower]

    def _guess_company_name(self, soup: BeautifulSoup, title: str | None) -> str | None:
        og = soup.find("meta", property="og:site_name")
        if og and og.get("content"):
            return og["content"].strip()
        if title:
            return title.split("|")[0].split("-")[0].strip()
        h1 = soup.find("h1")
        if h1:
            return h1.get_text(strip=True)[:200]
        return None

    def _extract_pricing(self, text: str) -> str | None:
        match = re.search(r"\$[\d,]+(?:\s*/\s*(?:mo|month|year))?", text, re.I)
        return match.group(0) if match else None
