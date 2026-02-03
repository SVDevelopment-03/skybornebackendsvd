import { Schema, Document, model, Model } from "mongoose";

export interface ICurrencyRates extends Document {
  base: string;
  lastUpdated: Date;
  rates: Map<string, number>;
}

/** 👇 Static methods interface */
export interface CurrencyRatesModel
  extends Model<ICurrencyRates> {
  getSingleton(): Promise<ICurrencyRates>;
}

const CurrencyRatesSchema = new Schema<ICurrencyRates>({
  base: { type: String, required: true, default: "USD" },
  lastUpdated: { type: Date, default: Date.now },
  rates: {
    type: Map,
    of: Number,
    required: true,
    default: {},
  },
});

/** ✅ Typed static method */
CurrencyRatesSchema.statics.getSingleton =
  async function (): Promise<ICurrencyRates> {
    let doc = await this.findOne();
    if (!doc) {
      doc = await this.create({ rates: {} });
    }
    return doc;
  };

export const CurrencyRates = model<
  ICurrencyRates,
  CurrencyRatesModel
>("CurrencyRates", CurrencyRatesSchema);
