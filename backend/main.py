"""
CMS v1.2.0 - Thin BFF (Backend For Frontend)
Responsibilities:
  - FTP file I/O bridge
  - Character encoding auto-detection + conversion (chardet)
  - AI API proxy (Nano Banana - 3 modes)
  - Secret key hiding
NO business logic, NO HTML parsing, NO template processing.
"""
import os
import re
import time
import base64
import mimetypes
from io import BytesIO
from contextlib import asynccontextmanager

import chardet
import aioftp
import httpx
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Config ────────────────────────────────────────────────
FTP_HOST = os.environ.get("FTP_HOST", "localhost")
FTP_USER = os.environ.get("FTP_USER", "anonymous")
FTP_PASS = os.environ.get("FTP_PASS", "")
FTP_BASE = os.environ.get("FTP_BASE_PATH", "/")
BANANA_API_KEY = os.environ.get("BANANA_API_KEY", "")
BANANA_API_URL = os.environ.get("BANANA_API_URL", "https://api.nanobanana.com/v1")
ALLOWED_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")

app = FastAPI(title="CMS BFF", version="1.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

# ── CSRF Protection (Stateless HMAC) ─────────────────────
import hmac
import hashlib
import secrets
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

CSRF_TOKEN_HEADER = "X-CSRF-Token"
CSRF_SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
CSRF_TOKEN_TTL = 3600  # 1 hour
CSRF_SECRET = os.environ.get("CSRF_SECRET", secrets.token_hex(32))


def _generate_csrf_token() -> str:
    """Generate a stateless HMAC-signed CSRF token: timestamp.signature"""
    timestamp = str(int(time.time()))
    signature = hmac.new(
        CSRF_SECRET.encode(), timestamp.encode(), hashlib.sha256
    ).hexdigest()
    return f"{timestamp}.{signature}"


def _validate_csrf_token(token: str) -> bool:
    """Validate HMAC signature and TTL of a stateless CSRF token."""
    parts = token.split(".")
    if len(parts) != 2:
        return False
    timestamp, signature = parts
    try:
        issued_at = int(timestamp)
    except ValueError:
        return False
    if time.time() - issued_at > CSRF_TOKEN_TTL:
        return False
    expected = hmac.new(
        CSRF_SECRET.encode(), timestamp.encode(), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)


class CSRFMiddleware(BaseHTTPMiddleware):
    """
    Stateless CSRF protection using HMAC-signed tokens.
    Serverless-compatible: no in-memory state required.
    GET /api/csrf-token issues a signed token.
    POST/PUT/DELETE require a valid token in the X-CSRF-Token header.
    """
    async def dispatch(self, request: Request, call_next):
        if request.url.path == "/api/csrf-token" and request.method == "GET":
            return JSONResponse({"csrfToken": _generate_csrf_token()})

        if request.method not in CSRF_SAFE_METHODS and request.url.path.startswith("/api/"):
            token = request.headers.get(CSRF_TOKEN_HEADER)
            if not token or not _validate_csrf_token(token):
                return JSONResponse({"error": "CSRF token missing or invalid"}, status_code=403)

        return await call_next(request)

app.add_middleware(CSRFMiddleware)

# ── Helpers ───────────────────────────────────────────────

def safe_path(path: str) -> str:
    """Path traversal prevention: ensure path stays within FTP_BASE."""
    normalized = os.path.normpath(path).replace("\\", "/")
    if normalized.startswith("..") or "/../" in normalized:
        raise HTTPException(400, "Invalid path")
    return FTP_BASE.rstrip("/") + "/" + normalized.lstrip("/")


def extract_meta_charset(raw: bytes) -> str | None:
    """Extract charset from <meta> tag in raw bytes (before full decode)."""
    # Try first 4KB for speed
    head = raw[:4096]
    try:
        snippet = head.decode("ascii", errors="ignore")
    except Exception:
        return None
    # <meta charset="...">
    m = re.search(r'<meta[^>]+charset=["\']?([^"\'\s;>]+)', snippet, re.I)
    if m:
        return m.group(1).strip().lower()
    # <meta http-equiv="Content-Type" content="...; charset=...">
    m = re.search(r'content=["\'][^"\']*charset=([^"\'\s;]+)', snippet, re.I)
    if m:
        return m.group(1).strip().lower()
    return None


ENCODING_ALIASES = {
    "shift_jis": "cp932",
    "shiftjis": "cp932",
    "sjis": "cp932",
    "euc-jp": "euc_jp",
    "eucjp": "euc_jp",
}

def normalize_encoding(enc: str) -> str:
    return ENCODING_ALIASES.get(enc.lower().replace("-", "_"), enc)


TEXT_EXTENSIONS = {
    ".html", ".htm", ".css", ".js", ".json", ".xml",
    ".txt", ".csv", ".svg", ".md", ".php",
}

def is_text_file(path: str) -> bool:
    ext = os.path.splitext(path)[1].lower()
    return ext in TEXT_EXTENSIONS


@asynccontextmanager
async def ftp_connection():
    client = aioftp.Client()
    await client.connect(FTP_HOST)
    await client.login(FTP_USER, FTP_PASS)
    try:
        yield client
    finally:
        await client.quit()

# ── API Endpoints ─────────────────────────────────────────

@app.get("/api/ftp/list")
async def ftp_list(path: str = "/"):
    """FTPディレクトリ一覧取得"""
    ftp_path = safe_path(path)
    entries = []
    try:
        async with ftp_connection() as client:
            async for item_path, info in client.list(ftp_path):
                name = str(item_path).split("/")[-1]
                if not name:
                    continue
                file_type = "directory" if info.get("type") == "dir" else "file"
                entries.append({
                    "name": name,
                    "path": path.rstrip("/") + "/" + name,
                    "type": file_type,
                    "size": int(info.get("size", 0)),
                    "modified": info.get("modify", ""),
                    "mimeType": mimetypes.guess_type(name)[0] or "",
                })
    except Exception as e:
        raise HTTPException(502, f"FTP接続エラー: {e}")
    return entries


@app.get("/api/ftp/read")
async def ftp_read(path: str):
    """
    FTPファイル読み取り
    テキストファイル: 文字コード自動判定 → UTF-8変換して返却
    バイナリファイル: base64で返却
    """
    ftp_path = safe_path(path)
    try:
        async with ftp_connection() as client:
            buf = BytesIO()
            async with client.download_stream(ftp_path) as stream:
                async for block in stream.iter_by_block(8192):
                    buf.write(block)
    except Exception as e:
        raise HTTPException(502, f"FTP読み取りエラー: {e}")
    raw_bytes = buf.getvalue()

    mime_type = mimetypes.guess_type(path)[0] or "application/octet-stream"

    if is_text_file(path):
        # v1.1.0: Character encoding auto-detection
        meta_charset = extract_meta_charset(raw_bytes)
        detected = chardet.detect(raw_bytes)
        chardet_encoding = detected.get("encoding") or "utf-8"

        # <meta charset> has priority over chardet
        encoding = normalize_encoding(meta_charset or chardet_encoding)

        try:
            content = raw_bytes.decode(encoding, errors="replace")
        except (UnicodeDecodeError, LookupError):
            content = raw_bytes.decode("utf-8", errors="replace")
            encoding = "utf-8"

        return {
            "content": content,
            "detectedEncoding": encoding,
            "mimeType": mime_type,
        }
    else:
        # Binary file: return as base64
        return {
            "content": base64.b64encode(raw_bytes).decode("ascii"),
            "detectedEncoding": "binary",
            "mimeType": mime_type,
        }


class WriteRequest(BaseModel):
    path: str
    content: str
    encoding: str | None = None

@app.post("/api/ftp/write")
async def ftp_write(req: WriteRequest):
    """
    FTPファイル書き込み
    フロントからUTF-8 HTMLを受信 → 元の文字コードにエンコードしてFTP保存
    """
    ftp_path = safe_path(req.path)
    encoding = normalize_encoding(req.encoding or "utf-8")

    try:
        encoded_bytes = req.content.encode(encoding, errors="strict")
    except (UnicodeEncodeError, LookupError) as e:
        raise HTTPException(
            400,
            f"エンコード不可: {encoding} に変換できない文字が含まれています。"
            f"UTF-8での保存を推奨します。詳細: {e}"
        )

    try:
        async with ftp_connection() as client:
            buf = BytesIO(encoded_bytes)
            await client.upload_stream(ftp_path, buf)
    except Exception as e:
        raise HTTPException(502, f"FTP書き込みエラー: {e}")

    return {"status": "ok"}


@app.post("/api/ftp/upload-image")
async def ftp_upload_image(path: str = Form(...), file: UploadFile = File(...)):
    """画像ファイルをFTPにアップロード"""
    ftp_path = safe_path(path + "/" + file.filename)
    content = await file.read()

    try:
        async with ftp_connection() as client:
            buf = BytesIO(content)
            await client.upload_stream(ftp_path, buf)
    except Exception as e:
        raise HTTPException(502, f"FTP画像アップロードエラー: {e}")

    return {"url": path + "/" + file.filename}


# ── AI API Proxy (Nano Banana 3 Modes) ───────────────────

class AiRequest(BaseModel):
    mode: str  # t2i | i2i | m2i
    prompt: str
    width: int = 512
    height: int = 512
    init_image: str | None = None
    strength: float | None = None
    images: list[str] | None = None
    style_image: str | None = None

@app.post("/api/ai/generate-image")
async def ai_generate(req: AiRequest):
    """
    Nano Banana AI 画像生成プロキシ (v1.2.0: 3モード対応)
    - t2i: text-to-image (新規生成)
    - i2i: image+text-to-image (編集: 商品の背景変更等)
    - m2i: multi-image-to-image (合成・スタイル転写)
    """
    if not BANANA_API_KEY:
        raise HTTPException(500, "BANANA_API_KEY not configured")

    # Build request based on mode
    if req.mode == "t2i":
        endpoint = f"{BANANA_API_URL}/text-to-image"
        payload = {
            "prompt": req.prompt,
            "width": req.width,
            "height": req.height,
        }
    elif req.mode == "i2i":
        endpoint = f"{BANANA_API_URL}/image-to-image"
        payload = {
            "prompt": req.prompt,
            "init_image": req.init_image,
            "strength": req.strength or 0.3,
            "width": req.width,
            "height": req.height,
        }
    elif req.mode == "m2i":
        endpoint = f"{BANANA_API_URL}/multi-image"
        payload = {
            "prompt": req.prompt,
            "images": req.images or [],
            "style_image": req.style_image,
            "width": req.width,
            "height": req.height,
        }
    else:
        raise HTTPException(400, f"Unknown mode: {req.mode}")

    async with httpx.AsyncClient(timeout=120.0) as client:
        res = await client.post(
            endpoint,
            json=payload,
            headers={"Authorization": f"Bearer {BANANA_API_KEY}"},
        )
        if res.status_code != 200:
            raise HTTPException(502, f"AI API error: {res.text}")

    return res.json()


# ── Health Check ──────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "1.2.0"}
