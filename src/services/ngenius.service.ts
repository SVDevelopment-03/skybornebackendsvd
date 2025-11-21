// services/ngenius.service.ts
import axios from "axios";

export class NgeniusService {
  static async getAccessToken() {
    const res = await axios.post(
      `${process.env.NGENIUS_API_URL}/identity/auth/access-token`,
      {
        realmName: "ni"
      },
      {
        headers: {
          "Authorization": `Basic ${process.env.NGENIUS_API_KEY}`,
          "Content-Type": "application/vnd.ni-identity.v1+json"
        }
      }
    );

    return res.data?.access_token;
  }

  static async createOrder(amount: number, currency: string, userId: string) {
    const token = await this.getAccessToken();

    const payload = {
      action: "SALE",
      amount: {
        value: amount * 100, // convert to cents
        currencyCode: currency
      },
      merchantAttributes: {
        redirectUrl: process.env.NGENIUS_REDIRECT_URL,
        cancelUrl: process.env.NGENIUS_CANCEL_URL
      },
      emailAddress: "customer@example.com",
      customerReference: userId
    };

    const res = await axios.post(
      `${process.env.NGENIUS_API_URL}/transactions/outlets/${process.env.NGENIUS_OUTLET_REF}/orders`,
      payload,
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/vnd.ni-payment.v2+json"
        }
      }
    );

    const orderRef = res.data._id;
    const paymentLink = res.data._links["payment"].href;

    return { orderRef, paymentLink };
  }
}
