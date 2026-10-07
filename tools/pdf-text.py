#!/usr/bin/env python3
"""自治体の公開PDFから本文テキストを取り出す。

    python3 tools/pdf-text.py 入力.pdf 出力.txt

依存パッケージなし（Python標準ライブラリのみ）。macOSに poppler が無くても動く。

--- なぜ自前で書くか ---

水戸市など自治体の公開資料はPDFでしか出ていないことが多く、しかも形式が3種類ある。

  (1) テキスト埋め込み・Identity-H（2バイトコード・<hex>文字列）
  (2) テキスト埋め込み・1バイトコード（(literal)文字列）。/Font や /Resources が
      間接参照になっていることがある
  (3) 画像化（抽出不能。OCRが要る）

このスクリプトは (1)(2) に対応する。(3) は「抽出文字数 0」で返るので、
その時点で画像PDFだと分かる。

--- 数字が化ける事故について ---

**全フォントのToUnicode CMapを1つに混ぜてはいけない。** 別々のフォントが同じ
コード値に別の文字を割り当てているため、数字が別の数字に置き換わる。
実際に水戸市の予算説明書で「10,852,517千円」が「32,874,737千円」と出た。

このスクリプトは**フォント単位でCMapを引く**ため、その事故は起きない。
ただし抽出できないページがあると数字が欠けるので、**金額を扱うときは必ず
内訳の合計などで検算すること。**

--- 使い方の注意 ---

出力は文字間に空白が入ることがある（PDFの字送り指定による）。
キーワード検索する前に、空白を詰めてから当たると取りこぼさない。

    import re
    t = re.sub(r'\\s+', '', open('出力.txt').read())
"""

import io
import re
import sys
import zlib

# ---------------------------------------------------------------- 読み込み

if len(sys.argv) < 3:
    sys.exit(__doc__)

data = io.open(sys.argv[1], "rb").read()

# 直接オブジェクトの位置
pos = {}
for m in re.finditer(rb"(?<![0-9])(\d+)\s+(\d+)\s+obj\b", data):
    pos[int(m.group(1))] = m.end()


def _raw_body(num, limit=20000):
    off = pos.get(num)
    if off is None:
        return b""
    end = data.find(b"endobj", off)
    return data[off : end if end > 0 else off + limit]


def stream(num):
    """オブジェクトのストリームを取り出して展開する。"""
    off = pos.get(num)
    if off is None:
        return None
    head_end = data.find(b"stream", off)
    if head_end < 0:
        return None
    head = data[off:head_end]
    st = head_end + len(b"stream")
    while data[st : st + 1] in (b"\r", b"\n"):
        st += 1
    en = data.find(b"endstream", st)
    raw = data[st:en]
    if b"/FlateDecode" in head:
        try:
            return zlib.decompress(raw)
        except Exception:
            try:
                return zlib.decompressobj().decompress(raw)
            except Exception:
                return None
    return raw


# 圧縮オブジェクトストリーム(ObjStm)を展開する。
# 新しめのPDFはページ辞書やフォント辞書がこの中に入っており、
# 展開しないと1ページも見つからない。
objstm_body = {}
for num in list(pos):
    head = _raw_body(num, 400)
    if b"/ObjStm" not in head:
        continue
    m_n = re.search(rb"/N\s+(\d+)", head)
    m_f = re.search(rb"/First\s+(\d+)", head)
    if not (m_n and m_f):
        continue
    buf = stream(num)
    if not buf:
        continue
    n, first = int(m_n.group(1)), int(m_f.group(1))
    pairs = re.findall(rb"(\d+)\s+(\d+)", buf[:first])
    for i, (on, off) in enumerate(pairs[:n]):
        start = first + int(off)
        end = first + int(pairs[i + 1][1]) if i + 1 < min(n, len(pairs)) else len(buf)
        objstm_body[int(on)] = buf[start:end]


def body(num, limit=20000):
    b = _raw_body(num, limit)
    return b if b else objstm_body.get(num, b"")


ALL = set(pos) | set(objstm_body)

# ---------------------------------------------------------------- CMap


def parse_cmap(buf):
    """ToUnicode CMap を {コード: 文字} に変換する。"""
    cm = {}
    if not buf:
        return cm
    for bm in re.finditer(rb"beginbfchar(.*?)endbfchar", buf, re.S):
        for pm in re.finditer(rb"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", bm.group(1)):
            h = pm.group(2).decode()
            try:
                cm[int(pm.group(1), 16)] = "".join(
                    chr(int(h[i : i + 4], 16)) for i in range(0, len(h), 4)
                )
            except Exception:
                pass
    for bm in re.finditer(rb"beginbfrange(.*?)endbfrange", buf, re.S):
        for pm in re.finditer(
            rb"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", bm.group(1)
        ):
            lo, hi, base = (
                int(pm.group(1), 16),
                int(pm.group(2), 16),
                int(pm.group(3), 16),
            )
            if hi - lo > 65535:
                continue
            for i in range(hi - lo + 1):
                cm[lo + i] = chr(base + i)
    return cm


# フォントオブジェクト番号 → CMap
font_cmap = {}
for num in ALL:
    b = body(num, 3000)
    if b"/Type" in b and b"/Font" in b:
        tu = re.search(rb"/ToUnicode\s+(\d+)\s+\d+\s+R", b)
        font_cmap[num] = parse_cmap(stream(int(tu.group(1)))) if tu else {}

# ---------------------------------------------------------------- ページ


def font_dict_of(b, depth=0):
    """本体から /Font の {名前: フォントobj番号} を取り出す。間接参照も辿る。"""
    if depth > 3:
        return {}
    name_ref = rb"/([A-Za-z0-9#+._\-]+)\s+(\d+)\s+\d+\s+R"
    m = re.search(rb"/Font\s*<<(.*?)>>", b, re.S)
    if m:
        return {
            x.group(1).decode(): int(x.group(2))
            for x in re.finditer(name_ref, m.group(1))
        }
    m = re.search(rb"/Font\s+(\d+)\s+\d+\s+R", b)
    if m:
        return {
            x.group(1).decode(): int(x.group(2))
            for x in re.finditer(name_ref, body(int(m.group(1)), 8000))
        }
    m = re.search(rb"/Resources\s+(\d+)\s+\d+\s+R", b)
    if m:
        return font_dict_of(body(int(m.group(1)), 8000), depth + 1)
    return {}


# Contents番号 → {フォント名: CMap}
content_fonts = {}
for num in ALL:
    b = body(num, 8000)
    if b"/Type" not in b or b"/Page" not in b:
        continue
    fd = font_dict_of(b)
    if not fd:
        continue
    names = {k: font_cmap.get(v, {}) for k, v in fd.items()}
    for cm in re.finditer(rb"/Contents\s+(?:(\d+)\s+\d+\s+R|\[([^\]]*)\])", b):
        if cm.group(1):
            content_fonts[int(cm.group(1))] = names
        else:
            for r in re.finditer(rb"(\d+)\s+\d+\s+R", cm.group(2)):
                content_fonts[int(r.group(1))] = names

# ---------------------------------------------------------------- 復号

ESC = {
    b"n": b"\n", b"r": b"\r", b"t": b"\t", b"b": b"\b", b"f": b"\f",
    b"(": b"(", b")": b")", b"\\": b"\\",
}


def unescape(raw):
    """リテラル文字列 (...) の中身をバイト列に戻す。"""
    out = bytearray()
    i = 0
    while i < len(raw):
        c = raw[i : i + 1]
        if c != b"\\":
            out += c
            i += 1
            continue
        nxt = raw[i + 1 : i + 2]
        if nxt in ESC:
            out += ESC[nxt]
            i += 2
        elif re.match(rb"[0-7]", nxt or b""):
            m = re.match(rb"[0-7]{1,3}", raw[i + 1 : i + 4])
            out.append(int(m.group(0), 8) & 0xFF)
            i += 1 + len(m.group(0))
        elif nxt in (b"\n", b"\r"):
            i += 2
        else:
            out += nxt
            i += 2
    return bytes(out)


def decode(codes, cm, width):
    if width == 2:
        return "".join(
            cm.get(int.from_bytes(codes[i : i + 2], "big"), "")
            for i in range(0, len(codes) - 1, 2)
        )
    return "".join(cm.get(b, "") for b in codes)


TOKEN = re.compile(
    rb"/([A-Za-z0-9#+._\-]+)\s+[\d.]+\s+Tf"   # フォント切替
    rb"|<([0-9A-Fa-f]+)>"                     # 16進文字列
    rb"|\(((?:\\.|[^\\()])*)\)"               # リテラル文字列
    rb"|(Td|TD|T\*|ET)",                      # 改行相当
    re.S,
)

out = []
for num in sorted(content_fonts):
    s = stream(num)
    if not s:
        continue
    names = content_fonts[num]
    # CMapのキーが255を超えるフォントは2バイトコードとみなす
    widths = {k: (2 if (v and max(v) > 255) else 1) for k, v in names.items()}
    cur, curw, buf = {}, 1, []
    for tok in TOKEN.finditer(s):
        if tok.group(1):
            k = tok.group(1).decode()
            cur, curw = names.get(k, {}), widths.get(k, 1)
        elif tok.group(2):
            h = tok.group(2)
            if len(h) % 2:
                h += b"0"
            buf.append(decode(bytes.fromhex(h.decode()), cur, curw))
        elif tok.group(3) is not None:
            buf.append(decode(unescape(tok.group(3)), cur, curw))
        elif tok.group(4) in (b"Td", b"TD", b"T*", b"ET"):
            buf.append("\n")
    t = "".join(buf)
    if t.strip():
        out.append(t)

io.open(sys.argv[2], "w", encoding="utf-8").write("\n".join(out))
n = sum(len(x) for x in out)
print(f"フォント数: {len(font_cmap)} / ページ数: {len(content_fonts)} / 抽出文字数: {n}")
if n == 0:
    print("→ 0文字。画像化されたPDFの可能性が高い（OCRが必要）", file=sys.stderr)
