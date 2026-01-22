# Conversation Cards

React + FastAPI + SQLite で仕様に沿った会話カード管理を行うサンプルアプリです。

## 構成

- `backend/` FastAPI + SQLite
- `frontend/` React (Vite)
- ルートに仕様ファイル (`API設計_v1.0.txt` ほか)

## セットアップ

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8003
```

`SQL_DDL_v1.0.sql` を読み込んで `backend/app.db` を初期化します。

### Frontend

```bash
cd frontend
npm install
npm run dev
```

ブラウザで `http://localhost:5176` を開きます。API は `/api` でプロキシされます。

## メモ

- ロール付与や関連付けの LLM 実行はキュー処理を想定し、API では `queued: true` を返す形にしています。
- Import は改行単位でカードを分割します。