# Machinote

街歩きしながら、場所にメモを残す MVP1 プロトタイプです。

## セットアップ

1. 依存関係をインストール

```bash
npm install
```

2. `.env.local` を作成

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

> 現在の実装では地図はプレースホルダー表示です。Google Maps 連携は次ステップで置き換えます。

3. 開発サーバー起動

```bash
npm run dev
```

## API

- `GET /api/health` : ヘルスチェック
- `GET /api/memos` : メモ一覧取得
- `POST /api/memos` : メモ作成

## 複数PRのコンフリクトをまとめて解消する

複数のPRブランチで `main` との乖離が起きている場合、以下のスクリプトで一括更新できます。

```bash
bash scripts/resolve-pr-conflicts.sh <pr-branch-1> <pr-branch-2> ...
```

例:

```bash
bash scripts/resolve-pr-conflicts.sh codex-0m20ou codex/create-value-through-accumulation
```

- `main` を最新化したうえで、指定した各PRブランチへ順番に `main` をマージして `push` します。
- 競合が起きた場合はそのブランチで停止し、`git status` で競合ファイルを確認できます。
- 競合を手動解消後、`git add` → `git commit` → `git push` を実行して再開してください。
