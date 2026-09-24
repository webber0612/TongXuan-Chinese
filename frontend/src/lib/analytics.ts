// Privacy-Friendly Anonymous Telemetry for TongXuan Chinese
// Measurement ID: G-MEZ66PMRFH
// Strictly adheres to COPPA / GDPR-K youth privacy rules:
// - No PII (no names, emails, audio recordings, or stroke image uploads)
// - IP anonymization enabled
// - Ad personalization disabled
// - Pure functional & learning difficulty telemetry (e.g. level completion count, stars earned)

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

export const GA_MEASUREMENT_ID = 'G-MEZ66PMRFH';

let isInitialized = false;

export function initAnalytics(measurementId = GA_MEASUREMENT_ID): void {
  if (typeof window === 'undefined' || isInitialized) return;

  // Set up dataLayer and gtag function
  window.dataLayer = window.dataLayer || [];
  function gtag(...args: any[]) {
    window.dataLayer?.push(args);
  }
  window.gtag = gtag;

  // Insert gtag script
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  gtag('js', new Date());
  gtag('config', measurementId, {
    anonymize_ip: true,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    restricted_data_processing: true,
    send_page_view: true,
  });

  isInitialized = true;
}

export function trackEvent(eventName: string, params?: Record<string, any>): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag('event', eventName, params);
}

/**
 * Track when a user completes / passes a lesson or stage quiz
 * @param levelNumber e.g. 1, 10, 30
 * @param lessonTitle e.g. "第一關：日與月"
 * @param stars e.g. 1, 2, 3
 * @param score e.g. 100
 */
export function trackLevelPass(levelNumber: number, lessonTitle?: string, stars?: number, score?: number): void {
  trackEvent('level_complete', {
    level_number: levelNumber,
    lesson_title: lessonTitle || `Level ${levelNumber}`,
    stars_earned: stars || 3,
    score: score || 100,
  });

  // Track key milestones
  if (levelNumber === 1 || levelNumber === 5 || levelNumber === 10 || levelNumber === 20 || levelNumber === 30) {
    trackEvent(`milestone_level_${levelNumber}`, {
      level_number: levelNumber,
      stars: stars || 3,
    });
  }
}

/**
 * Track domain card selection (character, handwriting, phonetics, reading aloud)
 */
export function trackDomainSelect(domain: string): void {
  trackEvent('select_domain', {
    domain_name: domain,
  });
}

/**
 * Track script or phonetic toggle (Traditional/Simplified, Zhuyin/Pinyin)
 */
export function trackPreferenceChange(key: string, value: string): void {
  trackEvent('preference_change', {
    setting_key: key,
    setting_value: value,
  });
}

/**
 * Track reward coupon redemption in store
 */
export function trackRewardRedeem(itemName: string, starCost: number): void {
  trackEvent('reward_redeemed', {
    item_name: itemName,
    star_cost: starCost,
  });
}

/**
 * Track sponsor coffee link clicks
 */
export function trackDonationClick(): void {
  trackEvent('coffee_sponsor_click', {
    destination: 'buymeacoffee',
  });
}

/**
 * Track feedback & bug report form clicks
 */
export function trackFeedbackClick(): void {
  trackEvent('feedback_form_click', {
    destination: 'google_forms',
  });
}
