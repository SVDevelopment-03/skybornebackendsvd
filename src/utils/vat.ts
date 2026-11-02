import { getName } from "country-list";

// Invoices dated from 1 April 2026 (Dubai time) use the tax invoice format.
export const TAX_INVOICE_EFFECTIVE_DATE = new Date("2026-04-01T00:00:00+04:00");
export const SKYBORNE_TRN = "104022515100003";
export const USD_TO_AED_RATE = 3.6725;

const normalizeCountryValue = (value?: string | null): string =>
  String(value ?? "").trim().toLowerCase();

const UAE_NAME_VARIANTS = new Set([
  "united arab emirates",
  "united arab emirates (the)",
  "uae",
  "ae",
]);

export const isUnitedArabEmirates = (
  country?: string | null,
  countryCode?: string | null,
): boolean => {
  const code = normalizeCountryValue(countryCode);
  if (code === "ae") return true;

  const name = normalizeCountryValue(country);
  return UAE_NAME_VARIANTS.has(name);
};

// Users may hold a full name or an ISO code in `country`; invoices show the full name.
export const getCountryDisplayName = (
  country?: string | null,
  countryCode?: string | null,
): string => {
  const stored = String(country ?? "").trim();
  const name =
    stored.length > 3
      ? stored
      : getName(stored) || getName(String(countryCode ?? "").trim()) || stored;

  // country-list names carry a suffix, e.g. "United Arab Emirates (the)".
  return name.replace(/\s*\(the\)$/i, "");
};

export const getVatRateForCountry = (
  country?: string | null,
  countryCode?: string | null,
): number => (isUnitedArabEmirates(country, countryCode) ? 0.05 : 0);

const roundCurrency = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
};

export const calculateVatFromBase = (baseAmount: number, vatRate: number) => {
  const subtotal = roundCurrency(baseAmount);
  const safeRate = Number.isFinite(vatRate) ? vatRate : 0;
  const vatAmount = roundCurrency(subtotal * safeRate);
  const total = roundCurrency(subtotal + vatAmount);

  return {
    subtotal,
    vatAmount,
    total,
    vatRate: safeRate,
  };
};

export const calculateVatFromTotal = (totalAmount: number, vatRate: number) => {
  const safeRate = Number.isFinite(vatRate) ? vatRate : 0;
  const total = roundCurrency(totalAmount);

  if (!safeRate) {
    return {
      subtotal: total,
      vatAmount: 0,
      total,
      vatRate: 0,
    };
  }

  const subtotal = roundCurrency(total / (1 + safeRate));
  const vatAmount = roundCurrency(total - subtotal);

  return {
    subtotal,
    vatAmount,
    total,
    vatRate: safeRate,
  };
};

export const isTaxInvoiceDate = (invoiceDate: Date | string): boolean =>
  new Date(invoiceDate).getTime() >= TAX_INVOICE_EFFECTIVE_DATE.getTime();

// AED equivalents for UAE invoices (the only invoices with VAT). The subtotal is derived
// from the converted total and VAT so the AED figures always add up.
export const getAedTotals = (
  totals: ReturnType<typeof calculateVatFromTotal>,
  invoiceDate: Date | string,
) => {
  if (!totals.vatRate || !isTaxInvoiceDate(invoiceDate)) return null;

  const total = roundCurrency(totals.total * USD_TO_AED_RATE);
  const vatAmount = roundCurrency(totals.vatAmount * USD_TO_AED_RATE);

  return {
    subtotal: roundCurrency(total - vatAmount),
    vatAmount,
    total,
  };
};
