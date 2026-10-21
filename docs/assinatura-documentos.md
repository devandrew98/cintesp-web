# Assinatura de documentos (termos de empréstimo)

Fluxo completo, dentro do app:

1. **Administração > Consignados > aba Assinaturas > "Novo documento p/ assinar"**: o administrador
   (emprestante) sobe o PDF, escolhe o pesquisador, clica na página para posicionar a **própria
   assinatura** (aplicada na hora) e a **moldura do pesquisador**. O documento fica *aguardando*.
2. O pesquisador entra no app, vai em **Assinar documentos** (menu da plataforma) — o documento aparece
   **só na conta dele** —, revisa, marca que concorda e assina. O app aplica a assinatura no PDF, calcula
   o SHA-256 do arquivo final e envia.
3. De volta na aba Assinaturas, o administrador **baixa o PDF final** e, pelo link **"Suba pro Google
   Drive"**, abre a pasta do Drive e envia o arquivo manualmente. (O app não envia ao Drive sozinho.)

Cada usuário edita a sua assinatura (logo, nome, cargo, organização, e-mail) em **Assinar documentos >
Minha assinatura**, no mesmo estilo da assinatura de e-mail.

> **Importante — o que esta assinatura é:** uma assinatura eletrônica **visual** (nome, data/hora e código
> do documento carimbados no PDF, com o SHA-256 do arquivo final guardado no banco). **Não** é assinatura
> com certificado digital ICP-Brasil (a do assinador.iti.br / gov.br). Serve como aceite registrado do
> termo; se algum processo exigir validade legal qualificada, assine também pelo gov.br.

## Instalação

Rode `docs/supabase-assinaturas.sql` no SQL Editor do Supabase. Cria as tabelas `assinatura_perfis` e
`assinatura_documentos`, o bucket **privado** `assinaturas` e as regras de acesso (o pesquisador só
enxerga/assina o que é dele). Não há mais nada para publicar.

Pasta do Drive usada no link: `https://drive.google.com/drive/folders/1SKvYwyfPCwyB9Iap-7FSVAtdRLQ8dZPB`
(constante `PASTA_DRIVE_URL` em `src/components/assinaturas/AbaAssinaturasAdmin.tsx`).
