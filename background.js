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
import * as steam from "./lojas/steam.js";
import * as playstation from "./lojas/playstation.js";
import * as xbox from "./lojas/xbox.js";

const LOJAS = [nuuvem, epic, playstation, xbox];
// Lojas que NÃO são buscadas pelo background: quem lê os dados são scripts que rodam dentro das
// páginas delas (a Steam). O background só abre a página, espera e fecha (botão "Atualizar").
const LOJAS_DE_PAGINA = [steam];

const ALARME = "sincronizar-lojas";
const PERIODO_EM_MINUTOS = 15;
const INTERVALO_APOS_FALHA_EM_MINUTOS = 15;
const ESPERA_DA_PAGINA_EM_MS = 30000; // quanto esperamos a página da loja carregar, no máximo
const FOLGA_APOS_CARREGAR_EM_MS = 3000; // a loja renova a sessão logo depois de carregar
const ESPERA_DA_STEAM_EM_MS = 120000; // o histórico da Steam pode ter várias telas de "Carregar mais"

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

// ---------------------------------------------------------------------------------------
// Botão "Atualizar" do popup: antes de buscar, abre a página da loja em uma aba de fundo, espera
// carregar (é aí que a loja renova a sessão do usuário) e fecha a aba. Se mesmo assim a loja
// disser que o usuário não está logado, a aba fica aberta e vai para a frente, para ele entrar.
// ---------------------------------------------------------------------------------------

const dorme = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

// Espera a aba terminar de carregar (ou o tempo máximo passar). O evento traz o "status" mesmo
// sem a permissão "tabs", que só é necessária para ler o endereço e o título das abas.
function esperarCarregar(idDaAba) {
  return new Promise((resolver) => {
    const terminar = () => {
      chrome.tabs.onUpdated.removeListener(ouvinte);
      clearTimeout(limite);
      resolver();
    };
    const ouvinte = (id, mudancas) => {
      if (id === idDaAba && mudancas.status === "complete") terminar();
    };
    const limite = setTimeout(terminar, ESPERA_DA_PAGINA_EM_MS);
    chrome.tabs.onUpdated.addListener(ouvinte);
    chrome.tabs.get(idDaAba).then((aba) => aba.status === "complete" && terminar(), terminar);
  });
}

// Abre a página da loja em segundo plano e espera. Devolve o id da aba, ou null se não deu.
async function abrirLojaEmSegundoPlano(loja) {
  try {
    const aba = await chrome.tabs.create({ url: loja.LOJA.link.url, active: false });
    await esperarCarregar(aba.id);
    await dorme(FOLGA_APOS_CARREGAR_EM_MS);
    return aba.id;
  } catch {
    return null;
  }
}

let atualizacaoManual = null;
let chaveDaAtualizacaoManual = null; // id da loja, ou "todas"
// "so" é o id de uma loja (ou nada, para todas). Um clique igual ao da atualização em andamento
// (ou qualquer clique durante um "todas") espera por ela em vez de abrir as abas de novo; um
// pedido diferente entra na fila.
function atualizarAgora(so = null) {
  const chave = so ?? "todas";
  if (atualizacaoManual && (chaveDaAtualizacaoManual === chave || chaveDaAtualizacaoManual === "todas")) {
    return atualizacaoManual;
  }

  const anterior = atualizacaoManual ?? Promise.resolve();
  const atual = anterior
    .catch(() => {})
    .then(() => executarAtualizacaoManual(so))
    .finally(() => {
      if (atualizacaoManual === atual) {
        atualizacaoManual = null;
        chaveDaAtualizacaoManual = null;
      }
    });
  atualizacaoManual = atual;
  chaveDaAtualizacaoManual = chave;
  return atual;
}

// Funções que avisam a espera da Steam de que ela pediu login (mensagem do atualizar.js).
const esperandoLoginDaSteam = new Set();

// Combina com o gastos.js (que roda na página de histórico da Steam): ele calcula o resumo e o
// guarda em chrome.storage.local.resumo. Devolve { resultado }, uma promessa que termina com "ok"
// quando um resumo novo é guardado, "sem-login" se a Steam mandar para a tela de login, ou "erro"
// se passar do tempo. Precisa ser chamada ANTES de abrir a aba, para não perder o aviso. (Vai
// dentro de um objeto para o "await" desta função não esperar a promessa terminar.)
async function prepararEsperaDaSteam() {
  const { resumo } = await chrome.storage.local.get("resumo");
  const anterior = resumo?.atualizadoEm ?? null;

  const resultado = new Promise((resolver) => {
    const terminar = (resultado) => {
      chrome.storage.onChanged.removeListener(aoMudar);
      esperandoLoginDaSteam.delete(semLogin);
      clearTimeout(limite);
      resolver(resultado);
    };
    const aoMudar = (mudancas, area) => {
      const novo = mudancas.resumo?.newValue?.atualizadoEm;
      if (area === "local" && novo && novo !== anterior) terminar("ok");
    };
    const semLogin = () => terminar("sem-login");
    const limite = setTimeout(() => terminar("erro"), ESPERA_DA_STEAM_EM_MS);
    chrome.storage.onChanged.addListener(aoMudar);
    esperandoLoginDaSteam.add(semLogin);
  });
  return { resultado };
}

async function executarAtualizacaoManual(so) {
  // O service worker é desligado se ficar uns 30 s sem eventos; esse "pulso" o mantém acordado.
  const pulso = setInterval(() => chrome.runtime.getPlatformInfo(), 20000);
  try {
    // Lojas de fora (com permissão) e lojas de página (Steam) que entram nesta atualização.
    const externas = [];
    for (const loja of LOJAS) {
      if ((so && loja.LOJA.id !== so) || !loja.LOJA.link || !(await temPermissao(loja))) continue;
      externas.push(loja);
    }
    const dePagina = LOJAS_DE_PAGINA.filter((loja) => !so || loja.LOJA.id === so);

    // A espera pela Steam começa antes de abrir as abas.
    const esperas = new Map();
    for (const loja of dePagina) esperas.set(loja.LOJA.id, await prepararEsperaDaSteam());

    const abas = new Map(); // id da loja -> id da aba aberta
    await Promise.all(
      [...externas, ...dePagina].map(async (loja) => abas.set(loja.LOJA.id, await abrirLojaEmSegundoPlano(loja)))
    );

    const resultados = new Map(); // id da loja -> "ok" | "sem-login" | "erro"
    await Promise.all([
      externas.length > 0 ? sincronizarTodas({ forcar: true, so }) : null,
      ...dePagina.map(async (loja) => resultados.set(loja.LOJA.id, await esperas.get(loja.LOJA.id).resultado)),
    ]);

    const { lojas = {} } = await chrome.storage.local.get("lojas");
    for (const loja of externas) resultados.set(loja.LOJA.id, lojas[loja.LOJA.id]?.status);

    // Fecha as abas; a que ficou sem login fica aberta e vai para a frente, para o usuário entrar.
    for (const [id, idDaAba] of abas) {
      if (idDaAba === null) continue;
      if (resultados.get(id) === "sem-login") chrome.tabs.update(idDaAba, { active: true }).catch(() => {});
      else chrome.tabs.remove(idDaAba).catch(() => {});
    }
  } finally {
    clearInterval(pulso);
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
// O botão "Atualizar" do popup pede para buscar agora todas as lojas ou só uma (mensagem.loja).
// Só aceitamos mensagens da própria extensão. Devolvemos true para manter o canal aberto até a
// resposta (a busca demora).
chrome.runtime.onMessage.addListener((mensagem, remetente, responder) => {
  if (remetente.id !== chrome.runtime.id) return;
  // O atualizar.js (na página de login da Steam) avisa que o usuário não está logado.
  if (mensagem?.tipo === "steam-sem-login") {
    esperandoLoginDaSteam.forEach((aviso) => aviso());
    return;
  }
  if (mensagem?.tipo !== "sincronizar-lojas") return;
  atualizarAgora(typeof mensagem.loja === "string" ? mensagem.loja : null).then(
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
