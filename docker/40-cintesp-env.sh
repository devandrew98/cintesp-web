#!/bin/sh
# ============================================================
# Gera /config.js a partir das variáveis de ambiente do container.
# Roda automaticamente no start (a imagem nginx executa /docker-entrypoint.d/*.sh).
# Assim a MESMA imagem serve qualquer ambiente — só mudam as variáveis.
# ============================================================
set -e

CONFIG="/usr/share/nginx/html/config.js"

cat > "$CONFIG" <<EOF
window.__ENV__ = {
  "VITE_SUPABASE_URL": "${VITE_SUPABASE_URL:-}",
  "VITE_SUPABASE_ANON_KEY": "${VITE_SUPABASE_ANON_KEY:-}",
  "VITE_USE_MOCK": "${VITE_USE_MOCK:-false}"
};
EOF

echo "[cintesp] config.js gerado — URL='${VITE_SUPABASE_URL:-<vazio>}' USE_MOCK='${VITE_USE_MOCK:-false}'"
if [ -z "${VITE_SUPABASE_URL:-}" ] || [ -z "${VITE_SUPABASE_ANON_KEY:-}" ]; then
  echo "[cintesp] AVISO: VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY vazias. O login nao vai funcionar."
fi
