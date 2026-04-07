const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY!;
const TOSS_API_URL = "https://api.tosspayments.com/v1";

export async function confirmPayment(
  paymentKey: string,
  orderId: string,
  amount: number
) {
  const response = await fetch(`${TOSS_API_URL}/payments/confirm`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(TOSS_SECRET_KEY + ":").toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  });
  return response.json();
}

export function generateOrderId() {
  return `order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
