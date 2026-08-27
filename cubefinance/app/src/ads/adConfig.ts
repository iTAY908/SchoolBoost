// ============================================================================
// AdMob configuration.
//
// IMPORTANT: in development we ALWAYS serve Google's official test ads.
// Clicking or even repeatedly loading your real ad units on a dev device is
// "invalid traffic" and is one of the fastest ways to get an AdMob account
// suspended. The real unit is used only in release builds.
// ============================================================================
import { Platform } from 'react-native';
import { TestIds } from 'react-native-google-mobile-ads';

/** Your AdMob application ID (also declared in app.json → the config plugin). */
export const ADMOB_APP_ID = 'ca-app-pub-8901066122989701~1639827795';

/** Your production interstitial ad unit. */
const INTERSTITIAL_UNIT_PROD = 'ca-app-pub-8901066122989701/4541323300';

/**
 * The unit the app actually requests.
 * __DEV__ is true in Metro/dev builds and false in release builds.
 */
export const INTERSTITIAL_AD_UNIT_ID = __DEV__
  ? TestIds.INTERSTITIAL
  : INTERSTITIAL_UNIT_PROD;

/** How much *foreground* time passes between interstitials. */
export const AD_INTERVAL_MS = 6 * 60 * 1000; // 360,000 ms — 6 minutes

/**
 * Minimum gap enforced between two interstitials, whatever the timer says.
 * Guards against a burst if the timer is resumed/fired more than once.
 */
export const MIN_GAP_BETWEEN_ADS_MS = 60 * 1000;

/** Backoff used when an ad fails to load (network off, no fill, …). */
export const RELOAD_BACKOFF_MS = [5_000, 15_000, 30_000, 60_000];

/** Request configuration — keep the content rating aligned with your store listing. */
export const AD_REQUEST_OPTIONS = {
  requestNonPersonalizedAdsOnly: false, // set true until the user consents (see UMP below)
  keywords: ['finance', 'budget', 'savings', 'money management'],
};

export const IS_IOS = Platform.OS === 'ios';
