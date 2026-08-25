/**
 * ❌ Bad Example: 外部API連携の4大アンチパターン (TypeScript)
 * 
 * | アンチパターン | 該当コード | 何が起きるか？ |
 * | :--- | :--- | :--- |
 * | ① タイムアウトなし | L36 (flakyExternalApi) | 相手が遅いと無限に待ち続け、サーバの接続枠を食いつぶす。 |
 * | ② 相手が死んでるのに連打 | L32-L52 (whileループ) | 相手が倒れているのに全員が毎回アクセスして自滅する。 |
 * | ③ 固定間隔リトライ | L50 (setTimeout 500ms) | 全員が 0.5秒後に一斉リトライして混雑を悪化させる。 |
 * | ④ 画面全体のクラッシュ | L45-L47 (throw new Error) | 一部のエラーで画面全体を 500 エラーにして店を閉める。 |
 */

// 戻り値の型定義
export interface UserProfile {
  userId: string;
  recommendations: string[];
}

// モック外部API（障害中：1.5秒遅延して503エラー）
export async function flakyExternalApi(userId: string): Promise<string[]> {
  await new Promise((resolve) => setTimeout(resolve, 1500)); // 1.5秒の重い遅延
  throw new Error(`503 Service Unavailable (External Recommendation Service Down for ${userId})`);
}

export async function getUserProfileBad(userId: string): Promise<UserProfile> {
  const startTime = Date.now();
  console.log(`[Bad] Requesting recommendations for user ${userId}...`);

  let attempts = 0;
  const maxAttempts = 3;

  // ⚠️ アンチパターン②: 状態管理なしの愚直な連打
  while (attempts < maxAttempts) {
    attempts++;
    try {
      // ⚠️ アンチパターン①: タイムアウト未設定で無限に待機
      const data = await flakyExternalApi(userId);
      console.log(`[Bad] Success on attempt ${attempts} (${Date.now() - startTime}ms)`);
      return { userId, recommendations: data };
    } catch (err: unknown) {
      // 💡 TypeScript学習: catch節の err は unknown 型なので instanceof Error で型ガードする
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[Bad] Attempt ${attempts} failed: ${errorMessage} (${Date.now() - startTime}ms elapsed)`);

      if (attempts >= maxAttempts) {
        // ⚠️ アンチパターン④: 3回失敗したら例外をそのまま上に投げて画面全体をクラッシュさせる
        throw new Error(`[FATAL] Failed to fetch recommendations after ${maxAttempts} attempts: ${errorMessage}`);
      }

      // ⚠️ アンチパターン③: 固定時間（500ms）待機して再突撃（リトライの嵐を誘発）
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // TypeScript用: 全コードパスで戻り値または例外スローを保証
  throw new Error("Unexpected end of retry loop");
}

// 実行エントリーポイント（単体実行時）
if (process.argv[1]?.endsWith("bad_example.ts")) {
  console.log("=== Running Bad Example (TypeScript) ===");
  const start = Date.now();
  try {
    await getUserProfileBad("user-123");
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    console.error(`\n❌ User Request Failed completely! Total time wasted: ${Date.now() - start}ms`);
    console.error(`Error details: ${error.message}`);
  }
}
