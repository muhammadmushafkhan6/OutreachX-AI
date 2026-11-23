class MapsSelectors:
    # Search Selectors
    SEARCH_INPUTS = [
        "input#searchboxinput",
        "input[aria-label='Search Google Maps']",
        "input[placeholder*='Search']",
        "input.searchboxinput"
    ]
    
    # Consent Selectors
    CONSENT_BUTTONS = [
        "button[aria-label='Accept all']",
        "button[aria-label='Agree']",
        "button:has-text('Accept all')",
        "button:has-text('I agree')",
        "div[role='dialog'] button:first-child"
    ]
    
    # Results Selectors
    RESULT_FEED = "div[role='feed']"
    BUSINESS_ARTICLE = "div[role='article']"
    
    # Extraction Selectors
    TITLE = "h1"
    CATEGORY = "button[data-value='Category']"
    ADDRESS = "button[data-item-id='address']"
    WEBSITE = "a[data-item-id='authority']"
    PHONE = "button[data-tooltip='Copy phone number']"
    RATING = "div.F7kYv div.fontBodyMedium span[aria-hidden='true']"
    REVIEWS = "div.F7kYv div.fontBodyMedium span[aria-label*='reviews']"
    
    CAPTCHA_INDICATORS = [
        "iframe[src*='recaptcha']",
        "div.g-recaptcha",
        "text='Please verify you are a human'"
    ]
