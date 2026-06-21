const PAYPAL_API_BASE =
  process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

async function getPayPalAccessToken() {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("PayPal token error:", data);
    throw new Error("Could not authenticate with PayPal.");
  }

  return data.access_token;
}

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: "Method not allowed" })
      };
    }

    const { amount, currency, donorName, donorEmail, donorMessage } =
      JSON.parse(event.body || "{}");

    const validCurrencies = ["USD", "EUR", "GBP", "AUD", "CAD"];

    if (!amount || Number(amount) < 1) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "A valid donation amount is required." })
      };
    }

    if (!currency || !validCurrencies.includes(currency)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "A valid currency is required." })
      };
    }

    const accessToken = await getPayPalAccessToken();

    const orderPayload = {
      intent: "CAPTURE",
      purchase_units: [
        {
          description: "Donation to GRIT Lab Africa",
          custom_id: "gritlabafrica-donation",
          amount: {
            currency_code: currency,
            value: Number(amount).toFixed(2)
          }
        }
      ],
      application_context: {
        brand_name: "GRIT Lab Africa",
        user_action: "PAY_NOW",
        shipping_preference: "NO_SHIPPING"
      }
    };

    const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify(orderPayload)
    });

    const orderData = await response.json();

    if (!response.ok) {
      console.error("PayPal create order error:", orderData);
      return {
        statusCode: response.status,
        body: JSON.stringify({
          error: "Could not create PayPal order.",
          details: orderData
        })
      };
    }

    console.log("Donation order created:", {
      orderID: orderData.id,
      amount,
      currency,
      donorName,
      donorEmail,
      donorMessage
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        id: orderData.id
      })
    };
  } catch (error) {
    console.error("Create order function error:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message || "Server error while creating PayPal order."
      })
    };
  }
}