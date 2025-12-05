import axios, { AxiosError } from "axios";
import Payment from "../modules/PaymentModule/models/Payment";
import dotenv from 'dotenv';
dotenv.config()

interface ErrorResponse {
  status?: number;
  message?: string;
  errors?: Array<{ detail: string; errorCode?: string }>;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface OrderResponse {
  reference: string;
  links?: Array<{ rel: string; href: string }>;
  _links?: { payment?: { href: string } };
}

export class NgeniusService {
  private static readonly TIMEOUT = 20000;

  static async getAccessToken(): Promise<string> {
    try {
      const tokenURL = `${process.env.NGENIUS_API_URL}/identity/auth/access-token`;
      const apiKey = process.env.NGENIUS_API_KEY;

      if (!apiKey) {
        throw new Error('NGENIUS_API_KEY is not defined');
      }

      if (!process.env.NGENIUS_API_URL) {
        throw new Error('NGENIUS_API_URL is not defined');
      }

      console.log('API URL:', process.env.NGENIUS_API_URL);
      console.log('API Key Length:', apiKey.length);

      // API key is already base64 encoded from nGenius dashboard
      const encodedApiKey = apiKey;

      console.log('Requesting token from:', tokenURL);

      const response = await axios.post<TokenResponse>(
        tokenURL,
        { grant_type: 'client_credentials' },
        {
          headers: {
            'Content-Type': 'application/vnd.ni-identity.v1+json',
            'Authorization': `Basic ${encodedApiKey}`,
          },
          timeout: this.TIMEOUT,
        }
      );

      if (!response.data?.access_token) {
        throw new Error('No access token in response');
      }

      console.log('✅ Token generated successfully');
      return response.data.access_token;

    } catch (error) {
      const axiosError = error as AxiosError<ErrorResponse>;
      
      console.error('❌ nGenius Token Error:');
      console.error('Status:', axiosError.response?.status);
      console.error('Data:', JSON.stringify(axiosError.response?.data, null, 2));
      console.error('Message:', axiosError.message);

      if (axiosError.response?.status === 401) {
        throw new Error('Unauthorized - Invalid API credentials. Check NGENIUS_API_KEY in .env');
      }

      if (axiosError.response?.status === 400) {
        throw new Error('Bad Request - Invalid token request format');
      }

      if (axiosError.code === 'ECONNABORTED') {
        throw new Error('Timeout - Check if NGENIUS_API_URL is correct and reachable');
      }

      throw new Error(`Token request failed: ${axiosError.message}`);
    }
  }

 static async createOrder(amount: any, currency: any, userId: string, plan: string) {

  try {
    if (!process.env.NGENIUS_OUTLET_ID) {
      throw new Error('NGENIUS_OUTLET_ID is not defined in .env');
    }

    const token = await this.getAccessToken();

    const orderRef = "SB-" + Date.now();
    const outletId = process.env.NGENIUS_OUTLET_ID.trim();
    const orderURL = `${process.env.NGENIUS_API_URL}/transactions/outlets/${outletId}/orders`;

    const redirectUrl = process.env.NGENIUS_REDIRECT_URL?.split('?')[0];
    const cancelUrl = process.env.NGENIUS_CANCEL_URL?.split('?')[0];

    //    const baseRedirectUrl = process.env.NGENIUS_REDIRECT_URL?.split('?')[0];
    // const baseCancelUrl = process.env.NGENIUS_CANCEL_URL?.split('?')[0];

    // const redirectUrl = `${baseRedirectUrl}?orderRef=${orderRef}`;
    // const cancelUrl = `${baseCancelUrl}?orderRef=${orderRef}`;


    const body = {
      action: "SALE",
      amount: {
        currencyCode: currency,
        value: amount * 100,
      },
      merchantAttributes: {
        redirectUrl: redirectUrl,
        cancelUrl: cancelUrl,
      },
      merchantDefinedData: { 
        orderRef,
        userId,
        plan,
      },
    };

    const response = await axios.post<OrderResponse>(orderURL, body, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/vnd.ni-payment.v2+json",
        Accept: "application/vnd.ni-payment.v2+json",
      },
      timeout: this.TIMEOUT,
      httpAgent: new (require('http').Agent)({ keepAlive: false }),
      httpsAgent: new (require('https').Agent)({ keepAlive: false }),
      withCredentials: false,
    });

    const data = response.data;

    const paymentLink = data?._links?.payment?.href || 
                        data?.links?.find(l => l.rel === 'payment')?.href;

    if (!paymentLink) {
      throw new Error('No payment link returned from nGenius');
    }

    // ✅ Save with reference from nGenius
    await Payment.create({
      userId,
      orderRef,
      reference: data.reference, // ✅ Save nGenius reference
      amount,
      currency,
      plan,
      status: "PENDING",
      paymentLink,
      gatewayResponse: data,
    });

    console.log("✅ Order saved successfully");
    console.log("Order Ref:", orderRef);
    console.log("nGenius Reference:", data.reference);

    return { 
      orderRef, 
      paymentLink, 
      reference: data.reference // ✅ Return reference to frontend
    };

  } catch (error) {
    const err = error as AxiosError<ErrorResponse>;
    console.error("❌ NGENIUS ORDER CREATION ERROR:", err.message);
    throw err;
  }
}

static async getOrderStatus(reference: string): Promise<any> {
  try {
    const token = await this.getAccessToken();
    const outletId = process.env.NGENIUS_OUTLET_ID;

    // ✅ FIXED: Use 'reference' (nGenius order ID), not 'orderRef' (your order ID)
    // reference = nGenius reference (e.g., "30a370c8-3d42-480e-86e8-d33f3c0ca440")
    // orderRef = your reference (e.g., "SB-1764919789544")
    const statusURL = `${process.env.NGENIUS_API_URL}/transactions/outlets/${outletId}/orders/${reference}`;

    console.log("Fetching order status from:", statusURL);

    const response = await axios.get(statusURL, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.ni-payment.v2+json",
      },
      timeout: this.TIMEOUT,
    });

    console.log("✅ Order Status Response:", JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    const err = error as AxiosError;
    console.error("❌ Error fetching order status:");
    console.error("Status:", err.response?.status);
    console.error("Message:", err.message);
    console.error("Data:", err.response?.data);
    throw error;
  }
}
}