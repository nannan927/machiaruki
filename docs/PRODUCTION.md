# 本番設計と公開手順

## 対象

本人だけが読める街歩きメモ。デモ `/demo` はブラウザー保存を維持し、本番 `/` のSupabase保存と分離する。公開先はVercel Hobby（個人・非商用）＋Supabase。デモと本番コードは同じデプロイに含める。

## 設計上の決定

- 認証はSupabase Auth。ブラウザーのセッションからBearerトークンを送信し、APIは毎回 `getUser` で検証。Cookie認証を使わないためAPIはCookieを認証根拠にしない。本文・タグはReactのテキスト描画、地図上の見出しはDOMのtextContentで表示し、HTMLを実行しない。
- APIのユーザー条件とPostgres RLSを併用。ユーザーIDを入力から採用しない。旧匿名メモは削除せず隔離する。
- 作成はクライアントが操作ごとに生成するUUIDを使用。同一UUID・同一内容の再送は既存結果を返す。内容の異なる再送は409。編集・削除は整数versionによる楽観ロックで古い画面からの上書きを拒否する。
- 一覧は50件単位のカーソルページング。作成日時・IDの降順で同日時のメモも漏らさない。検索はDBで全件を対象に本文・タイトル・タグをNFKC正規化してAND検索する。検索レスポンスの逆転はAbortControllerと世代管理で防ぐ。
- 保存失敗時には入力を残す。編集中の画面切り替え・ページ離脱には確認を入れる。メモの書き込みは再試行をユーザー操作に限定する。
- 背景地図はLeaflet 1.9.4＋国土地理院の淡色タイル。Next.jsのクライアント専用遅延読み込みでSSR時のwindow参照を避ける。地図用APIキーは不要。Google Maps SDKと読み込み経路は削除。デモは架空地図を維持し、利用者が切り替えたときだけ実地図を表示する。
- タイルはブラウザーから必要な範囲を取得し、出典リンクを常時表示。提供ズーム上限18以上は既存画像を拡大する。エラー・12秒のタイムアウト時には再読み込みを提示し、座標選択とメモ保存は維持する。
- 現在地はボタン操作時の単発取得。青点と精度の円を表示し、選択座標と区別する。遅れて返った位置情報は、地図・手動座標で選び直した場所を上書きしない。地図の破棄時はイベント、レイヤー、ResizeObserver、タイマーを解放する。

## 公開前に必要な設定

1. ステージング用Supabaseを作り、`supabase/migrations` のSQLをファイル名順に一度ずつ適用する。適用前に既存データをバックアップ。旧公開ポリシーを戻すため、古いSQLだけの再実行は禁止。
2. Email認証・メール確認を設定。個人利用はSupabaseの「Allow new users to sign up」を無効にし、`NEXT_PUBLIC_ALLOW_SIGNUP=false` とする（画面のフラグだけでは登録APIを停止できない）。管理画面で本人用アカウントを作成する。一般公開する場合は本番SMTPを用意してから両方の新規登録設定を有効にする。Site URLと許可Redirect URLsに実際のHTTPSドメインおよび `/auth/reset` を登録する。Authのレート制限を設定する。
3. `.env.example` の公開用値をホストに登録。service_roleや秘密鍵を `NEXT_PUBLIC_*` に入れない。ローカルの `.env.local` を配布しない。
4. 地理院タイルの出典表示と実機の現在地許可・拒否を確認。地図配信の利用条件は https://maps.gsi.go.jp/development/ichiran.html を参照。
5. `npm run preflight` で環境変数を値を表示せず検査。Node 22で `npm ci`, `npm run check`, `npm run build` を実行。`npm start` で起動。ブラウザーに埋め込む環境変数はビルド時に確定する。
6. ステージングの実アカウントA/Bで、メール確認・ログイン・パスワード再設定・作成・編集競合・削除・ユーザー間の分離を確認する。
7. HTTPS配信、アクセスログにAuthorization/本文/キーを出さない設定、DBバックアップと復元手順、稼働監視 `/api/health` を設定する。ヘルスチェックはアプリの生存のみを示しDBの稼働保証ではない。

## 検証の境界

単体/APIテスト・ブラウザーモック・PGlite上の実SQL/RLS検証を自動実行する。PGliteではSupabase固有のAuthテーブルと `auth.uid()` をテスト用に再現するため、実SupabaseのAuth/メール配送/ネットワーク/公開ホストの検証は別途必要。公開準備ができても、これらが未検証なら本番稼働済みとは扱わない。

## 残る運用リスク

- Google Mapsへの従量課金リクエストは行わない。ホスト・Supabaseの費用とスパム対策は別途管理する。地理院タイルの継続提供・可用性をアプリ側で保証しない。
- 現行の検索はユーザー単位の部分一致。大量の個人メモで遅くなった場合は実測して索引を追加する。
- セッションはSupabaseブラウザーSDKが管理する。端末共有時はログアウトし、第三者スクリプトを追加する際は認証情報への影響をレビューする。
- CIのnpm監査は実行時依存を検査する。開発用ESLint依存の未修正アドバイザリーも定期確認する。

## Vercelへの公開設定

- `vercel.json` でNext.js、`npm ci`、`npm run preflight && npm run build` を指定。Node.jsはローカル・CIと同じ22系を使用する。
- VercelのProduction環境には、接続できるSupabaseプロジェクトの `NEXT_PUBLIC_SUPABASE_URL` と公開用の `NEXT_PUBLIC_SUPABASE_ANON_KEY`、個人公開用の `NEXT_PUBLIC_ALLOW_SIGNUP=false` を登録する。Google Mapsの環境変数・秘密キーは登録しない。
- `.vercelignore` でローカル環境変数・生成物をアップロード対象から外し、`.vercel/` はGit管理対象から除外する。
- この時点の公開対象コードは `codex/production-notebook-checkpoint` にある。Git連携時は、別の更新がある `main` をそのまま本番コードと誤認しない。CLIで対象コードを明示して公開するか、統合内容を確認してから本番ブランチを設定する。
- SupabaseのSite URLと認証リダイレクトURLは、取得した本番HTTPS URLに合わせて設定する。メール認証を一般利用者に提供するには独自SMTPが必要。Supabase標準メール送信はチームの許可されたアドレス向けで、本番メール配信の代用にはしない。
- `preflight` は設定形式の検査のみ。公開前にSupabaseプロジェクトの稼働・移行履歴・RLS・認証を別途確認し、到達不能な接続先で公開完了とは扱わない。

## 今回の個人公開

以下は初回公開時の記録。現在の一般公開設定は末尾を参照。

- 本番URL: https://machiaruki-omega.vercel.app （デモは `/demo`）。Vercelプロジェクト `machiaruki`、Hobby、Node.js 22。
- Git連携のProduction Branchは `codex/production-notebook-checkpoint`。このブランチへのpushは本番デプロイを開始する。
- Supabaseプロジェクト `roubcmewaeubmvlynxzk`。空のDBであることを確認し、3つの既存migrationをまとめた `supabase/bootstrap-new-project.sql` を単一トランザクションで適用した。既存のmemosがある場合は停止する。新規の空プロジェクト専用で、通常の追加migrationの代わりには使わない。
- SQL Editor経由で適用したためCLIのmigration履歴は未登録。初期migrationをそのまま再実行しない。将来CLIへ移行する際は実スキーマと照合して適用済み履歴を整備する。
- `supabase/verify-production.sql` で実Supabase上の本人CRUD・検索・version更新・他人の読み書き拒否・匿名拒否を検証済み。検証ユーザーとメモはトランザクションをロールバックして残さない。
- 新規登録と匿名ログインを無効化、メール確認は有効のまま。Site URLを本番URL、許可Redirect URLを本番の `/auth/reset` に設定。
- 本人用アカウントの作成と、そのアカウントによる本番ログイン・メモ保存・メール再設定の実動作確認は、本人の入力後に実施する。パスワードはチャットやリポジトリに記録しない。

## Googleログインによる一般公開（2026-10-04）

- 公開URLと保存先DBはそのまま。DBスキーマ・既存メモ・デモを変更しない。
- 一般向け入口はGoogleログイン。`NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`、メール新規登録画面は `NEXT_PUBLIC_ALLOW_SIGNUP=false` のまま。既存のメール・パスワードログインも維持する。
- SupabaseはGoogleプロバイダーと新規登録を有効にし、匿名ログインは無効、メール確認は有効を維持する。新規登録の許可はプロバイダー共通であり、画面のメール登録フラグはバックエンドの登録禁止ではない。
- Google Cloudに認証専用プロジェクト `machiaruki-login` を作成。Google Auth Platformの対象は外部・本番。OAuthクライアントはWeb用で、生成元は本番URL、Googleからの戻り先は `https://roubcmewaeubmvlynxzk.supabase.co/auth/v1/callback`。
- GoogleのクライアントシークレットはSupabaseのGoogle設定にのみ登録し、ソース・Vercel環境変数・ログには保存しない。Maps APIや有料リソースを有効にしない。
- Supabaseの許可Redirect URLに `https://machiaruki-omega.vercel.app/auth/callback` を追加。ブラウザーSDKがOAuthセッションを保存し、コールバック画面から `/` に戻る。失敗・キャンセル時は再試行へのリンクを表示する。
- `/privacy` に実装に即したデータの取り扱いを記載し、Googleのアプリ情報とログイン画面からリンクする。
- SMTPは未設定。メールによる一般登録や一般利用者へのパスワード再設定メールは提供しない。Google利用者はGoogleでログインする。既存メールアカウントの再設定機能はSupabase標準SMTPの送信先制限を受ける。
- 自動チェックは単体/API/DBテスト34件、ブラウザーテスト28件、個人公開設定テスト1件が成功。Googleの認可URLへの遷移・キャンセル・セッション確立は外部接続をモックして検証し、有料Mapsエンドポイントへの通信がないことも確認する。lint・型検査・本番ビルドも成功。
- 本番反映後、実Googleアカウントで同意・新規登録・アプリへの復帰を確認済み。新規アカウントで検証メモを保存し、ページ再読み込み後の表示と削除を確認した。検証メモは残していない。
- 本番と同じGoogle有効・メール新規登録画面無効の組み合わせでも関連ブラウザーテスト6件が成功。公開サイトの `/privacy`・`/demo`・`/api/health` は200、未認証の `/api/memos` は401・`private, no-store` を確認。GitHub Actionsも成功。
- Google同意画面ではアプリ名の代わりにSupabaseプロジェクトのドメインが表示される。基本プロフィールとメールアドレスだけを要求し、機密スコープやMapsの権限は要求しない。
- 一般登録を停止する場合はSupabaseの「Allow new users to sign up」を無効化する。Googleボタンを非表示にする場合はVercelの `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false` と再デプロイが必要。
