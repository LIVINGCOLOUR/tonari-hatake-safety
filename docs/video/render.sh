#!/bin/zsh
# 2部の動画を生成し、時刻入りの名前で書き出す。
# 同じファイル名を上書きすると、ブラウザやビューアが前の版をキャッシュから再生することがあるため、
# 見せる用のファイルは毎回 assets/video/out/final/ に新しい名前で置く。
# 使い方: docs/video/render.sh [A|B|all]   （既定は all）
set -e
cd "$(dirname "$0")/../.."
export PATH=/opt/homebrew/bin:$PATH
MULMO=${MULMO:-/Users/mon/Developer/MulmoTerminal/app-source/mulmoterminal/node_modules/.bin/mulmo}
OUT=assets/video/out
FINAL=$OUT/final
mkdir -p "$FINAL"
python3 docs/video/build-promo-30s.py
STAMP=$(date +%m%d-%H%M)
render() { # $1=台本の basename  $2=見せる用の名前
  "$MULMO" movie "docs/video/$1.json" -o "$OUT" -f > "$OUT/render-$1.log" 2>&1
  mv "$OUT/$1_ja.mp4" "$FINAL/$2_$STAMP.mp4"
  # 中間生成物は毎回作り直すので残さない。動画は final/ だけに置く
  rm -rf "$OUT/images/$1" "$OUT/audio/$1" "$OUT/$1_studio.json" "$OUT/$1_ja.mp3"
  echo "$FINAL/$2_$STAMP.mp4"
}
case "${1:-all}" in
  A) render promo-60s-A part1-kadai-60s ;;
  B) render promo-30s-B part2-sanpusha-30s ;;
  all) render promo-60s-A part1-kadai-60s; render promo-30s-B part2-sanpusha-30s ;;
esac
