// Configuração de runtime.
// - Em DESENVOLVIMENTO: fica vazio; o app usa o .env local (import.meta.env).
// - Em PRODUÇÃO (container Docker): este arquivo é SOBRESCRITO no start do
//   container com as variáveis reais do servidor (ver docker/40-cintesp-env.sh).
window.__ENV__ = window.__ENV__ || {  VITE_GOOGLE_CALENDAR_URL: "${VITE_GOOGLE_CALENDAR_URL}",
};
