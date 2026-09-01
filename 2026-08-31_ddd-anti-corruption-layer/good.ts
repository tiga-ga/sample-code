// ==========================================
// Good Example: 腐敗防止層（ACL: Anti-Corruption Layer）を導入した設計
// 外部APIの仕様を境界で遮断し、自ドメインのValue Object / Entityへ翻訳する
// ==========================================

// 外部レガシー決済ゲートウェイのAPIレスポンス型（bad.ts と同一）
export interface LegacyPaymentApiResponse {
  tx_id: string;
  pay_amt: number;       // マイナス値や小数が入るリスクがある
  tx_stat_cd: string;    // "01": 成功, "02": 失敗, "03": 処理中
  currency_iso: string;  // "JPY", "USD" 等
}

// ----------------------------------------------------
// 1. 自ドメイン層 (Domain Layer)
// 外部APIの存在を一切知らず、自らのビジネスルールを100%守る
// ----------------------------------------------------

// 値オブジェクト: 金額 (Money)
// 不正な金額（マイナス・小数）の生成を物理的に防ぐ
export class Money {
  public readonly amount: number;
  public readonly currency: string;

  private constructor(amount: number, currency: string) {
    this.amount = amount;
    this.currency = currency;
  }

  public static create(amount: number, currency: string = "JPY"): Money {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error(`[Domain Violation] 金額は1以上の整数である必要があります: ${amount}`);
    }
    return new Money(amount, currency);
  }

  public equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }
}

// 型安全な決済ステータス
export type PaymentStatus = "COMPLETED" | "FAILED" | "PENDING";

// 値オブジェクト: ドメイン決済結果 (PaymentTransaction)
export class PaymentTransaction {
  public readonly transactionId: string;
  public readonly money: Money;
  public readonly status: PaymentStatus;
  public readonly processedAt: Date;

  public constructor(
    transactionId: string,
    money: Money,
    status: PaymentStatus,
    processedAt: Date
  ) {
    this.transactionId = transactionId;
    this.money = money;
    this.status = status;
    this.processedAt = processedAt;
  }

  public isSuccessful(): boolean {
    return this.status === "COMPLETED";
  }
}

// ドメインエンティティ: 注文 (Order)
export class OrderGood {
  public readonly id: string;
  public readonly totalAmount: Money;
  public status: "PENDING" | "PAID" | "FAILED" = "PENDING";
  public paymentTransaction?: PaymentTransaction;

  constructor(id: string, totalAmount: Money) {
    this.id = id;
    this.totalAmount = totalAmount;
  }

  // ドメインの決済結果オブジェクトのみを受け入れる（自己防衛）
  public applyPayment(transaction: PaymentTransaction): void {
    if (!transaction.isSuccessful()) {
      this.status = "FAILED";
      return;
    }

    // 請求金額と支払金額の一致をチェック
    if (!this.totalAmount.equals(transaction.money)) {
      throw new Error(`[Domain Violation] 支払金額 (${transaction.money.amount}) が注文合計 (${this.totalAmount.amount}) と一致しません`);
    }

    this.status = "PAID";
    this.paymentTransaction = transaction;
  }
}

// ----------------------------------------------------
// 2. 腐敗防止層 (ACL: Anti-Corruption Layer)
// 外部APIレスポンスを受け取り、バリデーションとドメインモデルへの翻訳を行う門番
// ----------------------------------------------------
export class PaymentAclTranslator {
  public static toDomain(apiResponse: LegacyPaymentApiResponse): PaymentTransaction {
    // ステータスコードの翻訳 ("01" -> "COMPLETED")
    let domainStatus: PaymentStatus;
    switch (apiResponse.tx_stat_cd) {
      case "01":
        domainStatus = "COMPLETED";
        break;
      case "02":
        domainStatus = "FAILED";
        break;
      case "03":
        domainStatus = "PENDING";
        break;
      default:
        throw new Error(`[ACL Error] 未知の外部決済ステータスコードです: ${apiResponse.tx_stat_cd}`);
    }

    // 金額のバリデーションとValue Objectへの変換（マイナス値などはここで即座に弾く）
    const money = Money.create(apiResponse.pay_amt, apiResponse.currency_iso);

    return new PaymentTransaction(
      apiResponse.tx_id,
      money,
      domainStatus,
      new Date()
    );
  }
}

// ----------------------------------------------------
// 3. サービス層 (Service Layer)
// ドメインモデルのみに依存し、外部仕様変更の影響を受けない
// ----------------------------------------------------
export class OrderServiceGood {
  public processOrderPayment(order: OrderGood, transaction: PaymentTransaction): void {
    order.applyPayment(transaction);

    if (order.status === "PAID") {
      console.log(`[Good] Order ${order.id} paid successfully. Amount: ${transaction.money.amount} ${transaction.money.currency}`);
      this.notifyCustomer(order, transaction);
      this.recordAccounting(order, transaction);
    } else {
      console.log(`[Good] Order ${order.id} payment failed.`);
    }
  }

  private notifyCustomer(order: OrderGood, transaction: PaymentTransaction): void {
    console.log(`[Good Notification] Sending email for tx: ${transaction.transactionId}, amount: ${transaction.money.amount}`);
  }

  private recordAccounting(order: OrderGood, transaction: PaymentTransaction): void {
    console.log(`[Good Accounting] Journal entry recorded. Tx: ${transaction.transactionId}, Stat: ${transaction.status}`);
  }
}

// ----------------------------------------------------
// 実行検証シナリオ
// ----------------------------------------------------
function runGoodScenario(): void {
  console.log("=== Good Scenario Execution ===");
  const service = new OrderServiceGood();
  const order = new OrderGood("ORD-001", Money.create(1000, "JPY"));

  // 1. 正常系データの検証
  console.log("--- 1. Valid API Response Case ---");
  const validApiResponse: LegacyPaymentApiResponse = {
    tx_id: "TX-10001",
    pay_amt: 1000,
    tx_stat_cd: "01",
    currency_iso: "JPY",
  };

  const validTransaction = PaymentAclTranslator.toDomain(validApiResponse);
  service.processOrderPayment(order, validTransaction);
  console.log(`[Good Result 1] Final Order Status: ${order.status}`);

  // 2. 不正データ（マイナス金額 -5000円）の防御検証
  console.log("\n--- 2. Malformed API Response Case (Blocked by ACL) ---");
  const malformedApiResponse: LegacyPaymentApiResponse = {
    tx_id: "TX-99999",
    pay_amt: -5000,
    tx_stat_cd: "01",
    currency_iso: "JPY",
  };

  try {
    // 腐敗防止層（ACL）の境界で即座に例外が発生し、ドメイン層への侵入を阻止
    const blockedTransaction = PaymentAclTranslator.toDomain(malformedApiResponse);
    service.processOrderPayment(order, blockedTransaction);
  } catch (error) {
    if (error instanceof Error) {
      console.log(`[Good Result 2] Safely Blocked by ACL: ${error.message}`);
    }
  }
}

runGoodScenario();
