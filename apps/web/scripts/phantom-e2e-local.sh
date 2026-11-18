#!/usr/bin/env bash
# Full browser end-to-end check of the Roselet Solana wallet flow.
#
#   pnpm verify:phantom:local
#
# Runs entirely on the local machine: a real Chromium clicks the real UI, a
# Wallet Standard wallet signs with WebCrypto Ed25519, and the transaction is
# broadcast to a LOCAL solana-test-validator and verified on-chain. No external
# faucet (devnet requestAirdrop returns 410), no real SOL, no Phantom popups.
#
# Requirements: `solana` + `solana-test-validator` CLI, pnpm deps installed.
# Only the one-time SPL Memo account dump needs internet (defaults to the local
# Clash proxy at 127.0.0.1:7890; override with E2E_CLASH_PROXY).
set -u
cd "$(dirname "$0")/.."
unset HTTP_PROXY HTTPS_PROXY ALL_PROXY http_proxy https_proxy all_proxy

PORT=${E2E_PORT:-3100}
URL="http://127.0.0.1:${PORT}"
RPC=${E2E_RPC:-http://localhost:8899}
LEDGER=${E2E_LEDGER:-/tmp/roselet-solana-ledger}
MEMO_DUMP=${E2E_MEMO_DUMP:-/tmp/roselet-memo-account.json}
PROXY=${E2E_CLASH_PROXY:-http://127.0.0.1:7890}
MEMO_ADDR=MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr
FAKE_ADDR=2X3N2CDqCHGfkMtk34pjDPZGr4ZJfZZhh7WzRmKhE11j

export NEXT_PUBLIC_SOLANA_RPC_URL="$RPC"
export ALLOW_MAINNET=1
export E2E_HEADLESS=1
export E2E_SKIP_TYPECHECK=1

for bin in solana solana-test-validator; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "[e2e] missing required CLI: $bin" >&2
    exit 2
  fi
done

VAL_PID=""
SRV_PID=""
cleanup() {
  [ -n "$SRV_PID" ] && kill "$SRV_PID" 2>/dev/null
  [ -n "$VAL_PID" ] && kill "$VAL_PID" 2>/dev/null
}
trap cleanup EXIT

# 1. Local validators do not ship the SPL Memo program. Dump the executable
#    account from devnet once, then load it at genesis with --account.
if [ ! -s "$MEMO_DUMP" ]; then
  echo "[e2e] dumping SPL Memo program account from devnet via $PROXY …"
  HTTPS_PROXY=$PROXY HTTP_PROXY=$PROXY \
    solana account "$MEMO_ADDR" --url https://api.devnet.solana.com \
    --output json > "$MEMO_DUMP" 2>/tmp/roselet-memo-dump.err
  if [ ! -s "$MEMO_DUMP" ]; then
    echo "[e2e] could not fetch $MEMO_ADDR (see /tmp/roselet-memo-dump.err)" >&2
    exit 2
  fi
fi

# 2. Start the local chain. A fresh ledger is required for --account to take
#    effect at genesis; remove E2E_LEDGER manually to reset the chain.
HEALTH=$(curl -s --max-time 3 -X POST "$RPC" -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' 2>/dev/null)
if echo "$HEALTH" | grep -q '"result"'; then
  echo "[e2e] reusing validator already on $RPC"
else
  echo "[e2e] starting solana-test-validator with the SPL Memo program …"
  solana-test-validator --quiet --bind-address 127.0.0.1 --rpc-port 8899 \
    --ledger "$LEDGER" --account "$MEMO_ADDR" "$MEMO_DUMP" \
    > /tmp/roselet-validator.log 2>&1 &
  VAL_PID=$!
  VAL_UP=0
  for i in $(seq 1 60); do
    HEALTH=$(curl -s --max-time 3 -X POST "$RPC" -H 'content-type: application/json' \
      -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' 2>/dev/null)
    if echo "$HEALTH" | grep -q '"result"'; then
      echo "[e2e] validator up after ${i}s"
      VAL_UP=1
      break
    fi
    sleep 1
  done
  if [ "$VAL_UP" != "1" ]; then
    echo "[e2e] validator never came up:" >&2
    tail -n 30 /tmp/roselet-validator.log >&2
    exit 2
  fi
fi

echo "[e2e] funding test wallet $FAKE_ADDR …"
solana airdrop 10 "$FAKE_ADDR" --url "$RPC" 2>&1 | tail -3

# 3. Production build. `next dev` cannot be used here: its Turbopack HMR
#    websocket fails in restricted sandboxes and React never hydrates.
#    NEXT_PUBLIC_SOLANA_RPC_URL is inlined at build time, so move .next aside.
echo "[e2e] production build (RPC inlined as $RPC) …"
mv .next "/tmp/roselet-next-backup-$(date +%s)" 2>/dev/null || true
./node_modules/.bin/next build > /tmp/roselet-next-build.log 2>&1
BUILD_RC=$?
tail -n 12 /tmp/roselet-next-build.log
if [ "$BUILD_RC" != "0" ]; then
  echo "[e2e] build failed" >&2
  exit "$BUILD_RC"
fi

# 4. Serve and run the browser E2E.
echo "[e2e] starting next start on $PORT …"
./node_modules/.bin/next start -p "$PORT" > /tmp/roselet-next-start.log 2>&1 &
SRV_PID=$!
SRV_UP=0
for i in $(seq 1 120); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --noproxy '*' --max-time 3 "$URL")
  if [ "$code" = "200" ]; then
    echo "[e2e] server up after ${i}s"
    SRV_UP=1
    break
  fi
  sleep 1
done
if [ "$SRV_UP" != "1" ]; then
  echo "[e2e] server never came up:" >&2
  tail -n 30 /tmp/roselet-next-start.log >&2
  exit 2
fi

echo "[e2e] === running browser E2E ==="
./node_modules/.bin/tsx scripts/phantom-e2e.mts --fake-wallet --url="$URL"
RC=$?
echo "[e2e] E2E_EXIT=$RC"
exit $RC
