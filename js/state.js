const BANK_ID = 'bank';
const BANK_PLAYER = {
  id: BANK_ID,
  nome: 'Banco',
  cor: '#0f766e',
  saldo: Number.POSITIVE_INFINITY,
  isBank: true,
};

const defaultState = {
  jogadores: [BANK_PLAYER],
  jogadorAtivoId: BANK_ID,
  historico: [],
  partidaIniciada: false,
};

let appState = structuredClone(defaultState);

export function getState() {
  return appState;
}

export function getBankId() {
  return BANK_ID;
}

export function resetState() {
  appState = structuredClone(defaultState);
}

export function replaceState(nextState) {
  appState = {
    ...structuredClone(defaultState),
    ...nextState,
  };

  const bankIndex = appState.jogadores.findIndex((jogador) => jogador.id === BANK_ID);
  const hasBank = bankIndex >= 0;
  if (!hasBank) {
    appState.jogadores.unshift({ ...BANK_PLAYER });
  } else {
    appState.jogadores[bankIndex] = {
      ...appState.jogadores[bankIndex],
      ...BANK_PLAYER,
    };
  }
}

export function setGame(players, saldoInicial) {
  const sanitizedPlayers = players.map((player) => ({
    id: player.id,
    nome: player.nome,
    cor: player.cor,
    avatar: player.avatar,
    saldo: saldoInicial,
    isBank: false,
  }));

  appState.jogadores = [{ ...BANK_PLAYER }, ...sanitizedPlayers];
  appState.jogadorAtivoId = sanitizedPlayers[0]?.id ?? BANK_ID;
  appState.historico = [];
  appState.partidaIniciada = true;
}

export function setActivePlayer(playerId) {
  const exists = appState.jogadores.some((player) => player.id === playerId);
  if (exists) {
    appState.jogadorAtivoId = playerId;
  }
}

export function getPlayerById(playerId) {
  return appState.jogadores.find((player) => player.id === playerId) ?? null;
}

export function updatePlayerBalance(playerId, delta) {
  const player = getPlayerById(playerId);

  if (!player || player.isBank) {
    return false;
  }

  const nextValue = player.saldo + delta;
  if (nextValue < 0) {
    return false;
  }

  player.saldo = nextValue;
  return true;
}

export function pushHistory(entry) {
  appState.historico.unshift(entry);
  if (appState.historico.length > 200) {
    appState.historico.length = 200;
  }
}

export function clearHistory() {
  appState.historico = [];
}

export function listPlayers(includeBank = true) {
  if (includeBank) {
    return appState.jogadores;
  }
  return appState.jogadores.filter((player) => !player.isBank);
}

export function isGameStarted() {
  return appState.partidaIniciada;
}
