// ==========================================
// Bad Example: 外部APIの型に直接結合した設計
// 外部APIの型・命名・仕様がドメイン層やサービス層全体に侵食している状態
// ==========================================

// 外部レガシー決済ゲートウェイのAPIレスポンス型
// 命名がスネークケースであり、ステータスが謎の文字列コード ("01": 成功, "02": 失敗)
export interface LegacyPaymentApiResponse {
  tx_id: string;
  pay_amt: number;       // マイナス値や小数が入るリスクがある
  tx_stat_cd: string;    // "01": 成功, "02": 失敗, "03": 処理中
  currency_iso: string;  // "JPY", "USD" 等
}

// ドメインエンティティ（外部API型に直接依存してしまっている）
export class OrderBad {
  public id: string;
  public totalAmount: number;
  public status: "PENDING" | "PAID" | "FAILED" = "PENDING";
  public paymentDetails?: LegacyPaymentApiResponse; // 外部APIレスポンスをそのまま保持

  constructor(id: string, totalAmount: number) {
    this.id = id;
    this.totalAmount = totalAmount;
  }

  // 外部APIのレスポンスを直接受け取って決済完了処理を行う
  // 外部コード "01" やスネークケースのプロパティにドメインロジックが依存
  public applyPayment(apiResponse: LegacyPaymentApiResponse): void {
    // 問題1: "01" という外部仕様のマジックコードがドメイン層に侵食
    if (apiResponse.tx_stat_cd === "01") {
      // 問題2: マイナス金額や不正な通貨のチェックがなく、素通りしてしまう
      this.status = "PAID";
      this.paymentDetails = apiResponse;
    } else {
      this.status = "FAILED";
    }
  }
}

// サービス層（注文処理）
export class OrderServiceBad {
  public processOrderPayment(order: OrderBad, apiResponse: LegacyPaymentApiResponse): void {
    order.applyPayment(apiResponse);

    if (order.status === "PAID") {
      console.log(`[Bad] Order ${order.id} paid successfully. Amount: ${apiResponse.pay_amt} ${apiResponse.currency_iso}`);
      this.notifyCustomer(order, apiResponse);
      this.recordAccounting(order, apiResponse);
    } else {
      console.log(`[Bad] Order ${order.id} payment failed.`);
    }
  }

  // メール通知でも外部API型を直接参照
  private notifyCustomer(order: OrderBad, apiResponse: LegacyPaymentApiResponse): void {
    console.log(`[Bad Notification] Sending email to customer for tx: ${apiResponse.tx_id}, amount: ${apiResponse.pay_amt}`);
  }

  // 会計連携でも外部API型を直接参照
  private recordAccounting(order: OrderBad, apiResponse: LegacyPaymentApiResponse): void {
    console.log(`[Bad Accounting] Journal entry recorded. Tx: ${apiResponse.tx_id}, Stat: ${apiResponse.tx_stat_cd}`);
  }
}

// ----------------------------------------------------
// 実行検証シナリオ
// ----------------------------------------------------
function runBadScenario(): void {
  console.log("=== Bad Scenario Execution ===");
  const service = new OrderServiceBad();
  const order = new OrderBad("ORD-001", 1000);

  // 不正な外部APIレスポンス（マイナス金額 -5000円 だがステータスは成功 "01"）
  const malformedApiResponse: LegacyPaymentApiResponse = {
    tx_id: "TX-99999",
    pay_amt: -5000,
    tx_stat_cd: "01",
    currency_iso: "JPY",
  };

  // マイナス金額の不正データにもかかわらず、チェックを素通りして注文が完了してしまう
  service.processOrderPayment(order, malformedApiResponse);
  console.log(`[Bad Result] Final Order Status: ${order.status}, Recorded Amount: ${order.paymentDetails?.pay_amt}`);
}

runBadScenario();
