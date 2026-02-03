import { CurrencyRates } from "../modules/CurrencyModule/CurrencyModel";

export async function convertUsingDB(
  amount: number,
  from: string,
  to: string,
): Promise<{ convertedAmount: number; rate: number }> {
  const base = "USD";

  const doc = await CurrencyRates.findOne({ base });
  if (!doc) throw new Error("Currency rates not found in DB");

  const rates = doc.rates; // Map<string, number>

  const fromRate =
    from === base ? 1 : rates.get(from);

  const toRate =
    to === base ? 1 : rates.get(to);

  if (!fromRate || !toRate) {
    throw new Error(`Rate missing for ${from} or ${to}`);
  }

  const rate = toRate / fromRate;
  const convertedAmount = Number((amount * rate).toFixed(2));

  return { convertedAmount, rate };
}
