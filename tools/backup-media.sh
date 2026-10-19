#!/usr/bin/env bash
# 把影片站的正本（和 repo 同一層的 media-site/）備份到 Mac Studio 的 T7。
# 平常不用單獨跑：tools/deploy-media.sh 上傳完會自動呼叫；Mac Studio 連不上時，之後再跑這一支補做。
#
# 用法：tools/backup-media.sh
#
# 備份 media-site/ 裡的 public/ 和 README.md、package.json、package-lock.json、wrangler.jsonc（node_modules/ 可以重裝，不備份）。
# 只傳新增或改過的檔案；Mac 上多出來的檔案（重做影片後不用的舊段落）會刪掉，兩邊保持一樣。
# 最後兩邊逐檔比對 sha256，不一樣就報錯。
# 位置：lab01mac-studio:/Volumes/T7/師大教材/media-site/（可用 BACKUP_HOST、BACKUP_DIR 改）。
set -euo pipefail
export LC_ALL=C

repo="$(cd "$(dirname "$0")/.." && pwd)"
media="${MEDIA_DIR:-$repo/../media-site}"
host="${BACKUP_HOST:-lab01mac-studio}"
dest="${BACKUP_DIR:-/Volumes/T7/師大教材/media-site}"
vol="$(echo "$dest" | cut -d/ -f1-3)"
[ -f "$media/wrangler.jsonc" ] || { echo "找不到影片站的資料夾（$media）：備份只能在 ultra7 上做" >&2; exit 1; }

ssh_mac() { ssh -o ConnectTimeout=10 -o BatchMode=yes "$host" "$@"; }
# 每行「sha256  路徑」，路徑相對於 media-site/
normalize() { sed -E 's/^([0-9a-f]{64}) [ *]/\1  /; s#  \./#  #' | sort; }

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "備份影片站到 $host:$dest ……"
ssh_mac "mount | grep -q ' on $vol ('" || { echo "Mac Studio 連不上，或 $vol 沒有接上" >&2; exit 1; }

cd "$media"
find public README.md package.json package-lock.json wrangler.jsonc -type f ! -path '*/.publish-tmp/*' -exec sha256sum {} + | normalize > "$tmp/local"
ssh_mac "mkdir -p '$dest' && cd '$dest' && find . -type f ! -name .DS_Store -exec shasum -a 256 {} +" | normalize > "$tmp/remote"

comm -23 "$tmp/local" "$tmp/remote" | cut -c67- > "$tmp/send"
comm -13 <(cut -c67- "$tmp/local" | sort) <(cut -c67- "$tmp/remote" | sort) > "$tmp/del"

if [ -s "$tmp/send" ]; then
  echo "  傳送 $(wc -l < "$tmp/send") 個新增或改過的檔案（$(tr '\n' '\0' < "$tmp/send" | du -cb --files0-from=- | tail -1 | awk '{ printf "%.0f MB", $1 / 1048576 }')）……"
  tar -cf - -T "$tmp/send" | ssh_mac "cd '$dest' && tar -xf -"
fi
if [ -s "$tmp/del" ]; then
  echo "  刪掉 Mac 上多出來的 $(wc -l < "$tmp/del") 個檔案……"
  ssh_mac "cd '$dest' && tr '\n' '\0' | xargs -0 rm -f -- && find public -type d -empty -delete" < "$tmp/del"
fi

ssh_mac "cd '$dest' && find . -type f ! -name .DS_Store -exec shasum -a 256 {} +" | normalize > "$tmp/remote"
if cmp -s "$tmp/local" "$tmp/remote"; then
  echo "  已備份：$(wc -l < "$tmp/local") 個檔案，$(du -sh public | cut -f1)，兩邊逐檔 sha256 相同"
else
  echo "備份後兩邊不一樣（Mac 上：$(wc -l < "$tmp/remote") 個檔案，這裡：$(wc -l < "$tmp/local") 個）：" >&2
  diff "$tmp/local" "$tmp/remote" | head -10 >&2
  exit 1
fi
