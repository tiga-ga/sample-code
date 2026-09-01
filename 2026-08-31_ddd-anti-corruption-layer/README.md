# 外部API直結合 vs 腐敗防止層 (ACL) 検証 (2026-08-31)

外部API（レガシー決済API）のレスポンスモデルにドメイン層を直接結合させたアンチパターン（Bad）と、腐敗防止層（ACL: Anti-Corruption Layer）およびValue Objectを導入してドメインを防御するベストプラクティス（Good）を比較検証するサンプルコードです。

---

## ファイル構成

```text
├── bad.ts         # Bad: 外部API型に直結合（マイナス金額の素通り、外部変更で全層破綻）
├── good.ts        # Good: 腐敗防止層(ACL)で自ドメイン型(Money等)に翻訳・自己防衛
├── package.json   # 依存関係および実行スクリプト
└── tsconfig.json  # TypeScriptコンパイラ設定
```

---

## 検証コマンド

### 1. 型チェック検証

```bash
npm run check
```

### 2. アンチパターン（Bad）の実行検証

```bash
npm run run:bad
```

#### 実行結果（Bad）

```text
=== Bad Scenario Execution ===
[Bad] Order ORD-001 paid successfully. Amount: -5000 JPY
[Bad Notification] Sending email to customer for tx: TX-99999, amount: -5000
[Bad Accounting] Journal entry recorded. Tx: TX-99999, Stat: 01
[Bad Result] Final Order Status: PAID, Recorded Amount: -5000
```

マイナス金額（-5000円）の不正な外部データにもかかわらず、チェックを素通りして注文が確定され、メール送信や会計ログまで不正データで汚染されてしまいます。

---

### 3. ベストプラクティス（Good）の実行検証

```bash
npm run run:good
```

#### 実行結果（Good）

```text
=== Good Scenario Execution ===
--- 1. Valid API Response Case ---
[Good] Order ORD-001 paid successfully. Amount: 1000 JPY
[Good Notification] Sending email for tx: TX-10001, amount: 1000
[Good Accounting] Journal entry recorded. Tx: TX-10001, Stat: COMPLETED
[Good Result 1] Final Order Status: PAID

--- 2. Malformed API Response Case (Blocked by ACL) ---
[Good Result 2] Safely Blocked by ACL: [Domain Violation] 金額は1以上の整数である必要があります: -5000
```

正常系データは正しく自ドメイン型（Money, PaymentTransaction）に翻訳されて注文が完了します。一方、マイナス金額の不正データは腐敗防止層（ACL）の境界で即座に例外として弾かれ、ドメイン層へのデータ汚染を100%遮断します。

---

## ここがポイント

| 観点 | bad.ts (直結合) | good.ts (ACL導入) |
| :--- | :--- | :--- |
| **外部モデルの取り込み** | 外部DTOを注文エンティティやServiceが直接受け取る | 腐敗防止層（PaymentAclTranslator）が自ドメインモデルへ翻訳 |
| **不正データの防御** | 画面や外部を盲信し、マイナス金額が素通りしてデータ汚染 | Money（Value Object）が生成時に自己検証し、境界で即座に遮断 |
| **ステータス管理** | "01" などの外部コードがドメイン層に散乱 | PaymentStatus（COMPLETED / FAILED / PENDING）に型安全化 |
| **外部API仕様変更耐性** | 外部キー名変更時にシステム全体（Entity/Service/UI）が連鎖破壊 | 外部変更があっても ACL の翻訳関数1箇所を直すだけでドメイン層は無傷 |
