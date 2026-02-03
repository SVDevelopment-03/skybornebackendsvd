// config/currencyConfig.ts

/**
 * Currency Configuration for Multi-Currency Stripe Payments
 * This configuration supports automatic currency conversion based on user's country
 */

export interface CurrencyConfig {
  code: string;
  symbol: string;
  name: string;
  stripeSupported: boolean;
  decimalPlaces: number;
}

export interface CountryCurrencyMapping {
  country: string;
  countryCode: string;
  currency: string;
  stripeCurrency: string; // What Stripe uses for this country
}

/**
 * Stripe-supported currencies
 * These are the currencies that Stripe can process payments in
 * Source: https://stripe.com/docs/currencies
 */
export const STRIPE_SUPPORTED_CURRENCIES: Record<string, CurrencyConfig> = {
  USD: {
    code: "USD",
    symbol: "$",
    name: "US Dollar",
    stripeSupported: true,
    decimalPlaces: 2,
  },
  EUR: {
    code: "EUR",
    symbol: "€",
    name: "Euro",
    stripeSupported: true,
    decimalPlaces: 2,
  },
  GBP: {
    code: "GBP",
    symbol: "£",
    name: "British Pound",
    stripeSupported: true,
    decimalPlaces: 2,
  },
  INR: {
    code: "INR",
    symbol: "₹",
    name: "Indian Rupee",
    stripeSupported: true,
    decimalPlaces: 2,
  },
  AUD: {
    code: "AUD",
    symbol: "A$",
    name: "Australian Dollar",
    stripeSupported: true,
    decimalPlaces: 2,
  },
  CAD: {
    code: "CAD",
    symbol: "C$",
    name: "Canadian Dollar",
    stripeSupported: true,
    decimalPlaces: 2,
  },
  JPY: {
    code: "JPY",
    symbol: "¥",
    name: "Japanese Yen",
    stripeSupported: true,
    decimalPlaces: 0, // JPY doesn't use decimal places
  },
  SGD: {
    code: "SGD",
    symbol: "S$",
    name: "Singapore Dollar",
    stripeSupported: true,
    decimalPlaces: 2,
  },
  AED: {
    code: "AED",
    symbol: "د.إ",
    name: "UAE Dirham",
    stripeSupported: true,
    decimalPlaces: 2,
  },
  CHF: {
    code: "CHF",
    symbol: "CHF",
    name: "Swiss Franc",
    stripeSupported: true,
    decimalPlaces: 2,
  },
  NZD: {
    code: "NZD",
    symbol: "NZ$",
    name: "New Zealand Dollar",
    stripeSupported: true,
    decimalPlaces: 2,
  },
  HKD: {
    code: "HKD",
    symbol: "HK$",
    name: "Hong Kong Dollar",
    stripeSupported: true,
    decimalPlaces: 2,
  },
  SEK: {
    code: "SEK",
    symbol: "kr",
    name: "Swedish Krona",
    stripeSupported: true,
    decimalPlaces: 2,
  },
  NOK: {
    code: "NOK",
    symbol: "kr",
    name: "Norwegian Krone",
    stripeSupported: true,
    decimalPlaces: 2,
  },
  DKK: {
    code: "DKK",
    symbol: "kr",
    name: "Danish Krone",
    stripeSupported: true,
    decimalPlaces: 2,
  },
  MXN: {
    code: "MXN",
    symbol: "Mex$",
    name: "Mexican Peso",
    stripeSupported: true,
    decimalPlaces: 2,
  },
  BRL: {
    code: "BRL",
    symbol: "R$",
    name: "Brazilian Real",
    stripeSupported: true,
    decimalPlaces: 2,
  },
  ZAR: {
    code: "ZAR",
    symbol: "R",
    name: "South African Rand",
    stripeSupported: true,
    decimalPlaces: 2,
  },
  PLN: {
    code: "PLN",
    symbol: "zł",
    name: "Polish Złoty",
    stripeSupported: true,
    decimalPlaces: 2,
  },
  THB: {
    code: "THB",
    symbol: "฿",
    name: "Thai Baht",
    stripeSupported: true,
    decimalPlaces: 2,
  },
  MYR: {
    code: "MYR",
    symbol: "RM",
    name: "Malaysian Ringgit",
    stripeSupported: true,
    decimalPlaces: 2,
  },
};

/**
 * Country to Currency mapping
 * Maps country codes to their respective currencies
 */
export const COUNTRY_CURRENCY_MAP: Record<string, CountryCurrencyMapping> = {
  // North America
  US: {
    country: "United States",
    countryCode: "US",
    currency: "USD",
    stripeCurrency: "usd",
  },
  CA: {
    country: "Canada",
    countryCode: "CA",
    currency: "CAD",
    stripeCurrency: "cad",
  },
  MX: {
    country: "Mexico",
    countryCode: "MX",
    currency: "MXN",
    stripeCurrency: "mxn",
  },

  // Europe
  GB: {
    country: "United Kingdom",
    countryCode: "GB",
    currency: "GBP",
    stripeCurrency: "gbp",
  },
  DE: {
    country: "Germany",
    countryCode: "DE",
    currency: "EUR",
    stripeCurrency: "eur",
  },
  FR: {
    country: "France",
    countryCode: "FR",
    currency: "EUR",
    stripeCurrency: "eur",
  },
  IT: {
    country: "Italy",
    countryCode: "IT",
    currency: "EUR",
    stripeCurrency: "eur",
  },
  ES: {
    country: "Spain",
    countryCode: "ES",
    currency: "EUR",
    stripeCurrency: "eur",
  },
  NL: {
    country: "Netherlands",
    countryCode: "NL",
    currency: "EUR",
    stripeCurrency: "eur",
  },
  BE: {
    country: "Belgium",
    countryCode: "BE",
    currency: "EUR",
    stripeCurrency: "eur",
  },
  AT: {
    country: "Austria",
    countryCode: "AT",
    currency: "EUR",
    stripeCurrency: "eur",
  },
  CH: {
    country: "Switzerland",
    countryCode: "CH",
    currency: "CHF",
    stripeCurrency: "chf",
  },
  SE: {
    country: "Sweden",
    countryCode: "SE",
    currency: "SEK",
    stripeCurrency: "sek",
  },
  NO: {
    country: "Norway",
    countryCode: "NO",
    currency: "NOK",
    stripeCurrency: "nok",
  },
  DK: {
    country: "Denmark",
    countryCode: "DK",
    currency: "DKK",
    stripeCurrency: "dkk",
  },
  PL: {
    country: "Poland",
    countryCode: "PL",
    currency: "PLN",
    stripeCurrency: "pln",
  },

  // Asia Pacific
  IN: {
    country: "India",
    countryCode: "IN",
    currency: "INR",
    stripeCurrency: "inr",
  },
  AU: {
    country: "Australia",
    countryCode: "AU",
    currency: "AUD",
    stripeCurrency: "aud",
  },
  NZ: {
    country: "New Zealand",
    countryCode: "NZ",
    currency: "NZD",
    stripeCurrency: "nzd",
  },
  JP: {
    country: "Japan",
    countryCode: "JP",
    currency: "JPY",
    stripeCurrency: "jpy",
  },
  SG: {
    country: "Singapore",
    countryCode: "SG",
    currency: "SGD",
    stripeCurrency: "sgd",
  },
  HK: {
    country: "Hong Kong",
    countryCode: "HK",
    currency: "HKD",
    stripeCurrency: "hkd",
  },
  MY: {
    country: "Malaysia",
    countryCode: "MY",
    currency: "MYR",
    stripeCurrency: "myr",
  },
  TH: {
    country: "Thailand",
    countryCode: "TH",
    currency: "THB",
    stripeCurrency: "thb",
  },

  // Middle East
  AE: {
    country: "United Arab Emirates",
    countryCode: "AE",
    currency: "AED",
    stripeCurrency: "aed",
  },

  // South America
  BR: {
    country: "Brazil",
    countryCode: "BR",
    currency: "BRL",
    stripeCurrency: "brl",
  },

  // Africa
  ZA: {
    country: "South Africa",
    countryCode: "ZA",
    currency: "ZAR",
    stripeCurrency: "zar",
  },
};

/**
 * Get currency configuration for a country
 */
export function getCurrencyForCountry(
  countryCode: string,
): CountryCurrencyMapping {
  const mapping = COUNTRY_CURRENCY_MAP[countryCode.toUpperCase()];
  if (mapping) {
    return mapping;
  }

  // Default to USD for unsupported countries
  return {
    country: "Default",
    countryCode: countryCode,
    currency: "USD",
    stripeCurrency: "usd",
  };
}

/**
 * Get currency configuration details
 */
export function getCurrencyConfig(currencyCode: string): CurrencyConfig {
  return (
    STRIPE_SUPPORTED_CURRENCIES[currencyCode.toUpperCase()] ||
    STRIPE_SUPPORTED_CURRENCIES.USD
  );
}

/**
 * Check if a currency is supported by Stripe
 */
export function isCurrencySupported(currencyCode: string): boolean {
  const config = STRIPE_SUPPORTED_CURRENCIES[currencyCode.toUpperCase()];
  return config ? config.stripeSupported : false;
}

/**
 * Format amount based on currency (some currencies don't use decimals)
 */
export function formatAmountForStripe(
  amount: number,
  currencyCode: string,
): number {
  const config = getCurrencyConfig(currencyCode);

  // Stripe expects amounts in smallest currency unit
  // For currencies with decimals (like USD, EUR, INR): multiply by 100
  // For currencies without decimals (like JPY): use as is
  if (config.decimalPlaces === 0) {
    return Math.round(amount);
  }

  return Math.round(amount * 100);
}

/**
 * Convert amount from smallest unit back to standard unit
 */
export function formatAmountFromStripe(
  amount: number,
  currencyCode: string,
): number {
  const config = getCurrencyConfig(currencyCode);

  if (config.decimalPlaces === 0) {
    return amount;
  }

  return amount / 100;
}