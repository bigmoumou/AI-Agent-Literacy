#!/usr/bin/env bash
# 把做好的影片放上網站：壓成網頁用的大小，切成 HLS 小段放到影片站並上傳，擷取封面和縮圖放進 repo。
#
# 用法：tools/publish-video.sh <成品 mp4> <影片資料夾> [封面秒數] [--no-deploy] [--lang en]
#   例：tools/publish-video.sh ../製作/week04/01-relative-path/out/final.mp4 weeks/week04/video/01-relative-path 12
#
# 影片放在兩個地方（2026-10-19 起，見 docs/維護說明.md「影片放在哪裡」）：
#   影片站 ../media-site/public/<影片資料夾>/hls/   index.m3u8、init.mp4、segNN.m4s（H.264 CRF 23、每 8 秒一個關鍵影格、每段 8 秒）
#                                                   不進 git；做完自動用 tools/deploy-media.sh 上傳，上傳後學生馬上看得到新版
#   repo   <影片資料夾>/poster.jpg（1920×1080）、thumb.jpg（800×450）
#                                                   給了封面秒數，或原本沒有封面時才產生；預設取影片 30% 的位置；要 commit、push
# --no-deploy：只放進影片站的資料夾、先不上傳（一次發好幾支時，最後再跑 tools/deploy-media.sh）。
# --lang en：發布英文版（2026-10-21 起，見 製作/english/README.md）。串流放在影片站的 <影片資料夾>/en/hls/，
#   封面和縮圖是 repo 的 poster-en.jpg、thumb-en.jpg；中文版的 hls/、poster.jpg、thumb.jpg 一個都不碰。
#   週次頁的 <video> 要另外加 data-hls-en="video/<slug>/en/hls/index.m3u8" data-poster-en="video/<slug>/poster-en.jpg"。
#
# 先寫到暫存資料夾，全部成功才換上去，失敗時原本的影片不會壞。
# ffmpeg：先用 FFMPEG 環境變數，再找 PATH，最後找 opus-video conda 環境裡的那一份。
set -euo pipefail

usage="用法：tools/publish-video.sh <成品 mp4> <影片資料夾> [封面秒數] [--no-deploy] [--lang en]"
deploy=1
lang=zh
args=()
next_lang=0
for a in "$@"; do
  if [ "$next_lang" = 1 ]; then lang="$a"; next_lang=0
  elif [ "$a" = "--no-deploy" ]; then deploy=0
  elif [ "$a" = "--lang" ]; then next_lang=1
  elif [ "${a#--lang=}" != "$a" ]; then lang="${a#--lang=}"
  else args+=("$a"); fi
done
case "$lang" in zh) sub=""; sfx="" ;; en) sub="/en"; sfx="-en" ;; *) echo "--lang 只能是 en（不寫就是中文版）：$lang" >&2; exit 1 ;; esac
src="${args[0]:?$usage}"
dest="${args[1]:?$usage}"
poster_at="${args[2]:-}"
[ -f "$src" ] || { echo "找不到影片：$src" >&2; exit 1; }

repo="$(cd "$(dirname "$0")/.." && pwd)"
media="${MEDIA_DIR:-$repo/../media-site}"
[ -f "$media/wrangler.jsonc" ] || { echo "找不到影片站的資料夾（$media）：影片只能在 ultra7 上發布" >&2; exit 1; }
mkdir -p "$dest"
reldest="$(realpath --relative-to="$repo" "$dest")"
case "$reldest" in weeks/week[0-9][0-9]/video/*) ;; *) echo "影片資料夾要是 weeks/weekNN/video/<slug>：$dest" >&2; exit 1 ;; esac
mdest="$media/public/$reldest$sub"

conda_bin="/c/Users/bigmoumou/anaconda3/envs/opus-video/Library/bin"
if [ -n "${FFMPEG:-}" ]; then ffmpeg="$FFMPEG"
elif command -v ffmpeg >/dev/null 2>&1; then ffmpeg="ffmpeg"
elif [ -x "$conda_bin/ffmpeg.exe" ]; then ffmpeg="$conda_bin/ffmpeg.exe"
else echo "找不到 ffmpeg，請用 FFMPEG=... 指定" >&2; exit 1
fi
ffprobe="${ffmpeg%ffmpeg*}ffprobe${ffmpeg##*ffmpeg}"
[ "$ffmpeg" = "ffmpeg" ] && ffprobe="ffprobe"

duration=$("$ffprobe" -v error -show_entries format=duration -of csv=p=0 "$src")
mkdir -p "$mdest"
tmp="$mdest/.publish-tmp"
rm -rf "$tmp"
mkdir -p "$tmp/hls"
trap 'rm -rf "$tmp"' EXIT

echo "壓縮並切段（$(printf '%.0f' "$duration") 秒）……"
"$ffmpeg" -v error -y -i "$src" \
  -c:v libx264 -preset slow -crf 23 -pix_fmt yuv420p -profile:v high \
  -force_key_frames "expr:gte(t,n_forced*8)" -sc_threshold 0 \
  -c:a aac -b:a 128k \
  -f hls -hls_time 8 -hls_playlist_type vod \
  -hls_segment_type fmp4 -hls_fmp4_init_filename init.mp4 \
  -hls_segment_filename "$tmp/hls/seg%02d.m4s" "$tmp/hls/index.m3u8"

if [ -n "$poster_at" ] || [ ! -f "$dest/poster$sfx.jpg" ]; then
  at="${poster_at:-$(awk -v d="$duration" 'BEGIN { printf "%.2f", d * 0.3 }')}"
  echo "擷取 ${at} 秒的畫面當封面……"
  "$ffmpeg" -v error -y -ss "$at" -i "$src" -frames:v 1 -vf "scale=1920:1080" -q:v 3 "$tmp/poster.jpg"
  "$ffmpeg" -v error -y -i "$tmp/poster.jpg" -vf "scale=800:450" -q:v 4 "$tmp/thumb.jpg"
fi

# 單檔不能超過 Cloudflare 的 25 MiB
for f in "$tmp"/hls/* "$tmp"/*.jpg; do
  [ -f "$f" ] || continue
  if [ "$(wc -c < "$f")" -ge $((25 * 1024 * 1024)) ]; then echo "$(basename "$f") 超過 25 MiB，沒有放上去" >&2; exit 1; fi
done

rm -rf "$mdest/hls"
mv "$tmp/hls" "$mdest/hls"
for f in poster thumb; do [ -f "$tmp/$f.jpg" ] && mv -f "$tmp/$f.jpg" "$dest/$f$sfx.jpg"; done

secs=$(printf '%.0f' "$duration")
echo "完成：$reldest$sub"
echo "  影片站 HLS $(ls "$mdest/hls" | wc -l) 個檔案，共 $(du -sh "$mdest/hls" | cut -f1)；封面和縮圖在 repo 的 $reldest/poster$sfx.jpg、thumb$sfx.jpg"
echo "  長度 $((secs / 60)) 分 $(printf '%02d' $((secs % 60))) 秒（寫進週次頁的說明和 assets/course.js 的 meta）"

if [ "$deploy" = 1 ]; then
  "$repo/tools/deploy-media.sh"
  url="https://learning-analytics-media.o1r2g3a4n5i6z7e8.workers.dev/$reldest$sub/hls/index.m3u8"
  if curl -fsS "$url" | cmp -s - "$mdest/hls/index.m3u8"; then echo "  已上線：$url"
  else echo "  注意：影片站上的 index.m3u8 和剛做好的不一樣（可能還在更新），等一下再用瀏覽器確認：$url" >&2; fi
else
  echo "  還沒上傳影片站（--no-deploy）：全部發好後跑 tools/deploy-media.sh"
fi
echo "  別忘了 commit、push 封面和縮圖（和週次頁）"
