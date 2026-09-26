// Service worker da extensão (roda em segundo plano, sem página).
// Mantém atualizados os dados das lojas que o usuário ativou, sem nada manual:
//   - o alarme acorda o worker a cada 15 minutos, mas cada loja só é buscada de novo quando o
//     intervalo DELA passa (LOJA.intervaloMinutos), quando os dados são de uma versão antiga do
//     formato ou quando a última tentativa falhou (aí tenta de novo em 15 minutos);
//   - também busca quando o Chrome abre e assim que o usuário ativa uma loja;
//   - só para lojas cujo acesso o usuário liberou (permissão opcional, pedida no popup).
//
// Este arquivo é um módulo ES. Para adicionar uma loja: crie lojas/<loja>.js (veja o padrão em
// lojas/nuuvem.js), importe aqui e coloque na lista LOJAS. O acesso ao site dela vai em
// "optional_host_permissions" no manifest.json.

import * as nuuvem from "./lojas/nuuvem.js";
import * as epic from "./lojas/epic.js";
import * as playstation from "./lojas/playstation.js";

const LOJAS = [nuuvem, epic, playstation];

const ALARME = "sincronizar-lojas";
const PERIODO_EM_MINUTOS = 15;
const INTERVALO_APOS_FALHA_EM_MINUTOS = 15;

const temPermissao = (loja) => chrome.permissions.contains({ origins: [loja.LOJA.origem] });

// Já é hora de buscar essa loja de novo? "dados" é o que está guardado dela.
function precisaSincronizar(loja, dados) {
  if (!dados || dados.versao !== loja.LOJA.versao || !dados.ultimaTentativa) return true;
  // Se a última tentativa falhou, não esperamos o intervalo inteiro (que pode ser de horas):
  // o usuário pode ter acabado de entrar na conta da loja.
  const minutos = dados.status === "ok" ? loja.LOJA.intervaloMinutos : Math.min(loja.LOJA.intervaloMinutos, INTERVALO_APOS_FALHA_EM_MINUTOS);
  return Date.now() - Date.parse(dados.ultimaTentativa) >= minutos * 60 * 1000;
}

// Sincroniza uma loja e grava o resultado em chrome.storage.local, na chave "lojas".
// Se der erro, mantém os últimos dados bons e só troca o status.
async function sincronizarLoja(loja) {
  const { id } = loja.LOJA;
  const ultimaTentativa = new Date().toISOString();

  let novo;
  try {
    novo = { ...(await loja.sincronizar()), status: "ok", ultimaTentativa };
  } catch (erro) {
    const { lojas = {} } = await chrome.storage.local.get("lojas");
    novo = {
      ...(lojas[id] ?? {}),
      // Sem dados anteriores, o registro de falha já nasce na versão atual (senão pareceria
      // "de versão antiga" e o intervalo após falha nunca valeria). Com dados de uma versão
      // antiga, mantemos a antiga: eles ainda precisam ser refeitos.
      versao: lojas[id]?.versao ?? loja.LOJA.versao,
      status: erro.codigo === "sem-login" ? "sem-login" : "erro",
      erro: { mensagem: String(erro.message ?? erro), quando: ultimaTentativa },
      ultimaTentativa,
    };
  }

  // Lê de novo antes de gravar: outra loja pode ter sido gravada enquanto esta buscava.
  const { lojas = {} } = await chrome.storage.local.get("lojas");
  await chrome.storage.local.set({ lojas: { ...lojas, [id]: novo } });
}

// "forcar" ignora os intervalos (usado quando o usuário acabou de ativar uma loja ou clicou em
// "Atualizar"); "so" limita a busca a uma loja (o id dela). Se já há uma sincronização em
// andamento (alarme, botão...), quem chamar de novo espera por ela em vez de começar outra: assim
// uma loja nunca é buscada duas vezes ao mesmo tempo. Um pedido que a atual não cobre entra na
// fila e roda depois dela.
let emAndamento = null;
let chaveEmAndamento = null; // "comum", "todas" ou o id da loja
function sincronizarTodas({ forcar = false, so = null } = {}) {
  const chave = !forcar ? "comum" : (so ?? "todas");
  // A atual já cobre o pedido se é o mesmo tipo, ou se é "todas" forçada (cobre qualquer loja).
  if (emAndamento && (chaveEmAndamento === chave || chaveEmAndamento === "todas")) {
    return emAndamento;
  }

  const anterior = emAndamento ?? Promise.resolve();
  const atual = anterior
    .catch(() => {})
    .then(() => executarSincronizacao(forcar, so))
    .finally(() => {
      if (emAndamento === atual) {
        emAndamento = null;
        chaveEmAndamento = null;
      }
    });
  emAndamento = atual;
  chaveEmAndamento = chave;
  return atual;
}

async function executarSincronizacao(forcar, so) {
  const { lojas = {} } = await chrome.storage.local.get("lojas");
  for (const loja of LOJAS) {
    if (so && loja.LOJA.id !== so) continue;
    if (!(await temPermissao(loja))) continue;
    if (forcar || precisaSincronizar(loja, lojas[loja.LOJA.id])) await sincronizarLoja(loja);
  }
}

// Cria o alarme, ou o recria se o período mudou em uma versão nova da extensão.
async function garantirAlarme() {
  const atual = await chrome.alarms.get(ALARME);
  if (!atual || atual.periodInMinutes !== PERIODO_EM_MINUTOS) {
    chrome.alarms.create(ALARME, { periodInMinutes: PERIODO_EM_MINUTOS });
  }
}

// Versões anteriores guardavam a lista de jogos resgatados por código (chave "codigos").
// Essa função foi retirada, então apagamos o que ficou guardado.
const limparDadosAntigos = () => chrome.storage.local.remove("codigos");

// Os "ouvintes" precisam ser registrados aqui, no topo do arquivo: o Chrome desliga o service
// worker quando ele fica parado e o acorda de novo para entregar cada evento.

chrome.runtime.onInstalled.addListener(() => {
  limparDadosAntigos();
  garantirAlarme();
  // Instalou ou atualizou a extensão: busca já, sem esperar os intervalos.
  sincronizarTodas({ forcar: true });
});
chrome.runtime.onStartup.addListener(() => {
  garantirAlarme();
  sincronizarTodas();
});
chrome.alarms.onAlarm.addListener((alarme) => {
  if (alarme.name === ALARME) sincronizarTodas();
});
// Os botões "Atualizar" do popup pedem para buscar agora todas as lojas ou só uma (mensagem.loja).
// Só aceitamos mensagens da própria extensão. Devolvemos true para manter o canal aberto até a
// resposta (a busca demora).
chrome.runtime.onMessage.addListener((mensagem, remetente, responder) => {
  if (remetente.id !== chrome.runtime.id || mensagem?.tipo !== "sincronizar-lojas") return;
  sincronizarTodas({ forcar: true, so: typeof mensagem.loja === "string" ? mensagem.loja : null }).then(
    () => responder({ ok: true }),
    () => responder({ ok: false })
  );
  return true;
});
// O usuário liberou o acesso a uma loja no popup: já busca os dados, sem esperar o alarme.
chrome.permissions.onAdded.addListener(() => {
  garantirAlarme();
  sincronizarTodas({ forcar: true });
});
