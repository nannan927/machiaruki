# 地図の余白 / Machinote

街歩きの気づきを場所と一緒に残す、個人用の散歩ノートです。

## デモと本番

- `/demo`: ログイン不要、ブラウザー内に保存。サンプルと架空地図で外部APIなしでも利用可能。
- `/`: ログインした本人のメモをSupabaseに保存。
- Google Mapsは初期状態で無効です。公開設定で明示的に有効化し、さらに利用者が表示ボタンを押すまで読み込みません。
- 設計・移行・費用管理・公開前の確認は [本番設計と公開手順](docs/PRODUCTION.md) を参照してください。

## 実装済み

- メール・パスワードの新規登録、メール確認、ログイン、ログアウト
- Google Mapsでの地点選択、保存済みメモのピン表示、ピンから編集
- 現在地取得（利用時にブラウザーの許可が必要）、座標の手動入力
- メモの作成・一覧・編集・確認付き削除
- タイトル・本文・タグの検索（空白区切りAND検索、全角英数字対応）、検索結果と地図の連動
- サーバーでのトークン検証とDBのRLSによるユーザーごとのアクセス制限

## セットアップ

1. Node.js 22以上で `npm install`。
2. `.env.example` を参考に `.env.local` に接続情報を設定。
3. SupabaseのSQL Editorなどで、以下の移行を順に適用。
   - `supabase/migrations/20260510000000_create_memos.sql`
   - `supabase/migrations/20261004000000_private_memos.sql`
   - `supabase/migrations/20261004010000_production_integrity.sql`
4. Supabase AuthでEmailプロバイダーを有効化。Site URLとRedirect URLsに開発URL（例 `http://localhost:3000`）と本番URLを設定。メール確認を有効にして、メール送信設定も確認。
5. Google CloudでMaps JavaScript APIと課金を有効化し、APIキーを設定。キーは使用するHTTPリファラーとMaps JavaScript APIに制限。本番用のMap IDを作成して設定（開発時は `DEMO_MAP_ID` を利用）。
6. `npm run dev` を実行。

現在地取得はHTTPSまたはlocalhostで利用します。地図キーがない場合も、座標入力で場所を指定できます。環境変数変更後は開発サーバーを再起動し、本番では再ビルドしてください。公開する環境変数にservice roleキーや秘密鍵を設定しないでください。

### 既存メモの扱い

2つ目の移行は匿名アクセスを閉じます。旧メモは削除せず、`user_id = NULL` のまま保持し、アプリからは非表示になります。所有者が不明な旧メモを自動的に誰かへ割り当てません。必要なら管理者が所有者を確認して、対象のメモIDを指定して `user_id` を更新してください。移行後に古い移行だけを再実行すると公開ポリシーが戻るため、適用済み移行を再実行しないでください。

## 検証

```bash
npm run lint
npm test
npx tsc --noEmit
npm run build
npx playwright install chromium
npm run test:e2e
```

自動テストは入力検証・検索・未認証API拒否・所有者制約を確認します。ブラウザーテストは外部サービスをモックし、スマホ幅でログインから作成・検索・編集・削除・ログアウト、および位置情報の成功／拒否を検証します。実DBでの検証には上記セットアップが必要です。ユーザーA/Bを作り、AのメモをBが一覧・更新・削除できないことを確認してください。ブラウザーでは地点選択→保存→再読み込み→検索→編集→削除と、位置情報を許可／拒否した場合を確認します。

## API

`/api/memos` 以下は全て `Authorization: Bearer <Supabase access token>` が必要です。

- `GET /api/health`: ヘルスチェック
- `GET /api/memos?q=...&cursor=...`: 本人のメモ一覧。`{ items, nextCursor }` を返す（50件単位）
- `POST /api/memos`: 作成。`Idempotency-Key` に保存操作のUUIDを指定
- `PATCH /api/memos/:id`: `If-Match` に現在のversionを指定して本人のメモを更新（タイトル・本文・緯度経度・タグを送信）
- `DELETE /api/memos/:id`: `If-Match` に現在のversionを指定して本人のメモを削除

参考: [Google Mapsマーカー](https://developers.google.com/maps/documentation/javascript/advanced-markers/add-marker)、[Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)。

`npm run check` はダミーの接続設定に切り替え、静的検証・API/DBテスト・ブラウザーテスト・ビルドをまとめて実行します。生成されたビルドはテスト用です。公開時は本番環境変数で `npm run build` を実行してください。
