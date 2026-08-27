# Sample Code & Verification Lab 🧪

本ディレクトリ（`sample-code/`）は、技術書籍（オライリー等）やモダンアーキテクチャの知見を、実践的なコード（TypeScript / Node.js / etc.）で検証するための**実験・検証ラボ**です。

---

## 📂 検証ラボ一覧

| 日付 / フォルダ | 主なテーマ | 言語 / 技術 | 検証内容 |
| :--- | :--- | :--- | :--- |
| [`2026-08-26_typescript-branded-types/`](file:///Users/taiga.ogura/git/study/sample-code/2026-08-26_typescript-branded-types/) | **TypeScript ブランド型（Branded Types / Nominal Typing）** | TypeScript (Node v25) | 単純な型エイリアスの限界（引数順序逆転・異種通貨加算）を克服し、unique symbol によるゼロコスト名目的型安全性を実証 |
| [`2026-08-24_circuit-breaker-resilience/`](file:///Users/taiga.ogura/git/study/sample-code/2026-08-24_circuit-breaker-resilience/) | **サーキットブレーカー & フォールバック耐障害性** | TypeScript (Node v25) | 『Release It! 第2版』に基づく連鎖障害防止、タイムアウト、サーキットブレーカー（OPEN/HALF-OPEN/CLOSED）検証 |

---

## 🛠️ 検証の標準ステップ

1. **Before (❌ アンチパターン) の実装**: 現場で起きがちな課題や障害シナリオを再現。
2. **After (⭕️ ベストプラクティス) の実装**: 書籍やデザインパターンに基づく堅牢な設計。
3. **ベンチマーク / 比較実行**: `run_comparison` スクリプトでレスポンス時間・耐障害性・保守性を数値とログで実証。
4. **README.md への結果ドキュメント化**: 実務やブログ（Qiita）に活用できる知見の整理。
