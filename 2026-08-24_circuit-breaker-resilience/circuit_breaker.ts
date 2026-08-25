/**
 * 🛡️ Circuit Breaker (TypeScript Implementation)
 * 
 * 外部APIの障害・遅延時に回路を遮断し、連鎖障害（Cascading Failure）を防ぐ仕組み。
 */

// ① 状態のタイポを防ぐリテラルUnion型
export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

// ② サーキットブレーカーの設定オプション
export interface CircuitBreakerOptions {
  /** 遮断（OPEN）に至るまでの連続失敗閾値 (デフォルト: 3) */
  failureThreshold?: number;
  /** OPEN状態からHALF_OPEN状態に移行するまでの待機時間 (ms, デフォルト: 3000) */
  resetTimeout?: number;
  /** 単一リクエストの最大タイムアウト (ms, デフォルト: 800) */
  timeout?: number;
  /** 状態遷移時のコールバック */
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
}

// ③ 任意の関数・引数・戻り値に対応するジェネリクス型
export type ActionFunction<T, TArgs extends unknown[]> = (...args: TArgs) => Promise<T>;
export type FallbackFunction<T, TArgs extends unknown[]> = (error: Error, ...args: TArgs) => Promise<T> | T;

export class CircuitBreaker {
  readonly failureThreshold: number;
  readonly resetTimeout: number;
  readonly timeout: number;
  private readonly onStateChange?: (from: CircuitState, to: CircuitState) => void;

  private _state: CircuitState = "CLOSED"; // 最初は通常モード（CLOSED）
  private failureCount = 0;                // 連続失敗カウント
  private successCount = 0;                // 試験成功カウント
  private lastStateChange = Date.now();    // 最後に状態が変わった時刻

  constructor(options: CircuitBreakerOptions = {}) {
    // Null合体演算子(??)でデフォルト値を安全に設定
    this.failureThreshold = options.failureThreshold ?? 3;
    this.resetTimeout = options.resetTimeout ?? 3000;
    this.timeout = options.timeout ?? 800;
    this.onStateChange = options.onStateChange;
  }

  // 外部からの読み取り専用ゲッター
  get state(): CircuitState {
    return this._state;
  }

  /**
   * タイムアウト制御: Promise.race による通信とタイマーの徒競走
   */
  private async callWithTimeout<T, TArgs extends unknown[]>(
    fn: ActionFunction<T, TArgs>,
    args: TArgs
  ): Promise<T> {
    let timer: NodeJS.Timeout | undefined;

    // 指定時間を過ぎたら強制的にエラーを投げるPromise
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${this.timeout}ms`));
      }, this.timeout);
    });

    try {
      // 通信処理とタイムアウトタイマーで「早く終わった方」を採用
      return await Promise.race([fn(...args), timeoutPromise]);
    } finally {
      // メモリリーク防止のためタイマーを必ず解除
      if (timer) clearTimeout(timer);
    }
  }

  /**
   * メイン実行: 状態に応じた通信制御とフォールバック実行
   */
  async execute<T, TArgs extends unknown[]>(
    actionFn: ActionFunction<T, TArgs>,
    fallbackFn: FallbackFunction<T, TArgs>,
    ...args: TArgs
  ): Promise<T> {
    const now = Date.now();

    // 🔴 1. OPEN（遮断中）の判定
    if (this._state === "OPEN") {
      if (now - this.lastStateChange > this.resetTimeout) {
        // クールダウン経過 ➔ お試しモード（HALF_OPEN）へ
        this.transitionTo("HALF_OPEN");
      } else {
        // 遮断期間中 ➔ 通信を行わず 0ms で即座にフォールバック返却（Fast-Fail）
        return fallbackFn(new Error(`Circuit is OPEN (Fast-Fail Protection)`), ...args);
      }
    }

    // 🟢 2. 通信実行（CLOSED または HALF_OPEN）
    try {
      const result = await this.callWithTimeout(actionFn, args);
      this.onSuccess(); // 成功時処理
      return result;
    } catch (err: unknown) {
      // 失敗時: 型ガードで Error 型を取り出し、遮断判定 ➔ フォールバック返却
      const error = err instanceof Error ? err : new Error(String(err));
      this.onFailure(error);
      return fallbackFn(error, ...args);
    }
  }

  // 成功時: カウントリセット ＆ HALF_OPENなら完全復旧(CLOSED)へ戻す
  private onSuccess(): void {
    this.failureCount = 0;
    if (this._state === "HALF_OPEN") {
      this.successCount++;
      this.transitionTo("CLOSED");
    }
  }

  // 失敗時: 閾値超過でお試し失敗なら回路を遮断(OPEN)へ
  private onFailure(err: Error): void {
    this.failureCount++;
    if (this._state === "HALF_OPEN" || this.failureCount >= this.failureThreshold) {
      this.transitionTo("OPEN");
    }
  }

  // 状態変更と時刻記録
  private transitionTo(newState: CircuitState): void {
    const oldState = this._state;
    this._state = newState;
    this.lastStateChange = Date.now();
    this.failureCount = 0;
    this.successCount = 0;

    if (this.onStateChange) {
      this.onStateChange(oldState, newState);
    } else {
      console.log(`\n  ⚡ [CircuitBreaker] State Transition: ${oldState} ➔ ${newState}`);
    }
  }
}

/**
 * 指数バックオフ + ジッター（Exponential Backoff & Jitter）
 * リトライ間隔を指数関数的に増やし、さらにランダムな揺らぎを加えて混雑を分散
 */
export async function sleepWithBackoff(
  attempt: number,
  baseDelay = 100,
  maxDelay = 1000
): Promise<void> {
  const exponential = Math.min(maxDelay, baseDelay * Math.pow(2, attempt));
  const jitter = Math.random() * (exponential * 0.5); // 50%のランダム揺らぎ
  const totalDelay = Math.floor(exponential + jitter);
  await new Promise((r) => setTimeout(r, totalDelay));
}
