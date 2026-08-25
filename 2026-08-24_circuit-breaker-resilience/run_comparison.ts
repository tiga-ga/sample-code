/**
 * 🧪 TypeScript 比較検証ベンチマークスクリプト
 * 
 * シナリオ:
 * 1. 外部レコメンドAPIが一時的な高負荷で「応答遅延（1000ms）＋503エラー」に陥る。
 * 2. ユーザーから連続してリクエストが届く。
 * 3. 2.5秒後に外部APIが正常復帰（応答50ms、200 OK）する。
 * 4. Bad（アンチパターン）と Good（サーキットブレーカー）の合計所要時間、エラー率、ユーザー体験を比較する。
 */

import { getUserProfileBad } from "./bad_example.ts";
import { CircuitBreaker } from "./circuit_breaker.ts";
import { defaultRecommendationsFallback, type UserRecommendationsResponse } from "./good_example.ts";

let isHealthy = false;

async function externalRecommendationApi(userId: string): Promise<UserRecommendationsResponse> {
  if (!isHealthy) {
    // 障害フェーズ: 遅延1000ms + エラー
    await new Promise((r) => setTimeout(r, 1000));
    throw new Error("503 Backend Overloaded");
  }
  // 正常フェーズ: 応答50ms + 成功
  await new Promise((r) => setTimeout(r, 50));
  return {
    userId,
    recommendations: [`Personalized Deal 1 for ${userId}`, `Personalized Deal 2 for ${userId}`],
    isFallback: false,
  };
}

async function runScenarioBad(): Promise<number> {
  console.log("\n=======================================================");
  console.log("❌ 1. [Bad Implementation] 障害時の挙動検証 (3リクエスト)");
  console.log("=======================================================");
  isHealthy = false;
  const start = Date.now();

  for (let i = 1; i <= 3; i++) {
    const reqStart = Date.now();
    try {
      await getUserProfileBad(`user-${i}`);
    } catch {
      console.log(`[Req #${i}] ❌ 致命的エラー (所要時間: ${Date.now() - reqStart}ms)`);
    }
  }

  const totalBadTime = Date.now() - start;
  console.log(`\n❌ Bad合計所要時間: ${totalBadTime}ms (全リクエストがブロッキングされクラッシュ)`);
  return totalBadTime;
}

async function runScenarioGood(): Promise<number> {
  console.log("\n=======================================================");
  console.log("⭕️ 2. [Good Implementation] サーキットブレーカー検証 (10リクエスト)");
  console.log("=======================================================");

  const breaker = new CircuitBreaker({
    failureThreshold: 2, // 2回連続失敗で遮断
    resetTimeout: 2000,   // 2秒後にHalf-Open
    timeout: 300,        // 300ms以上かかったらタイムアウト
  });

  isHealthy = false; // 最初は障害
  const start = Date.now();

  // 外部APIを2.5秒後に復旧させるタイマー
  setTimeout(() => {
    isHealthy = true;
    console.log("\n  🟢 >>> [Mock Infrastructure] 外部APIが正常復旧しました！ <<<");
  }, 2500);

  for (let i = 1; i <= 10; i++) {
    const reqStart = Date.now();
    const result = await breaker.execute(
      externalRecommendationApi,
      defaultRecommendationsFallback,
      `user-${i}`
    );

    const elapsed = Date.now() - reqStart;
    const status = result.isFallback
      ? `🟡 フォールバック返却 (${elapsed}ms) [State: ${breaker.state}]`
      : `🟢 正常レスポンス (${elapsed}ms) [State: ${breaker.state}]`;

    console.log(`[Req #${i.toString().padStart(2, "0")}] ${status}`);

    // 各リクエスト間に 400ms の間隔を設ける
    await new Promise((r) => setTimeout(r, 400));
  }

  const totalGoodTime = Date.now() - start;
  console.log(`\n⭕️ Good合計所要時間: ${totalGoodTime}ms (全リクエストが即座に成功/縮退運転完了)`);
  return totalGoodTime;
}

async function main(): Promise<void> {
  console.log("🚀 [TypeScript] サーキットブレーカー耐障害性 比較検証スタート\n");
  await runScenarioBad();
  await runScenarioGood();
  console.log("\n=======================================================");
  console.log("📊 まとめ: サーキットブレーカーの効果 (TypeScript)");
  console.log("1. 障害発生時、リクエストを即座に遮断（Open）して 0ms で型安全にフォールバック。");
  console.log("2. 外部サービスの遅延に引きずられて呼び出し元がハングアップするのを完全に防御。");
  console.log("3. 外部サービス復旧後は自動的に Half-Open ➔ Closed へ自己修復完了。");
  console.log("=======================================================\n");
}

main();
