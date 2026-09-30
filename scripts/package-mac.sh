#!/bin/sh
set -eu

app_path='out/Skill Manager-darwin-arm64/Skill Manager.app'

./node_modules/.bin/electron-forge package --platform=darwin --arch=arm64
codesign --force --deep --sign - "$app_path"
codesign --verify --deep --strict "$app_path"
ditto -c -k --sequesterRsrc --keepParent "$app_path" 'out/Skill-Manager-macOS-arm64.zip'
