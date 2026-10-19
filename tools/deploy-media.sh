#!/usr/bin/env bash
# 把影片站（和 repo 同一層的 media-site/public/）上傳到 Cloudflare。
# 平常不用單獨跑：tools/publish-video.sh 做完會自動呼叫；一次發好幾支時用 --no-deploy，最後再跑這一支。
#
# 用法：tools/deploy-media.sh
#
# 影片站是 Cloudflare 的另一個專案 learning-analytics-media（Workers 靜態檔案，免費、不限流量），不是 git repo：
# 這台電腦（ultra7）上的 media-site/public/ 就是正本，上傳時 wrangler 只傳有變的檔案。詳見 docs/維護說明.md「影片放在哪裡」。
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
media="${MEDIA_DIR:-$repo/../media-site}"
MEDIA_URL="https://learning-analytics-media.o1r2g3a4n5i6z7e8.workers.dev"
[ -f "$media/wrangler.jsonc" ] || { echo "找不到影片站的資料夾（$media）：影片只能在 ultra7 上發布" >&2; exit 1; }

# wrangler 裝在 media-site/node_modules；node 用 PATH 上的，沒有就用 opus-video 環境裡的
command -v node >/dev/null 2>&1 || export PATH="/c/Users/bigmoumou/anaconda3/envs/opus-video:$PATH"
export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-3f9c3f272cfe61cb306b14e1d18a2237}"

echo "上傳影片站……"
(cd "$media" && npx --no-install wrangler deploy 2>&1 | grep -vE "^\s*$|Notice to agents" | tail -6)
echo "影片站：$MEDIA_URL"
