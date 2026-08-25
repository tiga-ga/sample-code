# 分散システムの連鎖障害を防ぐ「サーキットブレーカー & フォールバック設計」検証 (TypeScript)

## 実行方法

```bash
# 依存パッケージのインストール
npm install

# Bad実装の実行（遅延とクラッシュの確認）
npm run bad

# Good実装の実行（サーキットブレーカーによる保護確認）
npm run good

# 比較ベンチマークの実行（障害発生〜復旧シナリオ）
npm run compare
```

---

## 実行結果

### 1. Bad実装の単体実行 (`npm run bad`)

```text
=== Running Bad Example (TypeScript) ===
[Bad] Requesting recommendations for user user-123...
[Bad] Attempt 1 failed: 503 Service Unavailable (External Recommendation Service Down for user-123) (1501ms elapsed)
[Bad] Attempt 2 failed: 503 Service Unavailable (External Recommendation Service Down for user-123) (3508ms elapsed)
[Bad] Attempt 3 failed: 503 Service Unavailable (External Recommendation Service Down for user-123) (5511ms elapsed)

User Request Failed completely! Total time wasted: 5511ms
Error details: [FATAL] Failed to fetch recommendations after 3 attempts: 503 Service Unavailable (External Recommendation Service Down for user-123)
```

* **何が起こったか**: タイムアウト未設定のため外部APIの遅延に付き合い、固定間隔でリトライを繰り返して約5.5秒間サーバーがハングアップした末に、画面全体が致命的エラー（500エラー）でクラッシュしました。

---

### 2. Good実装の単体実行 (`npm run good`)

```text
=== Running Good Example with Circuit Breaker (TypeScript) ===

Request resolved gracefully in 502ms: {
  userId: 'user-123',
  recommendations: [ 'Trending Item A', 'Popular Item B', 'Seasonal Special C' ],
  isFallback: true,
  fallbackReason: 'Operation timed out after 500ms'
}
```

* **何が起こったか**: 外部APIの遅延（1000ms）を500msのタイムアウトで安全に打ち切り、画面をクラッシュさせずに静的な人気商品リスト（フォールバック）を即座に返却してユーザー体験を守りました。

---

### 3. 比較ベンチマーク実行 (`npm run compare`)

```text
[TypeScript] サーキットブレーカー耐障害性 比較検証スタート

=======================================================
1. [Bad Implementation] 障害時の挙動検証 (3リクエスト)
=======================================================
[Bad] Requesting recommendations for user user-1...
[Bad] Attempt 1 failed: 503 Service Unavailable (1502ms elapsed)
[Bad] Attempt 2 failed: 503 Service Unavailable (3504ms elapsed)
[Bad] Attempt 3 failed: 503 Service Unavailable (5508ms elapsed)
[Req #1] 致命的エラー (所要時間: 5508ms)
[Bad] Requesting recommendations for user user-2...
[Bad] Attempt 1 failed: 503 Service Unavailable (1502ms elapsed)
[Bad] Attempt 2 failed: 503 Service Unavailable (3505ms elapsed)
[Bad] Attempt 3 failed: 503 Service Unavailable (5508ms elapsed)
[Req #2] 致命的エラー (所要時間: 5508ms)
[Bad] Requesting recommendations for user user-3...
[Bad] Attempt 1 failed: 503 Service Unavailable (1501ms elapsed)
[Bad] Attempt 2 failed: 503 Service Unavailable (3504ms elapsed)
[Bad] Attempt 3 failed: 503 Service Unavailable (5506ms elapsed)
[Req #3] 致命的エラー (所要時間: 5506ms)

Bad合計所要時間: 16524ms (わずか3リクエストで16.5秒ブロッキングされクラッシュ)

=======================================================
2. [Good Implementation] サーキットブレーカー検証 (10リクエスト)
=======================================================
[Req #01] フォールバック返却 (301ms) [State: CLOSED]
  [CircuitBreaker] State Transition: CLOSED -> OPEN
[Req #02] フォールバック返却 (301ms) [State: OPEN]
[Req #03] フォールバック返却 (0ms)   [State: OPEN]   <-- 外部通信をスキップして即返却！
[Req #04] フォールバック返却 (1ms)   [State: OPEN]
[Req #05] フォールバック返却 (0ms)   [State: OPEN]

  >>> [Mock Infrastructure] 外部APIが正常復旧しました！ <<<
[Req #06] フォールバック返却 (0ms)   [State: OPEN]
  [CircuitBreaker] State Transition: OPEN -> HALF_OPEN
  [CircuitBreaker] State Transition: HALF_OPEN -> CLOSED
[Req #07] 正常レスポンス (51ms) [State: CLOSED]       <-- 自動で自己修復！
[Req #08] 正常レスポンス (51ms) [State: CLOSED]
[Req #09] 正常レスポンス (51ms) [State: CLOSED]
[Req #10] 正常レスポンス (51ms) [State: CLOSED]

Good合計所要時間: 4818ms (10リクエストすべてがユーザーを待たせずに即座に応答完了)
```

* **何が起こったか**: Badは3回のリクエストで16.5秒拘束されて全滅したのに対し、Goodは2回失敗を検知した瞬間に通信を遮断（OPEN）して以降0msでフォールバックを返却し、外部復旧後は自動で完全復帰（CLOSED）しました。
