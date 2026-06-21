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

    const { orderID } = JSON.parse(event.body || "{}");

    if (!orderID) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "PayPal order ID is required." })
      };
    }

    const accessToken = await getPayPalAccessToken();

    const response = await fetch(
      `${PAYPAL_API_BASE}/v2/checkout/orders/${orderID}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Prefer: "return=representation"
        }
      }
    );

    const captureData = await response.json();

    if (!response.ok) {
      console.error("PayPal capture error:", captureData);
      return {
        statusCode: response.status,
        body: JSON.stringify({
          error: "Could not capture PayPal donation.",
          details: captureData
        })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: captureData.status,
        id: captureData.id,
        details: captureData
      })
    };
  } catch (error) {
    console.error("Capture order function error:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message || "Server error while capturing PayPal order."
      })
    };
  }
}