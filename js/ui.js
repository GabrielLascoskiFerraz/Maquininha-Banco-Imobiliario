import {
  clearHistory,
  getPlayerById,
  getState,
  isGameStarted,
  listPlayers,
  replaceState,
  resetState,
  setActivePlayer,
  setGame,
} from './state.js';
import { clearState, loadState, saveState } from './storage.js';
import { payToBank, receiveFromBank, transferBetweenPlayers } from './transactions.js';
import {
  playDiceImpact,
  playDiceJackpot,
  playDiceRollTick,
  playDiceUltraJackpot,
  playError,
  playHallOpenReverb,
  playPaySfx,
  playReceiveSfx,
  playSuccess,
  playTap,
  playTransferSfx,
} from './sound.js';

const PLAYER_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4', '#ec4899', '#84cc16'];
const PLAYER_AVATARS = ['🦊', '🐯', '🐼', '🐸', '🐙', '🦁', '🐵', '🦄', '🐺', '🐧'];
const MAX_PLAYERS = 8;
const MIN_PLAYERS = 2;
const NEW_PLAYER_DEFAULT_BALANCE = 1500;
const CRITICAL_TRANSFER_THRESHOLD = 1000;

const dom = {
  playerSelector: document.getElementById('playerSelector'),
  activePlayerCard: document.getElementById('activePlayerCard'),
  activePlayerName: document.getElementById('activePlayerName'),
  activePlayerBalance: document.getElementById('activePlayerBalance'),
  receiveBtn: document.getElementById('receiveBtn'),
  payBtn: document.getElementById('payBtn'),
  rollDiceBtn: document.getElementById('rollDiceBtn'),
  dicePanel: document.querySelector('.dice-panel'),
  diceStage: document.getElementById('diceStage'),
  diceOne: document.getElementById('diceOne'),
  diceTwo: document.getElementById('diceTwo'),
  diceResult: document.getElementById('diceResult'),
  transferFromBtn: document.getElementById('transferFromBtn'),
  transferToBtn: document.getElementById('transferToBtn'),
  transferFromMenu: document.getElementById('transferFromMenu'),
  transferToMenu: document.getElementById('transferToMenu'),
  transferPanel: document.querySelector('.transfer-panel'),
  transferValueBtn: document.getElementById('transferValueBtn'),
  transferValueLabel: document.getElementById('transferValueLabel'),
  transferConfirmBtn: document.getElementById('transferConfirmBtn'),
  historyList: document.getElementById('historyList'),
  clearHistoryBtn: document.getElementById('clearHistoryBtn'),
  summaryBtn: document.getElementById('summaryBtn'),
  summaryModal: document.getElementById('summaryModal'),
  summaryPodium: document.getElementById('summaryPodium'),
  summaryLeaderGap: document.getElementById('summaryLeaderGap'),
  summaryList: document.getElementById('summaryList'),
  summaryCloseBtn: document.getElementById('summaryCloseBtn'),
  resetBtn: document.getElementById('resetBtn'),
  setupModal: document.getElementById('setupModal'),
  setupPlayersList: document.getElementById('setupPlayersList'),
  addPlayerBtn: document.getElementById('addPlayerBtn'),
  startGameBtn: document.getElementById('startGameBtn'),
  startingBalance: document.getElementById('startingBalance'),
  valueModal: document.getElementById('valueModal'),
  valueTitle: document.getElementById('valueTitle'),
  valueModalContext: document.getElementById('valueModalContext'),
  valueDisplay: document.getElementById('valueDisplay'),
  numpad: document.getElementById('numpad'),
  cancelValueBtn: document.getElementById('cancelValueBtn'),
  confirmValueBtn: document.getElementById('confirmValueBtn'),
  confirmModal: document.getElementById('confirmModal'),
  confirmMessage: document.getElementById('confirmMessage'),
  confirmNoBtn: document.getElementById('confirmNoBtn'),
  confirmYesBtn: document.getElementById('confirmYesBtn'),
  settingsModal: document.getElementById('settingsModal'),
  settingsPlayersList: document.getElementById('settingsPlayersList'),
  settingsAddPlayerBtn: document.getElementById('settingsAddPlayerBtn'),
  settingsCloseBtn: document.getElementById('settingsCloseBtn'),
  settingsSaveBtn: document.getElementById('settingsSaveBtn'),
  settingsResetBtn: document.getElementById('settingsResetBtn'),
};

const uiState = {
  transferValue: 0,
  setupPlayers: [
    { nome: 'Jogador 1', cor: PLAYER_COLORS[0], avatar: PLAYER_AVATARS[0] },
    { nome: 'Jogador 2', cor: PLAYER_COLORS[1], avatar: PLAYER_AVATARS[1] },
    { nome: 'Jogador 3', cor: PLAYER_COLORS[2], avatar: PLAYER_AVATARS[2] },
    { nome: 'Jogador 4', cor: PLAYER_COLORS[3], avatar: PLAYER_AVATARS[3] },
  ],
  valueModalOpen: false,
  valueBuffer: '0',
  valueConfirmHandler: null,
  confirmHandler: null,
  previousBalances: new Map(),
  balanceAnimationFrame: null,
  transferValueAnimationFrame: null,
  lastActivePlayerId: null,
  lastTransferValue: 0,
  transferFromId: null,
  transferToId: null,
  openTransferMenu: null,
  settingsDraftPlayers: [],
  diceRolling: false,
  diceSoundInterval: null,
  summaryPreviousPositions: new Map(),
  summaryPreviousBalances: new Map(),
  summaryBalanceAnimationFrames: new Map(),
  lastHistoryTopTimestamp: null,
  lastLeaderId: null,
  hasLeaderBaseline: false,
};

function formatMoney(value) {
  if (!Number.isFinite(Number(value))) {
    return '$∞';
  }
  return `$${Number(value).toLocaleString('pt-BR')}`;
}

function toPlayerId(name) {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${crypto.randomUUID().slice(0, 8)}`;
}

function getAvatarForPlayer(player, fallbackIndex = 0) {
  if (player?.avatar) {
    return player.avatar;
  }
  const seedSource = String(player?.id ?? fallbackIndex);
  const hash = [...seedSource].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return PLAYER_AVATARS[hash % PLAYER_AVATARS.length];
}

function notify(message, type = 'ok') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = {
    ok: '✅',
    error: '⚠️',
    receive: '🟢',
    pay: '🔴',
    transfer: '🔁',
    dice: '🎲',
  };
  toast.innerHTML = `<span class="toast-icon">${icons[type] ?? '✨'}</span><span class="toast-text"></span>`;
  toast.querySelector('.toast-text').textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 180);
  }, 1800);
}

function createFloatingBanner(text, color) {
  const banner = document.createElement('div');
  banner.className = 'leader-change-banner';
  banner.innerHTML = `
    <span class="leader-change-crown">👑</span>
    <span class="player-color-dot" style="--dot-color: ${color};"></span>
    <span>${text}</span>
  `;
  document.body.appendChild(banner);
  requestAnimationFrame(() => banner.classList.add('show'));
  setTimeout(() => {
    banner.classList.remove('show');
    setTimeout(() => banner.remove(), 260);
  }, 1900);
}

function persist() {
  saveState(getState());
}

function animateMoneyText(element, from, to, frameKey, prefix = '') {
  if (!element) {
    return;
  }

  const delta = to - from;
  if (delta === 0) {
    element.textContent = `${prefix}${formatMoney(to)}`;
    return;
  }

  if (uiState[frameKey]) {
    cancelAnimationFrame(uiState[frameKey]);
  }

  const duration = 360;
  const startAt = performance.now();

  const tick = (now) => {
    const progress = Math.min((now - startAt) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(from + delta * eased);
    element.textContent = `${prefix}${formatMoney(value)}`;

    if (progress < 1) {
      uiState[frameKey] = requestAnimationFrame(tick);
      return;
    }

    uiState[frameKey] = null;
    element.textContent = `${prefix}${formatMoney(to)}`;
  };

  uiState[frameKey] = requestAnimationFrame(tick);
}

function renderPlayerSelector() {
  dom.playerSelector.innerHTML = '';
  const state = getState();
  const players = listPlayers(false);
  const leader = [...players].sort((a, b) => b.saldo - a.saldo)[0];
  const leaderId = leader?.id ?? null;

  players.forEach((player) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'player-chip';
    if (player.id === state.jogadorAtivoId) {
      btn.classList.add('active');
    }
    btn.style.setProperty('--chip-color', player.cor);
    btn.innerHTML = `
      <span class="player-chip-avatar">${getAvatarForPlayer(player)}</span>
      <span>${player.nome}</span>
      ${player.id === leaderId ? '<span class="player-chip-crown">👑</span>' : ''}
    `;
    btn.addEventListener('click', () => {
      playTap();
      setActivePlayer(player.id);
      render();
      persist();
    });
    dom.playerSelector.appendChild(btn);
  });
}

function animateBalanceIfChanged(player) {
  const oldBalance = uiState.previousBalances.get(player.id);
  if (typeof oldBalance === 'number' && oldBalance !== player.saldo) {
    dom.activePlayerBalance.classList.remove('balance-pulse');
    dom.activePlayerBalance.classList.remove('balance-up');
    dom.activePlayerBalance.classList.remove('balance-down');
    void dom.activePlayerBalance.offsetWidth;
    dom.activePlayerBalance.classList.add('balance-pulse');
    dom.activePlayerBalance.classList.add(oldBalance < player.saldo ? 'balance-up' : 'balance-down');
  }
  uiState.previousBalances.set(player.id, player.saldo);
}

function renderActivePlayer() {
  const state = getState();
  let active = getPlayerById(state.jogadorAtivoId) ?? listPlayers(true)[0];

  if (active?.isBank) {
    const firstHuman = listPlayers(false)[0];
    if (firstHuman) {
      setActivePlayer(firstHuman.id);
      active = firstHuman;
    }
  }

  if (!active) {
    return;
  }

  if (uiState.lastActivePlayerId && uiState.lastActivePlayerId !== active.id) {
    dom.activePlayerCard.classList.remove('player-switch');
    void dom.activePlayerCard.offsetWidth;
    dom.activePlayerCard.classList.add('player-switch');
    dom.activePlayerBalance.classList.remove('balance-up');
    dom.activePlayerBalance.classList.remove('balance-down');
  }

  dom.activePlayerName.textContent = active.nome;
  const oldBalance = uiState.previousBalances.get(active.id);
  if (typeof oldBalance === 'number') {
    animateMoneyText(dom.activePlayerBalance, oldBalance, active.saldo, 'balanceAnimationFrame');
  } else {
    dom.activePlayerBalance.textContent = formatMoney(active.saldo);
  }
  dom.activePlayerCard?.style?.setProperty('--active-color', active.cor ?? '#0f766e');

  animateBalanceIfChanged(active);
  uiState.lastActivePlayerId = active.id;

  const isBank = Boolean(active.isBank);
  dom.receiveBtn.disabled = isBank;
  dom.payBtn.disabled = isBank;
}

function renderTransferSelectors() {
  const players = listPlayers(false);
  if (players.length < 2) {
    dom.transferFromBtn.disabled = true;
    dom.transferToBtn.disabled = true;
    dom.transferConfirmBtn.disabled = true;
    dom.transferFromBtn.innerHTML = '<span class="transfer-select-value"><span>Jogadores insuficientes</span></span>';
    dom.transferToBtn.innerHTML = '<span class="transfer-select-value"><span>Jogadores insuficientes</span></span>';
    dom.transferFromMenu.innerHTML = '';
    dom.transferToMenu.innerHTML = '';
    return;
  }

  dom.transferFromBtn.disabled = false;
  dom.transferToBtn.disabled = false;
  dom.transferConfirmBtn.disabled = false;
  const activeId = getState().jogadorAtivoId;
  const playerExists = (playerId) => players.some((player) => player.id === playerId);

  if (!playerExists(uiState.transferFromId)) {
    uiState.transferFromId = playerExists(activeId) ? activeId : players[0]?.id ?? null;
  }

  if (!playerExists(uiState.transferToId) || uiState.transferToId === uiState.transferFromId) {
    uiState.transferToId = players.find((p) => p.id !== uiState.transferFromId)?.id ?? uiState.transferFromId;
  }

  const renderTransferOption = (player, type) => {
    const willSwap =
      (type === 'from' && player.id === uiState.transferToId) ||
      (type === 'to' && player.id === uiState.transferFromId);

    return `
      <button type="button" class="transfer-option ${willSwap ? 'will-swap' : ''}" data-type="${type}" data-id="${player.id}">
        <span class="player-color-dot" style="--dot-color: ${player.cor};"></span>
        <span>${player.nome}</span>
      </button>
    `;
  };

  const selectedFrom = players.find((player) => player.id === uiState.transferFromId);
  const selectedTo = players.find((player) => player.id === uiState.transferToId);

  const setTransferButtonLabel = (button, player) => {
    if (!button) {
      return;
    }
    if (!player) {
      button.innerHTML = '<span class="transfer-select-value"><span>Selecionar</span></span><span class="transfer-select-arrow">▾</span>';
      return;
    }
    button.innerHTML = `
      <span class="transfer-select-value">
        <span class="player-color-dot" style="--dot-color: ${player.cor};"></span>
        <span>${player.nome}</span>
      </span>
      <span class="transfer-select-arrow">▾</span>
    `;
  };

  setTransferButtonLabel(dom.transferFromBtn, selectedFrom);
  setTransferButtonLabel(dom.transferToBtn, selectedTo);

  dom.transferFromMenu.innerHTML = players.map((player) => renderTransferOption(player, 'from')).join('');
  dom.transferToMenu.innerHTML = players.map((player) => renderTransferOption(player, 'to')).join('');

  animateMoneyText(
    dom.transferValueLabel,
    uiState.lastTransferValue,
    uiState.transferValue,
    'transferValueAnimationFrame',
    'Valor: '
  );
  uiState.lastTransferValue = uiState.transferValue;
}

function applyTransferSelection(type, selectedId) {
  if (!selectedId) {
    return false;
  }

  if (type === 'from') {
    if (selectedId === uiState.transferToId) {
      const previousFrom = uiState.transferFromId;
      uiState.transferFromId = selectedId;
      uiState.transferToId = previousFrom;
      return true;
    }
    uiState.transferFromId = selectedId;
    if (uiState.transferFromId === uiState.transferToId) {
      const fallback = listPlayers(false).find((player) => player.id !== uiState.transferFromId);
      uiState.transferToId = fallback?.id ?? uiState.transferToId;
    }
    return false;
  }

  if (selectedId === uiState.transferFromId) {
    const previousTo = uiState.transferToId;
    uiState.transferToId = selectedId;
    uiState.transferFromId = previousTo;
    return true;
  }
  uiState.transferToId = selectedId;
  if (uiState.transferToId === uiState.transferFromId) {
    const fallback = listPlayers(false).find((player) => player.id !== uiState.transferToId);
    uiState.transferFromId = fallback?.id ?? uiState.transferFromId;
  }
  return false;
}

function renderHistory() {
  const history = getState().historico;
  dom.historyList.innerHTML = '';

  if (!history.length) {
    const empty = document.createElement('li');
    empty.className = 'history-empty';
    empty.textContent = 'Nenhuma transação registrada.';
    dom.historyList.appendChild(empty);
    return;
  }

  history.forEach((entry) => {
    const li = document.createElement('li');
    li.classList.add(`history-${entry.tipo}`);
    if (
      uiState.lastHistoryTopTimestamp &&
      history[0]?.timestamp !== uiState.lastHistoryTopTimestamp &&
      entry === history[0]
    ) {
      li.classList.add('history-enter');
    }
    const date = new Date(entry.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    li.innerHTML = `<strong>${entry.descricao}</strong><span>${date}</span>`;
    dom.historyList.appendChild(li);
  });

  uiState.lastHistoryTopTimestamp = history[0]?.timestamp ?? null;
}

function createPlayerDot(color) {
  const dot = document.createElement('span');
  dot.className = 'player-color-dot';
  dot.style.setProperty('--dot-color', color);
  return dot;
}

function getRankingData() {
  return listPlayers(false)
    .map((player) => ({
      id: player.id,
      nome: player.nome,
      cor: player.cor,
      avatar: getAvatarForPlayer(player),
      saldo: player.saldo,
    }))
    .sort((a, b) => b.saldo - a.saldo);
}

function createCrownElement() {
  const wrap = document.createElement('span');
  wrap.className = 'summary-crown-wrap';

  const crown = document.createElement('span');
  crown.className = 'summary-crown';
  crown.textContent = '👑';
  wrap.appendChild(crown);

  for (let i = 0; i < 3; i += 1) {
    const spark = document.createElement('span');
    spark.className = 'summary-crown-spark';
    spark.style.animationDelay = `${i * 180}ms`;
    wrap.appendChild(spark);
  }

  return wrap;
}

function animateSummaryBalance(playerId, element, from, to) {
  const prevFrame = uiState.summaryBalanceAnimationFrames.get(playerId);
  if (prevFrame) {
    cancelAnimationFrame(prevFrame);
  }

  if (from === to) {
    element.textContent = formatMoney(to);
    return;
  }

  const duration = 620;
  const startAt = performance.now();
  const delta = to - from;

  const tick = (now) => {
    const progress = Math.min((now - startAt) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = formatMoney(Math.round(from + delta * eased));

    if (progress < 1) {
      uiState.summaryBalanceAnimationFrames.set(playerId, requestAnimationFrame(tick));
    } else {
      uiState.summaryBalanceAnimationFrames.delete(playerId);
      element.textContent = formatMoney(to);
    }
  };

  uiState.summaryBalanceAnimationFrames.set(playerId, requestAnimationFrame(tick));
}

function renderSummaryBoard(animateBalances = false) {
  const ranking = getRankingData();
  dom.summaryBtn.disabled = ranking.length === 0;
  const shouldTrackSummaryState = animateBalances || dom.summaryModal.classList.contains('is-open');

  dom.summaryPodium.innerHTML = '';
  dom.summaryLeaderGap.innerHTML = '';
  dom.summaryList.innerHTML = '';

  if (!ranking.length) {
    const empty = document.createElement('p');
    empty.className = 'summary-empty';
    empty.textContent = 'Inicie uma partida para visualizar o placar.';
    dom.summaryList.appendChild(empty);
    return;
  }

  const leaderSaldo = ranking[0].saldo;
  const secondSaldo = ranking[1]?.saldo ?? 0;
  const diffToSecond = Math.max(0, leaderSaldo - secondSaldo);

  const podiumOrder = [ranking[1], ranking[0], ranking[2]].filter(Boolean);
  podiumOrder.forEach((player, index) => {
    const placement = player.id === ranking[0].id ? 1 : player.id === ranking[1]?.id ? 2 : 3;
    const card = document.createElement('div');
    card.className = `podium-card place-${placement}`;
    card.style.setProperty('--podium-color', player.cor);
    card.style.animationDelay = `${index * 90}ms`;

    const title = document.createElement('span');
    title.className = 'podium-title';
    title.textContent = `${placement}º`;

    const identity = document.createElement('div');
    identity.className = 'podium-player';
    identity.append(createPlayerDot(player.cor));
    const avatar = document.createElement('span');
    avatar.className = 'summary-avatar';
    avatar.textContent = player.avatar;
    identity.append(avatar);
    const name = document.createElement('span');
    name.textContent = player.nome;
    identity.append(name);

    const balance = document.createElement('strong');
    balance.className = 'podium-balance';
    balance.textContent = formatMoney(player.saldo);

    card.append(title, identity, balance);
    if (placement === 1) {
      card.append(createCrownElement());
    }

    dom.summaryPodium.appendChild(card);
  });

  const leaderGap = document.createElement('p');
  leaderGap.className = 'summary-gap-text';
  leaderGap.textContent =
    ranking.length > 1
      ? `${ranking[0].nome} lidera por ${formatMoney(diffToSecond)} sobre ${ranking[1].nome}`
      : `${ranking[0].nome} está jogando sozinho na liderança`;
  dom.summaryLeaderGap.appendChild(leaderGap);

  ranking.forEach((player, index) => {
    const isLeader = player.saldo === leaderSaldo;
    const currentPosition = index + 1;
    const previousPosition = uiState.summaryPreviousPositions.get(player.id);
    let moveClass = 'steady';
    let moveLabel = '•';
    if (typeof previousPosition === 'number') {
      if (previousPosition > currentPosition) {
        moveClass = 'up';
        moveLabel = '↑';
      } else if (previousPosition < currentPosition) {
        moveClass = 'down';
        moveLabel = '↓';
      }
    }

    const row = document.createElement('div');
    row.className = `summary-row ${isLeader ? 'leader' : ''} move-${moveClass}`;
    row.style.animationDelay = `${index * 70}ms`;

    const rankTag = document.createElement('span');
    rankTag.className = 'summary-rank';
    rankTag.textContent = `#${currentPosition}`;

    const movement = document.createElement('span');
    movement.className = `summary-move-indicator ${moveClass}`;
    movement.textContent = moveLabel;

    const playerInfo = document.createElement('div');
    playerInfo.className = 'summary-player';
    playerInfo.append(createPlayerDot(player.cor));
    const avatar = document.createElement('span');
    avatar.className = 'summary-avatar';
    avatar.textContent = player.avatar;
    playerInfo.append(avatar);
    const name = document.createElement('span');
    name.textContent = player.nome;
    playerInfo.append(name);

    const balance = document.createElement('strong');
    balance.className = 'summary-balance';
    const previousBalance = uiState.summaryPreviousBalances.get(player.id);
    if (animateBalances) {
      const fromValue = typeof previousBalance === 'number' ? previousBalance : 0;
      animateSummaryBalance(player.id, balance, fromValue, player.saldo);
    } else {
      balance.textContent = formatMoney(player.saldo);
    }

    row.append(rankTag, movement, playerInfo, balance);
    if (isLeader) {
      row.append(createCrownElement());
    }

    dom.summaryList.appendChild(row);

    if (shouldTrackSummaryState) {
      uiState.summaryPreviousPositions.set(player.id, currentPosition);
      uiState.summaryPreviousBalances.set(player.id, player.saldo);
    }
  });
}

function openSummaryModal() {
  renderSummaryBoard(true);
  dom.summaryModal.setAttribute('aria-hidden', 'false');
  dom.summaryModal.classList.add('is-open');
  playHallOpenReverb();
}

function closeSummaryModal() {
  dom.summaryModal.setAttribute('aria-hidden', 'true');
  dom.summaryModal.classList.remove('is-open');
}

function maybeAnnounceLeaderChange() {
  if (!isGameStarted()) {
    uiState.hasLeaderBaseline = false;
    uiState.lastLeaderId = null;
    return;
  }

  const ranking = getRankingData();
  const leader = ranking[0];
  if (!leader) {
    return;
  }

  if (!uiState.hasLeaderBaseline) {
    uiState.hasLeaderBaseline = true;
    uiState.lastLeaderId = leader.id;
    return;
  }

  if (uiState.lastLeaderId !== leader.id) {
    uiState.lastLeaderId = leader.id;
    createFloatingBanner(`Novo líder: ${leader.nome}`, leader.cor);
  }
}

function renderSetupPlayers() {
  dom.setupPlayersList.innerHTML = '';

  uiState.setupPlayers.forEach((player, index) => {
    const row = document.createElement('div');
    row.className = 'setup-player-row';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.maxLength = 16;
    nameInput.value = player.nome;
    nameInput.placeholder = `Jogador ${index + 1}`;
    nameInput.addEventListener('input', (event) => {
      uiState.setupPlayers[index].nome = event.target.value;
    });

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = player.cor;
    colorInput.addEventListener('input', (event) => {
      uiState.setupPlayers[index].cor = event.target.value;
    });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'ghost-btn';
    removeBtn.textContent = 'Remover';
    removeBtn.disabled = uiState.setupPlayers.length <= 2;
    removeBtn.addEventListener('click', () => {
      uiState.setupPlayers.splice(index, 1);
      renderSetupPlayers();
    });

    row.append(nameInput, colorInput, removeBtn);
    dom.setupPlayersList.appendChild(row);
  });
}

function openValueModal(title, context, onConfirm) {
  uiState.valueModalOpen = true;
  uiState.valueBuffer = '0';
  uiState.valueConfirmHandler = onConfirm;

  dom.valueTitle.textContent = title;
  dom.valueModalContext.textContent = context;
  dom.valueDisplay.textContent = formatMoney(0);
  dom.valueModal.setAttribute('aria-hidden', 'false');
  dom.valueModal.classList.add('is-open');
}

function closeValueModal() {
  uiState.valueModalOpen = false;
  uiState.valueConfirmHandler = null;
  dom.valueModal.setAttribute('aria-hidden', 'true');
  dom.valueModal.classList.remove('is-open');
}

function updateValueFromNumpad(action, digit) {
  if (!uiState.valueModalOpen) {
    return;
  }

  if (action === 'clear') {
    uiState.valueBuffer = '0';
  } else if (action === 'backspace') {
    uiState.valueBuffer = uiState.valueBuffer.slice(0, -1) || '0';
  } else if (digit) {
    uiState.valueBuffer = uiState.valueBuffer === '0' ? digit : `${uiState.valueBuffer}${digit}`;
  }

  dom.valueDisplay.textContent = formatMoney(Number(uiState.valueBuffer));
}

function openConfirmModal(message, onConfirm) {
  uiState.confirmHandler = onConfirm;
  dom.confirmMessage.textContent = message;
  dom.confirmModal.setAttribute('aria-hidden', 'false');
  dom.confirmModal.classList.add('is-open');
}

function closeConfirmModal() {
  uiState.confirmHandler = null;
  dom.confirmModal.setAttribute('aria-hidden', 'true');
  dom.confirmModal.classList.remove('is-open');
}

function renderSettingsPlayers() {
  dom.settingsPlayersList.innerHTML = '';

  uiState.settingsDraftPlayers.forEach((player, index) => {
    const row = document.createElement('div');
    row.className = 'settings-player-row';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.maxLength = 16;
    nameInput.value = player.nome;

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = player.cor;

    const avatarBtn = document.createElement('button');
    avatarBtn.type = 'button';
    avatarBtn.className = 'settings-avatar-btn';
    avatarBtn.textContent = player.avatar ?? getAvatarForPlayer(player, index);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'ghost-btn';
    removeBtn.textContent = 'Remover';
    removeBtn.disabled = uiState.settingsDraftPlayers.length <= MIN_PLAYERS;

    nameInput.addEventListener('input', (event) => {
      uiState.settingsDraftPlayers[index].nome = event.target.value;
    });

    colorInput.addEventListener('input', (event) => {
      uiState.settingsDraftPlayers[index].cor = event.target.value;
    });

    avatarBtn.addEventListener('click', () => {
      const currentAvatar = uiState.settingsDraftPlayers[index].avatar ?? getAvatarForPlayer(player, index);
      const currentAvatarIndex = PLAYER_AVATARS.indexOf(currentAvatar);
      const nextIndex = currentAvatarIndex >= 0 ? (currentAvatarIndex + 1) % PLAYER_AVATARS.length : 0;
      uiState.settingsDraftPlayers[index].avatar = PLAYER_AVATARS[nextIndex];
      avatarBtn.textContent = uiState.settingsDraftPlayers[index].avatar;
      playTap();
    });

    removeBtn.addEventListener('click', () => {
      if (uiState.settingsDraftPlayers.length <= MIN_PLAYERS) {
        notify(`A partida precisa de pelo menos ${MIN_PLAYERS} jogadores.`, 'error');
        return;
      }
      uiState.settingsDraftPlayers.splice(index, 1);
      renderSettingsPlayers();
    });

    row.append(nameInput, colorInput, avatarBtn, removeBtn);
    dom.settingsPlayersList.appendChild(row);
  });
}

function openSettingsModal() {
  const players = listPlayers(false);
  uiState.settingsDraftPlayers = players.map((player) => ({
    id: player.id,
    nome: player.nome,
    cor: player.cor,
    avatar: getAvatarForPlayer(player),
  }));
  renderSettingsPlayers();
  dom.settingsModal.setAttribute('aria-hidden', 'false');
  dom.settingsModal.classList.add('is-open');
}

function closeSettingsModal() {
  dom.settingsModal.setAttribute('aria-hidden', 'true');
  dom.settingsModal.classList.remove('is-open');
}

function applySettingsChanges() {
  const state = getState();
  const bank = state.jogadores.find((player) => player.isBank);
  const currentPlayersById = new Map(
    state.jogadores.filter((player) => !player.isBank).map((player) => [player.id, player])
  );

  const nextPlayers = uiState.settingsDraftPlayers.map((draft, index) => {
    const currentPlayer = currentPlayersById.get(draft.id);
    const safeName = draft.nome.trim() || `Jogador ${index + 1}`;

    if (currentPlayer) {
      return {
        ...currentPlayer,
        nome: safeName,
        cor: draft.cor,
        avatar: draft.avatar ?? getAvatarForPlayer(currentPlayer, index),
      };
    }

    return {
      id: draft.id,
      nome: safeName,
      cor: draft.cor,
      avatar: draft.avatar ?? PLAYER_AVATARS[index % PLAYER_AVATARS.length],
      saldo: NEW_PLAYER_DEFAULT_BALANCE,
      isBank: false,
    };
  });

  state.jogadores = [bank, ...nextPlayers];

  persist();
  render();
}

function runSafeTransaction(fn) {
  try {
    fn();
    playSuccess();
    render();
    persist();
    return true;
  } catch (error) {
    playError();
    notify(error.message, 'error');
    if (typeof error.message === 'string' && error.message.toLowerCase().includes('saldo insuficiente')) {
      dom.activePlayerCard.classList.remove('insufficient-shake');
      void dom.activePlayerCard.offsetWidth;
      dom.activePlayerCard.classList.add('insufficient-shake');
    }
    return false;
  }
}

function burstMoneyParticles(type) {
  const sourceRect = dom.activePlayerCard.getBoundingClientRect();
  const layer = document.createElement('div');
  layer.className = `money-particles ${type}`;
  const count = 16;

  for (let i = 0; i < count; i += 1) {
    const particle = document.createElement('span');
    particle.className = 'money-particle';
    particle.textContent = '$';
    particle.style.left = `${sourceRect.left + sourceRect.width * (0.28 + Math.random() * 0.44)}px`;
    particle.style.top = `${sourceRect.top + sourceRect.height * (0.45 + Math.random() * 0.2)}px`;
    particle.style.setProperty('--money-x', `${Math.random() * 120 - 60}px`);
    particle.style.setProperty('--money-delay', `${Math.random() * 160}ms`);
    layer.appendChild(particle);
  }

  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 1300);
}

function animateTransferFx(value, isCritical = false) {
  const fromRect = dom.transferFromBtn.getBoundingClientRect();
  const toRect = dom.transferToBtn.getBoundingClientRect();
  const chip = document.createElement('div');
  chip.className = `transfer-fx-chip ${isCritical ? 'critical' : ''}`;
  chip.textContent = `💸 ${formatMoney(value)}`;
  chip.style.left = `${fromRect.left + fromRect.width / 2}px`;
  chip.style.top = `${fromRect.top + fromRect.height / 2}px`;
  document.body.appendChild(chip);

  dom.transferPanel.classList.remove('transfer-impact');
  dom.transferPanel.classList.remove('transfer-critical');
  void dom.transferPanel.offsetWidth;
  dom.transferPanel.classList.add('transfer-impact');
  if (isCritical) {
    dom.transferPanel.classList.add('transfer-critical');
  }

  dom.transferFromBtn.classList.remove('transfer-source-hit');
  dom.transferToBtn.classList.remove('transfer-target-hit');
  void dom.transferFromBtn.offsetWidth;
  dom.transferFromBtn.classList.add('transfer-source-hit');
  dom.transferToBtn.classList.add('transfer-target-hit');

  const deltaX = toRect.left - fromRect.left;
  const deltaY = toRect.top - fromRect.top;
  chip.animate(
    [
      { transform: 'translate(-50%, -50%) scale(0.88)', opacity: 0.2 },
      { transform: 'translate(-50%, -70%) scale(1)', opacity: 1, offset: 0.2 },
      { transform: `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px)) scale(1.04)`, opacity: 1, offset: 0.85 },
      { transform: `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px)) scale(0.9)`, opacity: 0 }
    ],
    {
      duration: isCritical ? 980 : 820,
      easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      fill: 'forwards'
    }
  );

  setTimeout(() => {
    chip.remove();
    dom.transferPanel.classList.remove('transfer-impact');
    dom.transferPanel.classList.remove('transfer-critical');
    dom.transferFromBtn.classList.remove('transfer-source-hit');
    dom.transferToBtn.classList.remove('transfer-target-hit');
  }, isCritical ? 1100 : 900);
}

function randomDieValue() {
  return Math.floor(Math.random() * 6) + 1;
}

function setDieValue(dieElement, value) {
  dieElement.dataset.value = String(value);
}

function clearDiceFxClasses() {
  dom.diceStage.classList.remove('impact');
  dom.diceOne.classList.remove('result-pop');
  dom.diceTwo.classList.remove('result-pop');
  dom.dicePanel.classList.remove('jackpot');
  dom.dicePanel.classList.remove('ultra-jackpot');
  dom.diceResult.classList.remove('jackpot');
}

function burstConfetti(isJackpot = false) {
  const layer = document.createElement('div');
  layer.className = `confetti-layer ${isJackpot ? 'jackpot' : ''}`;
  const colors = ['#ffd166', '#ff6b6b', '#4cc9f0', '#80ed99', '#f72585', '#bde0fe'];
  const pieces = isJackpot ? 90 : 56;

  for (let i = 0; i < pieces; i += 1) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.top = `${Math.random() * 30 - 10}%`;
    piece.style.setProperty('--confetti-color', colors[Math.floor(Math.random() * colors.length)]);
    piece.style.setProperty('--confetti-rotate', `${Math.random() * 680 - 340}deg`);
    piece.style.setProperty('--confetti-duration', `${1000 + Math.random() * 900}ms`);
    piece.style.setProperty('--confetti-delay', `${Math.random() * 180}ms`);
    piece.style.setProperty('--confetti-x', `${Math.random() * 180 - 90}px`);
    layer.appendChild(piece);
  }

  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 2600);
}

function rollDice() {
  if (uiState.diceRolling) {
    return;
  }

  uiState.diceRolling = true;
  dom.rollDiceBtn.disabled = true;
  clearDiceFxClasses();
  dom.diceStage.classList.add('rolling');
  dom.diceOne.classList.add('rolling');
  dom.diceTwo.classList.add('rolling');
  dom.diceResult.textContent = 'Rolando...';
  playDiceRollTick();
  uiState.diceSoundInterval = setInterval(playDiceRollTick, 120);

  const intervalId = setInterval(() => {
    setDieValue(dom.diceOne, randomDieValue());
    setDieValue(dom.diceTwo, randomDieValue());
  }, 85);

  setTimeout(() => {
    clearInterval(intervalId);
    if (uiState.diceSoundInterval) {
      clearInterval(uiState.diceSoundInterval);
      uiState.diceSoundInterval = null;
    }

    const first = randomDieValue();
    const second = randomDieValue();
    const total = first + second;
    const isJackpot = first === second;
    const isUltraJackpot = isJackpot && first === 6;

    setDieValue(dom.diceOne, first);
    setDieValue(dom.diceTwo, second);

    dom.diceStage.classList.remove('rolling');
    dom.diceStage.classList.add('impact');
    dom.diceOne.classList.remove('rolling');
    dom.diceTwo.classList.remove('rolling');
    dom.diceOne.classList.add('result-pop');
    dom.diceTwo.classList.add('result-pop');
    dom.diceResult.textContent = `Resultado: ${first} + ${second} = ${total}`;
    playDiceImpact();
    if (isJackpot) {
      dom.dicePanel.classList.add('jackpot');
      dom.diceResult.classList.add('jackpot');
      dom.diceResult.textContent = `Resultado: ${first} + ${second} = ${total}  DUPLO!`;
      playDiceJackpot();
      burstConfetti(true);
      notify('DUPLO! Jogue com sorte.', 'dice');
      if (isUltraJackpot) {
        dom.dicePanel.classList.add('ultra-jackpot');
        dom.diceResult.textContent = `Resultado: ${first} + ${second} = ${total}  ULTRA DUPLO 6!`;
        playDiceUltraJackpot();
        burstConfetti(true);
        notify('ULTRA JACKPOT: DUPLO 6!', 'dice');
      }
    } else {
      playSuccess();
    }

    setTimeout(() => {
      clearDiceFxClasses();
      dom.rollDiceBtn.disabled = false;
      uiState.diceRolling = false;
    }, 360);
  }, 1200);
}

function setupEvents() {
  dom.receiveBtn.addEventListener('click', () => {
    const active = getPlayerById(getState().jogadorAtivoId);
    if (!active || active.isBank) {
      return;
    }

    openValueModal('Receber', `${active.nome} vai receber do Banco`, (value) => {
      const ok = runSafeTransaction(() => receiveFromBank(active.id, value));
      if (ok) {
        playReceiveSfx();
        burstMoneyParticles('receive');
        notify(`${active.nome} recebeu ${formatMoney(value)}.`, 'receive');
      }
    });
  });

  dom.payBtn.addEventListener('click', () => {
    const active = getPlayerById(getState().jogadorAtivoId);
    if (!active || active.isBank) {
      return;
    }

    openValueModal('Pagar', `${active.nome} vai pagar ao Banco`, (value) => {
      const ok = runSafeTransaction(() => payToBank(active.id, value));
      if (ok) {
        playPaySfx();
        burstMoneyParticles('pay');
        notify(`${active.nome} pagou ${formatMoney(value)}.`, 'pay');
      }
    });
  });

  dom.rollDiceBtn.addEventListener('click', rollDice);

  dom.summaryBtn.addEventListener('click', openSummaryModal);
  dom.summaryCloseBtn.addEventListener('click', closeSummaryModal);

  dom.transferValueBtn.addEventListener('click', () => {
    openValueModal('Valor da transferência', 'Defina o valor para transferir', (value) => {
      uiState.transferValue = value;
      renderTransferSelectors();
    });
  });

  dom.transferConfirmBtn.addEventListener('click', () => {
    const from = uiState.transferFromId;
    const to = uiState.transferToId;

    if (!from || !to) {
      notify('Selecione origem e destino.', 'error');
      return;
    }

    const ok = runSafeTransaction(() => {
      transferBetweenPlayers(from, to, uiState.transferValue);
    });
    if (ok) {
      playTransferSfx();
      animateTransferFx(uiState.transferValue, uiState.transferValue >= CRITICAL_TRANSFER_THRESHOLD);
      notify(`Transferência de ${formatMoney(uiState.transferValue)} concluída.`, 'transfer');
    }
    closeTransferMenus();
    renderTransferSelectors();
  });

  dom.clearHistoryBtn.addEventListener('click', () => {
    openConfirmModal('Limpar todo o histórico desta partida?', () => {
      clearHistory();
      persist();
      renderHistory();
    });
  });

  dom.resetBtn.addEventListener('click', () => {
    openSettingsModal();
  });

  dom.settingsCloseBtn.addEventListener('click', () => {
    closeSettingsModal();
  });

  dom.settingsSaveBtn.addEventListener('click', () => {
    applySettingsChanges();
    closeSettingsModal();
    notify('Jogadores atualizados.');
  });

  dom.settingsAddPlayerBtn.addEventListener('click', () => {
    if (uiState.settingsDraftPlayers.length >= MAX_PLAYERS) {
      notify(`Máximo de ${MAX_PLAYERS} jogadores.`, 'error');
      return;
    }

    const nextIndex = uiState.settingsDraftPlayers.length;
    uiState.settingsDraftPlayers.push({
      id: `player-${crypto.randomUUID().slice(0, 8)}`,
      nome: `Jogador ${nextIndex + 1}`,
      cor: PLAYER_COLORS[nextIndex % PLAYER_COLORS.length],
      avatar: PLAYER_AVATARS[nextIndex % PLAYER_AVATARS.length],
    });
    renderSettingsPlayers();
  });

  dom.settingsResetBtn.addEventListener('click', () => {
    openConfirmModal('Resetar a partida atual e voltar para configuração inicial?', () => {
      closeSettingsModal();
      resetState();
      clearState();
      uiState.transferValue = 0;
      render();
      dom.setupModal.classList.add('is-open');
    });
  });

  dom.addPlayerBtn.addEventListener('click', () => {
    if (uiState.setupPlayers.length >= 8) {
      notify('Máximo de 8 jogadores.', 'error');
      return;
    }

    const nextIndex = uiState.setupPlayers.length;
    uiState.setupPlayers.push({
      nome: `Jogador ${nextIndex + 1}`,
      cor: PLAYER_COLORS[nextIndex % PLAYER_COLORS.length],
      avatar: PLAYER_AVATARS[nextIndex % PLAYER_AVATARS.length],
    });
    renderSetupPlayers();
  });

  dom.startGameBtn.addEventListener('click', () => {
    const initialBalance = Number(dom.startingBalance.value);
    if (!Number.isFinite(initialBalance) || initialBalance <= 0) {
      notify('Defina um saldo inicial válido.', 'error');
      return;
    }

    const preparedPlayers = uiState.setupPlayers
      .map((player) => ({ ...player, nome: player.nome.trim() }))
      .filter((player) => player.nome.length > 0)
      .map((player, index) => ({ ...player, id: toPlayerId(player.nome), avatar: player.avatar ?? PLAYER_AVATARS[index % PLAYER_AVATARS.length] }));

    if (preparedPlayers.length < 2) {
      notify('A partida precisa de pelo menos 2 jogadores.', 'error');
      return;
    }

    setGame(preparedPlayers, Math.floor(initialBalance));
    uiState.transferValue = 0;
    dom.setupModal.classList.remove('is-open');
    render();
    persist();
  });

  dom.numpad.addEventListener('click', (event) => {
    const target = event.target.closest('button');
    if (!target) {
      return;
    }

    playTap();
    updateValueFromNumpad(target.dataset.action, target.dataset.digit);
  });

  dom.cancelValueBtn.addEventListener('click', closeValueModal);

  dom.confirmValueBtn.addEventListener('click', () => {
    const value = Number(uiState.valueBuffer);
    if (!uiState.valueConfirmHandler) {
      closeValueModal();
      return;
    }

    if (value <= 0) {
      notify('Informe um valor maior que zero.', 'error');
      return;
    }

    const handler = uiState.valueConfirmHandler;
    closeValueModal();
    handler(value);
  });

  dom.confirmNoBtn.addEventListener('click', closeConfirmModal);

  dom.confirmYesBtn.addEventListener('click', () => {
    const handler = uiState.confirmHandler;
    closeConfirmModal();
    if (handler) {
      handler();
    }
  });

  dom.transferFromBtn.addEventListener('click', () => {
    toggleTransferMenu('from');
  });

  dom.transferToBtn.addEventListener('click', () => {
    toggleTransferMenu('to');
  });

  dom.transferFromMenu.addEventListener('click', (event) => {
    const option = event.target.closest('.transfer-option');
    if (!option) {
      return;
    }
    const swapped = applyTransferSelection('from', option.dataset.id);
    closeTransferMenus();
    renderTransferSelectors();
    if (swapped) {
      dom.transferPanel.classList.remove('transfer-swap-flip');
      void dom.transferPanel.offsetWidth;
      dom.transferPanel.classList.add('transfer-swap-flip');
      setTimeout(() => dom.transferPanel.classList.remove('transfer-swap-flip'), 420);
    }
  });

  dom.transferToMenu.addEventListener('click', (event) => {
    const option = event.target.closest('.transfer-option');
    if (!option) {
      return;
    }
    const swapped = applyTransferSelection('to', option.dataset.id);
    closeTransferMenus();
    renderTransferSelectors();
    if (swapped) {
      dom.transferPanel.classList.remove('transfer-swap-flip');
      void dom.transferPanel.offsetWidth;
      dom.transferPanel.classList.add('transfer-swap-flip');
      setTimeout(() => dom.transferPanel.classList.remove('transfer-swap-flip'), 420);
    }
  });

  document.addEventListener('click', (event) => {
    const insideTransferSelect = event.target.closest('.transfer-select');
    if (!insideTransferSelect) {
      closeTransferMenus();
    }
  });
}

function closeTransferMenus() {
  uiState.openTransferMenu = null;
  dom.transferFromMenu.classList.remove('is-open');
  dom.transferToMenu.classList.remove('is-open');
  dom.transferFromBtn.classList.remove('is-open');
  dom.transferToBtn.classList.remove('is-open');
}

function toggleTransferMenu(type) {
  const isSameMenu = uiState.openTransferMenu === type;
  closeTransferMenus();

  if (isSameMenu) {
    return;
  }

  uiState.openTransferMenu = type;
  if (type === 'from') {
    dom.transferFromMenu.classList.add('is-open');
    dom.transferFromBtn.classList.add('is-open');
  } else {
    dom.transferToMenu.classList.add('is-open');
    dom.transferToBtn.classList.add('is-open');
  }
}

function setupPressAnimations() {
  const pressedClass = 'is-pressing';

  document.addEventListener('pointerdown', (event) => {
    const button = event.target.closest('button');
    if (!button) {
      return;
    }
    button.classList.add(pressedClass);
  });

  const clearPressed = () => {
    document.querySelectorAll(`.${pressedClass}`).forEach((button) => {
      button.classList.remove(pressedClass);
    });
  };

  document.addEventListener('pointerup', clearPressed);
  document.addEventListener('pointercancel', clearPressed);
}

function setupParallaxBackground() {
  const root = document.documentElement;
  const setParallax = (xRatio, yRatio) => {
    root.style.setProperty('--parallax-x', `${xRatio.toFixed(4)}`);
    root.style.setProperty('--parallax-y', `${yRatio.toFixed(4)}`);
  };

  const resetParallax = () => setParallax(0, 0);
  resetParallax();

  window.addEventListener('pointermove', (event) => {
    const x = (event.clientX / window.innerWidth - 0.5) * 2;
    const y = (event.clientY / window.innerHeight - 0.5) * 2;
    setParallax(x, y);
  });

  window.addEventListener('pointerleave', resetParallax);
  window.addEventListener('blur', resetParallax);
}

function render() {
  renderPlayerSelector();
  renderActivePlayer();
  renderTransferSelectors();
  renderHistory();
  renderSummaryBoard();
  maybeAnnounceLeaderChange();
}

function hydrateState() {
  const stored = loadState();
  if (stored) {
    replaceState(stored);
  }
}

function initialize() {
  hydrateState();
  setupEvents();
  setupPressAnimations();
  setupParallaxBackground();
  renderSetupPlayers();
  render();

  dom.setupModal.classList.toggle('is-open', !isGameStarted());
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {
      notify('Não foi possível ativar o modo offline.', 'error');
    });
  });
}

initialize();
