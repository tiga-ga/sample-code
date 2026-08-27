# TypeScript ブランド型（Branded Types）検証ラボ

引数の順序取り違えによる重大インシデント（他人の注文キャンセルや4,500万円の誤請求など）を、ブランド型によってコンパイルエラーで阻止できるかを検証するサンプルコードです。

---

## ファイル構成

```text
├── bad.ts        # Bad: 通常の型エイリアス（型チェックを素通りしてしまうコード）
├── good.ts       # Good: ブランド型（型チェックでコンパイルエラーになるコード）
└── package.json
```

---

## 検証コマンド（これ1つだけ！）

```bash
npm run check
```

### 実行結果

```text
good.ts(43,13): error TS2345: Argument of type 'BrandOrderId' is not assignable to parameter of type 'BrandUserId'.
  Type 'BrandOrderId' is not assignable to type '{ readonly [__brand]: "UserId"; }'.
    Types of property '[__brand]' are incompatible.
      Type '"OrderId"' is not assignable to type '"UserId"'.

good.ts(44,16): error TS2345: Argument of type 'BrandJPY' is not assignable to parameter of type 'BrandUSD'.
  Type 'BrandJPY' is not assignable to type '{ readonly [__brand]: "USD"; }'.
    Types of property '[__brand]' are incompatible.
      Type '"JPY"' is not assignable to type '"USD"'.
```

---

## ここがポイント

* **bad.ts**: 関数の引数に `UserId` や `OrderId` と指定しているにもかかわらず、中身がただの `string` / `number` なので **エラー0件で素通り** してしまいます（本番で重大インシデントが発生する）。
* **good.ts**: 関数の引数にブランド型（`BrandUserId`, `BrandOrderId` 等）を指定しているため、**TypeScriptが即座にピンポイントでコンパイルエラーを検知**します。
