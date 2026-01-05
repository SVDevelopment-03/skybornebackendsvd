// config/paymentGatewayConfig.ts

export type PaymentGateway = 'ngenius' | 'stripe';

export interface GatewayConfig {
  gateway: PaymentGateway;
  priority: number;
  supportedCountries: string[];
  supportedCurrencies: string[];
  minAmount?: number;
  maxAmount?: number;
}

export const PAYMENT_GATEWAY_CONFIG: GatewayConfig[] = [
  {
    gateway: 'ngenius',
    priority: 1,
    supportedCountries: ['AE', 'SA', 'KW', 'QA', 'BH', 'OM'],
    supportedCurrencies: ['AED', 'SAR', 'KWD', 'QAR', 'BHD', 'OMR', 'USD'],
  },
  {
    gateway: 'stripe',
    priority: 2,
    supportedCountries: [
      'US', 'CA', 'GB', 'AU', 'NZ', 'SG', 'JP', 'DE', 'FR', 'IT', 'ES',
      'NL', 'BE', 'CH', 'AT', 'SE', 'NO', 'DK', 'FI', 'IE', 'PT', 'GR',
      'IN', 'MY', 'TH', 'PH', 'ID', 'BR', 'MX', 'AR', 'CL', 'CO', 'ZA',
      // Add more Stripe-supported countries as needed
    ],
    supportedCurrencies: [
      'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'JPY', 'INR', 'ZAR',
      'BRL', 'MXN', 'ARS', 'CLP', 'COP',
    ],
  },
];

/**
 * Get the preferred payment gateway for a country
 */
export function getPreferredGateway(countryCode: string): PaymentGateway {
  const config = PAYMENT_GATEWAY_CONFIG.find((c) =>
    c.supportedCountries.includes(countryCode.toUpperCase())
  );
  return config?.gateway || 'stripe'; // Default to Stripe as fallback
}

/**
 * Check if a gateway supports a country and currency combination
 */
export function isGatewaySupported(
  gateway: PaymentGateway,
  countryCode: string,
  currency: string
): boolean {
  const config = PAYMENT_GATEWAY_CONFIG.find((c) => c.gateway === gateway);
  if (!config) return false;

  return (
    config.supportedCountries.includes(countryCode.toUpperCase()) &&
    config.supportedCurrencies.includes(currency.toUpperCase())
  );
}