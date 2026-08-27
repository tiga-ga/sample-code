/**
 * Good: ブランド型による型安全性 (good.ts)
 * 
 * 関数の引数に BrandUserId や BrandOrderId を指定することで、
 * 引数の順序逆転をコンパイルエラーとして確実に検知！
 */

// ゼロコストのブランド型ヘルパー
declare const __brand: unique symbol;
type Brand<Base, Tag extends string> = Base & { readonly [__brand]: Tag };

// ドメイン固有のブランド型
type BrandUserId = Brand<string, "UserId">;
type BrandOrderId = Brand<string, "OrderId">;
type BrandUSD = Brand<number, "USD">;
type BrandJPY = Brand<number, "JPY">;

// モックDB
const ordersDB: Record<string, string> = { "ORD-1001": "USR-ALICE" };

// 関数の引数に BrandUserId と BrandOrderId を要求
function cancelOrder(userId: BrandUserId, orderId: BrandOrderId): string {
  if (ordersDB[orderId as string] !== (userId as string)) {
    return `不正アクセス！注文者(${ordersDB[orderId as string] ?? "なし"}) と 要求者(${userId as string}) が不一致です`;
  }
  return `注文 ${orderId} を正常にキャンセルしました`;
}

// 関数の引数に BrandUSD と BrandJPY を要求
function calculateTotal(priceUSD: BrandUSD, priceJPY: BrandJPY, rate = 150): number {
  return (priceUSD as number) * rate + (priceJPY as number);
}

// 呼び出し側（変数名・値は Bad と完全一致）
const userId = "USR-ALICE" as BrandUserId;
const orderId = "ORD-1001" as BrandOrderId;
const mouseUSD = 50 as BrandUSD;
const laptopJPY = 300000 as BrandJPY;

console.log("=== After (ブランド型) ===");

// 引数を逆に渡すと、即座にコンパイルエラー！
cancelOrder(orderId, userId);
calculateTotal(laptopJPY, mouseUSD);
