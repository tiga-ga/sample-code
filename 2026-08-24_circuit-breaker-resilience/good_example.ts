/**
 * ⭕️ Good Example: サーキットブレーカー & フォールバック設計 (TypeScript)
 * 
 * 外部APIが死んでいても、画面全体を壊さず代替品（フォールバック）を即時返却してサービスを維持する。
 */

import { CircuitBreaker } from "./circuit_breaker.ts";

// レスポンスデータの型定義
export interface UserRecommendationsResponse {
  userId: string;
  recommendations: string[];
  isFallback: boolean;       // フォールバック（代替品）かどうかの目印
  fallbackReason?: string;   // 代替品になった理由
}

/**
 * ⭕️ フォールバック関数
 * 外部API障害時に呼ばれ、静的な人気商品リストを返して画面表示を維持（縮退運転）
 */
export function defaultRecommendationsFallback(
  error: Error,
  userId: string
): UserRecommendationsResponse {
  return {
    userId,
    // AIおすすめが取れなくても、固定の人気商品を表示してユーザー体験を守る
    recommendations: ["Trending Item A", "Popular Item B", "Seasonal Special C"],
    isFallback: true,
    fallbackReason: error.message,
  };
}

// 実行エントリーポイント（単体実行時）
if (process.argv[1]?.endsWith("good_example.ts")) {
  console.log("=== Running Good Example with Circuit Breaker (TypeScript) ===");

  // 1. ブレーカーの設定（2回失敗で遮断、2秒クールダウン、500msタイムアウト）
  const breaker = new CircuitBreaker({
    failureThreshold: 2,
    resetTimeout: 2000,
    timeout: 500,
  });

  // モック外部API（1000ms遅延する不安定なサービス）
  const flakyService = async (id: string): Promise<UserRecommendationsResponse> => {
    await new Promise((r) => setTimeout(r, 1000));
    return {
      userId: id,
      recommendations: ["AI Personalized Item 1", "AI Personalized Item 2"],
      isFallback: false,
    };
  };

  const start = Date.now();
  // 2. ブレーカー経由で実行（本命処理 + フォールバック関数 + 引数）
  const res = await breaker.execute(
    flakyService,
    defaultRecommendationsFallback,
    "user-123"
  );
  console.log(`\n✅ Request resolved gracefully in ${Date.now() - start}ms:`, res);
}
