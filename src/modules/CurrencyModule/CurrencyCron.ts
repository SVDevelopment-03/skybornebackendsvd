// backend/src/modules/CurrencyModule/CurrencyCron.ts

import cron from "node-cron";
import { CurrencyRates } from "./CurrencyModel";

interface ExchangeRateApiResponse {
  base_code: string;
  rates: Record<string, number>;
}

/**
 * Fetch latest currency rates from API
 * Base currency: USD
 */
const fetchCurrencyRatesFromAPI = async (): Promise<ExchangeRateApiResponse> => {
  const response = await fetch(
    "https://open.exchangerate-api.com/v6/latest/USD"
  );

  if (!response.ok) {
    throw new Error(
      `Currency API failed with status ${response.status}`
    );
  }

  const data = await response.json();

  if (!data?.rates) {
    throw new Error("Invalid currency API response");
  }

  return {
    base_code: data.base_code || "USD",
    rates: data.rates,
  };
};

/**
 * Currency Cron
 * Runs once per day at fixed time (IST)
 */
export const startCurrencyCron = () => {

  /**
   * ┌──────── minute (0 - 59)
   * │ ┌────── hour (0 - 23)
   * │ │ ┌──── day of month
   * │ │ │ ┌── month
   * │ │ │ │ ┌─ day of week
   * │ │ │ │ │
   * 5 0 * * *
   *
   * → Every day at 12:05 AM IST
   */
  cron.schedule(
    "5 0 * * *",
    async () => {

      try {
        /** 1. Fetch latest rates from API */
        const { base_code, rates } =
          await fetchCurrencyRatesFromAPI();

        /** 2. Get singleton currency document */
        const currencyDoc =
          await CurrencyRates.getSingleton();

        /** 3. Update DB */
        currencyDoc.base = base_code;
        currencyDoc.rates = new Map(Object.entries(rates));
        currencyDoc.lastUpdated = new Date();

        await currencyDoc.save();

      } catch (error) {
        console.error(
          "❌ Currency cron failed:",
          error
        );
      }
    },
    {
      timezone: "Asia/Kolkata",
    }
  );
};


// 👇 TEMPORARY MANUAL RUN (ONLY FOR LOCAL / ONE-TIME USE)
export const runCurrencyOnceNow = async () => {
  const { base_code, rates } = await fetchCurrencyRatesFromAPI();

  const currencyDoc = await CurrencyRates.getSingleton();
  currencyDoc.base = base_code;
  currencyDoc.rates = new Map(Object.entries(rates));
  currencyDoc.lastUpdated = new Date();

  await currencyDoc.save();

};
