import {
  getBankId,
  getPlayerById,
  pushHistory,
  updatePlayerBalance,
} from './state.js';

function nowISO() {
  return new Date().toISOString();
}

function normalizeValue(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return null;
  }
  return Math.floor(num);
}

function makeEntry(tipo, origem, destino, valor, descricao) {
  return {
    tipo,
    origem,
    destino,
    valor,
    descricao,
    timestamp: nowISO(),
  };
}

export function receiveFromBank(destinoId, valor) {
  const amount = normalizeValue(valor);
  if (!amount) {
    throw new Error('Valor inválido.');
  }

  const destino = getPlayerById(destinoId);
  if (!destino || destino.isBank) {
    throw new Error('Jogador de destino inválido.');
  }

  const updated = updatePlayerBalance(destinoId, amount);
  if (!updated) {
    throw new Error('Não foi possível aplicar o recebimento.');
  }

  pushHistory(
    makeEntry(
      'receber',
      getBankId(),
      destinoId,
      amount,
      `${destino.nome} recebeu $${amount} do Banco`
    )
  );
}

export function payToBank(origemId, valor) {
  const amount = normalizeValue(valor);
  if (!amount) {
    throw new Error('Valor inválido.');
  }

  const origem = getPlayerById(origemId);
  if (!origem || origem.isBank) {
    throw new Error('Jogador de origem inválido.');
  }

  const updated = updatePlayerBalance(origemId, -amount);
  if (!updated) {
    throw new Error('Saldo insuficiente.');
  }

  pushHistory(
    makeEntry(
      'pagar',
      origemId,
      getBankId(),
      amount,
      `${origem.nome} pagou $${amount} ao Banco`
    )
  );
}

export function transferBetweenPlayers(origemId, destinoId, valor) {
  const amount = normalizeValue(valor);
  if (!amount) {
    throw new Error('Valor inválido.');
  }

  if (origemId === destinoId) {
    throw new Error('Origem e destino devem ser diferentes.');
  }

  const origem = getPlayerById(origemId);
  const destino = getPlayerById(destinoId);

  if (!origem || !destino) {
    throw new Error('Jogadores inválidos.');
  }

  const saiuOrigem = origem.isBank ? true : updatePlayerBalance(origemId, -amount);
  if (!saiuOrigem) {
    throw new Error('Saldo insuficiente.');
  }

  const entrouDestino = destino.isBank ? true : updatePlayerBalance(destinoId, amount);
  if (!entrouDestino) {
    if (!origem.isBank) {
      updatePlayerBalance(origemId, amount);
    }
    throw new Error('Não foi possível concluir a transferência.');
  }

  pushHistory(
    makeEntry(
      'transferencia',
      origemId,
      destinoId,
      amount,
      `${origem.nome} → ${destino.nome} $${amount}`
    )
  );
}
