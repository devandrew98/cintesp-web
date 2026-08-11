/**
 * ============================================================
 * CINTESP.Br — envio das notificações por e-mail (Google Apps Script)
 * ------------------------------------------------------------
 * Este script é o "carteiro" do sistema: recebe do Supabase uma lista de
 * e-mails já prontos (destinatário + assunto + HTML) e dispara pelo Gmail
 * da conta que for dona deste script.
 *
 * Ele NÃO monta o conteúdo dos e-mails — isso continua na Edge Function
 * `notificar-email`, para que exista um único lugar com os modelos.
 *
 * Propriedades do script (Configurações do projeto > Propriedades do script):
 *   CINTESP_SEGREDO  (obrigatória) — senha combinada com a Edge Function.
 *                                    O endereço do web app é público, então é
 *                                    ela que impede terceiros de usarem o seu
 *                                    Gmail para mandar e-mail.
 *   REMETENTE_NOME   (opcional)    — nome exibido. Padrão: "CINTESP.Br".
 *
 * Cota diária do Gmail (o limite é da CONTA, não deste script):
 *   • conta @gmail.com comum ......... 100 destinatários/dia
 *   • Google Workspace ............... 1.500 destinatários/dia
 *
 * O passo a passo de instalação está em docs/notificacoes-email.md.
 * ============================================================
 */

/** Formato de resposta único — sempre JSON. */
function responder(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)
}

/**
 * Recebe os e-mails do Supabase e envia.
 *
 * Corpo esperado:
 *   { "segredo": "...", "emails": [ { "para": "...", "assunto": "...", "html": "..." } ] }
 */
function doPost(e) {
  try {
    var props = PropertiesService.getScriptProperties()
    var segredo = props.getProperty('CINTESP_SEGREDO')
    var remetenteNome = props.getProperty('REMETENTE_NOME') || 'CINTESP.Br'

    if (!segredo) {
      return responder({ ok: false, erro: 'CINTESP_SEGREDO nao configurado nas propriedades do script.' })
    }
    if (!e || !e.postData || !e.postData.contents) {
      return responder({ ok: false, erro: 'Requisicao sem corpo.' })
    }

    var corpo = JSON.parse(e.postData.contents)
    if (corpo.segredo !== segredo) {
      return responder({ ok: false, erro: 'Segredo invalido.' })
    }

    var emails = corpo.emails
    if (!Array.isArray(emails) || emails.length === 0) {
      return responder({ ok: false, erro: 'Nenhum e-mail para enviar.' })
    }

    // Falhar aqui é melhor do que mandar metade e estourar a cota no meio.
    var restante = MailApp.getRemainingDailyQuota()
    if (restante < emails.length) {
      return responder({
        ok: false,
        erro: 'Cota diaria do Gmail insuficiente: restam ' + restante + ' envios e foram pedidos ' + emails.length + '.',
      })
    }

    var enviados = 0
    var falhas = []
    for (var i = 0; i < emails.length; i++) {
      var item = emails[i]
      if (!item || !item.para) {
        falhas.push({ email: '(vazio)', erro: 'Destinatario ausente.' })
        continue
      }
      try {
        MailApp.sendEmail({
          to: item.para,
          subject: item.assunto,
          htmlBody: item.html,
          name: remetenteNome,
        })
        enviados++
      } catch (err) {
        // Um destinatário inválido não pode derrubar o lote inteiro.
        falhas.push({ email: item.para, erro: String((err && err.message) || err) })
      }
    }

    return responder({
      ok: true,
      enviados: enviados,
      falhas: falhas,
      cotaRestante: MailApp.getRemainingDailyQuota(),
    })
  } catch (err) {
    return responder({ ok: false, erro: String((err && err.message) || err) })
  }
}

/**
 * Teste de vida: abra a URL do web app no navegador. Se aparecer um JSON com
 * a cota, a implantação está correta e acessível. Se aparecer tela de login
 * do Google, a implantação está com acesso restrito — veja a documentação.
 */
function doGet() {
  return responder({
    ok: true,
    servico: 'CINTESP.Br - notificacoes por e-mail',
    cotaRestante: MailApp.getRemainingDailyQuota(),
  })
}

/**
 * Rode UMA VEZ pelo editor (botão "Executar") para autorizar o script a
 * enviar e-mail em seu nome. Manda um e-mail de teste para você mesmo.
 */
function testarEnvio() {
  var email = Session.getActiveUser().getEmail()
  MailApp.sendEmail({
    to: email,
    subject: 'CINTESP.Br - teste do Apps Script',
    htmlBody: '<p>Se voce recebeu este e-mail, o Apps Script esta autorizado e enviando. ✅</p>',
    name: 'CINTESP.Br',
  })
  Logger.log('E-mail de teste enviado para ' + email + '. Cota restante: ' + MailApp.getRemainingDailyQuota())
}
