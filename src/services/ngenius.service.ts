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

  static async createOrder(amount: any, currency: any, userId: string,plan:string) {
    console.log("=== NGENIUS: Creating Order ===");
    console.log("Amount:", amount);
    console.log("Currency:", currency);
    console.log("UserID:", userId);
    console.log("plan:", plan);

    try {
      if (!process.env.NGENIUS_OUTLET_ID) {
        throw new Error('NGENIUS_OUTLET_ID is not defined in .env');
      }

      if (!process.env.NGENIUS_REDIRECT_URL) {
        throw new Error('NGENIUS_REDIRECT_URL is not defined in .env');
      }

      if (!process.env.NGENIUS_CANCEL_URL) {
        throw new Error('NGENIUS_CANCEL_URL is not defined in .env');
      }

      const token = await this.getAccessToken();

      const orderRef = "SB-" + Date.now();
      console.log("Generated orderRef:", orderRef);

      const outletId = process.env.NGENIUS_OUTLET_ID.trim();
      const orderURL = `${process.env.NGENIUS_API_URL}/transactions/outlets/${outletId}/orders`;

      console.log("Outlet ID:", outletId);
      console.log("Order URL:", orderURL);

      const body = {
        action: "SALE",
        amount: {
          currencyCode: currency,
          value: amount * 100,
        },
        merchantAttributes: {
          redirectUrl: `${process.env.NGENIUS_REDIRECT_URL}?orderRef=${orderRef}`,
          cancelUrl: `${process.env.NGENIUS_CANCEL_URL}?orderRef=${orderRef}`,
        },
        merchantDefinedData: { 
          orderRef,
          userId,
        },
      };

      console.log("Order Body:", JSON.stringify(body, null, 2));

      const response = await axios.post<OrderResponse>(orderURL, body, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/vnd.ni-payment.v2+json",
          Accept: "application/vnd.ni-payment.v2+json",
        },
        timeout: this.TIMEOUT,
      });

      const data = response.data;

      console.log("=== NGENIUS ORDER RESPONSE ===");
      console.log(JSON.stringify(data, null, 2));

      // Handle both response formats
      let paymentLink = data?._links?.payment?.href || 
                        data?.links?.find(l => l.rel === 'payment')?.href;

      if (!paymentLink) {
        console.warn('⚠️ Payment link not found in response');
        console.warn('Available links:', JSON.stringify(data?.links, null, 2));
        throw new Error('No payment link returned from nGenius');
      }

      console.log("✅ Payment Link:", paymentLink);
      console.log("Order Reference from API:", data.reference);

      // Save to database
      await Payment.create({
        userId,
        orderRef,
        amount,
        currency,
        status: "PENDING",
        plan,
        paymentLink,
        gatewayResponse: data,
      });

      console.log("✅ Order saved to DB successfully.");

      return { orderRef, paymentLink, reference: data.reference };

    } catch (error) {
      const err = error as AxiosError<ErrorResponse>;
      
      console.error("❌ NGENIUS ORDER CREATION ERROR:");
      console.error("Message:", err.message);

      if (err.response?.status === 502) {
        console.error("\n⚠️  502 Bad Gateway - Outlet Configuration Issue:");
        console.error("Possible causes:");
        console.error("  1. Outlet ID is incorrect or doesn't exist");
        console.error("  2. Outlet is disabled/inactive in nGenius dashboard");
        console.error("  3. Outlet doesn't support currency:", error instanceof AxiosError ? error.response?.data : '');
        console.error("  4. Outlet is not properly configured");
        console.error("\nSolution: Verify outlet ID in nGenius dashboard and ensure it's ACTIVE");
        throw new Error(`Outlet Configuration Error - Check NGENIUS_OUTLET_ID: ${process.env.NGENIUS_OUTLET_ID}`);
      }

      if (err.response?.status === 401) {
        console.error("Status:", err.response.status);
        console.error("Unauthorized - Token invalid or expired");
        throw new Error('Unauthorized - Check API credentials');
      }

      if (err.response?.status === 400) {
        console.error("Status:", err.response.status);
        console.error("Bad Request - Check order payload");
        console.error("Response Data:", err.response.data);
        throw err;
      }

      console.error("Status:", err.response?.status);
      console.error("Response Data:", err.response?.data);

      throw err;
    }
  }

  static async getOrderStatus(orderRef: string): Promise<any> {
    try {
      const token = await this.getAccessToken();
      const outletId = process.env.NGENIUS_OUTLET_ID;

      const statusURL = `${process.env.NGENIUS_API_URL}/transactions/outlets/${outletId}/orders/${orderRef}`;

      const response = await axios.get(statusURL, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.ni-payment.v2+json",
        },
        timeout: this.TIMEOUT,
      });

      return response.data;
    } catch (error) {
      console.error("Error fetching order status:", error);
      throw error;
    }
  }
}