#!/bin/zsh
set -e
cd -- "${0:A:h}"
if [[ -x "$HOME/.nvm/versions/node/v22.16.0/bin/node" ]]; then
  export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
fi
if ! command -v npm >/dev/null 2>&1; then
  print "需要 Node.js 22.13 或更新版本。安装后再次打开。"
  read -k 1
  exit 1
fi
if curl -fsS --max-time 2 http://localhost:3000/ >/dev/null 2>&1; then
  open http://localhost:3000/
  exit 0
fi
print "正在启动逐夜之刃。游玩期间请保留此终端窗口。"
(
  for attempt in {1..30}; do
    if curl -fsS --max-time 1 http://localhost:3000/ >/dev/null 2>&1; then
      open http://localhost:3000/
      exit 0
    fi
    sleep 1
  done
) &
exec npm run dev -- --hostname 127.0.0.1 --port 3000
