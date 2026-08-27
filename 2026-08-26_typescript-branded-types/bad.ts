/**
 * Bad: 通常の型エイリアス (bad.ts)
 * 
 * 関数の引数に UserId や OrderId を指定しているにもかかわらず、
 * 中身がただの string や number のため、引数の順序逆転を検知できない！
 */

// 通常の型エイリアス
type UserId = string;
type OrderId = string;
type USD = number;
type JPY = number;

// モックDB
const ordersDB: Record<string, string> = { "ORD-1001": "USR-ALICE" };

// 関数の引数に UserId と OrderId を指定
function cancelOrder(userId: UserId, orderId: OrderId): string {
  if (ordersDB[orderId] !== userId) {
    return `不正アクセス！注文者(${ordersDB[orderId] ?? "なし"}) と 要求者(${userId}) が不一致です`;
  }
  return `注文 ${orderId} を正常にキャンセルしました`;
}

// 関数の引数に USD と JPY を指定
function calculateTotal(priceUSD: USD, priceJPY: JPY, rate = 150): number {
  return priceUSD * rate + priceJPY;
}

// 呼び出し側
const userId: UserId = "USR-ALICE";
const orderId: OrderId = "ORD-1001";
const mouseUSD: USD = 50;        // 50ドル (約7,500円)
const laptopJPY: JPY = 300000;   // 30万円

console.log("=== Before (通常の型エイリアス) ===");

// 1. 引数を逆に渡してしまった（UserId と OrderId を指定しているのに素通り！）
console.log(cancelOrder(orderId, userId));

// 2. 通貨の引数を逆に渡してしまった（USD と JPY を指定しているのに素通り！）
const total = calculateTotal(laptopJPY, mouseUSD);
console.log(`誤請求金額: ¥${total.toLocaleString()}`);
