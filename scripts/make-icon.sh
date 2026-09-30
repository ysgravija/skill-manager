#!/bin/sh
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
assets_dir="$project_dir/assets"
iconset_dir="$assets_dir/SkillManager.iconset"
mkdir -p "$iconset_dir"

if [ -d /Applications/Xcode.app/Contents/Developer ]; then
  export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
fi
xcrun swift -module-cache-path "${TMPDIR:-/tmp}/skill-manager-swift-cache" "$project_dir/scripts/render-icon.swift" "$assets_dir/icon-1024.png"
for size in 16 32 128 256 512; do
  sips -s format png -z "$size" "$size" "$assets_dir/icon-1024.png" --out "$iconset_dir/icon_${size}x${size}.png" >/dev/null
  double=$((size * 2))
  sips -s format png -z "$double" "$double" "$assets_dir/icon-1024.png" --out "$iconset_dir/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$iconset_dir" -o "$assets_dir/icon.icns"
rm -r "$iconset_dir" "$assets_dir/icon-1024.png"
printf '%s\n' "$assets_dir/icon.icns"
