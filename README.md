# Banco Imobiliário Digital

Web App estático para substituir dinheiro físico e maquininha no Banco Imobiliário, com uso em **um único dispositivo compartilhado** (tablet/celular no centro da mesa).

## Objetivo

- Controlar saldo dos jogadores
- Fazer recebimentos, pagamentos e transferências
- Manter histórico de transações
- Funcionar offline como PWA
- Publicar facilmente no GitHub Pages

## Stack

- HTML5
- CSS3
- JavaScript puro (sem framework)
- PWA (`manifest.json` + `service-worker.js`)
- Persistência em `localStorage`

## Restrições do projeto

- Sem backend
- Sem login/contas
- Sem QR Code
- Sem multiplayer em rede
- Tudo client-side

## Funcionalidades

- Criação de partida com jogadores e saldo inicial
- Banco com saldo infinito (interno ao sistema)
- Receber do banco e pagar ao banco
- Transferência entre jogadores
- Histórico automático com destaque por tipo
- Configurações da partida:
  - Renomear jogador
  - Trocar cor
  - Trocar avatar (emoji)
  - Adicionar/remover jogadores
  - Resetar partida
- Hall da Fortuna (ranking animado)
- Rolagem de 2 dados com efeitos visuais/sonoros
- Persistência automática do estado

## Estrutura do projeto

```text
/
├─ index.html
├─ manifest.json
├─ service-worker.js
├─ README.md
├─ css/
│  └─ style.css
├─ js/
│  ├─ state.js
│  ├─ ui.js
│  ├─ transactions.js
│  ├─ storage.js
│  └─ sound.js
└─ assets/
   ├─ icons/
   │  ├─ icon-192.svg
   │  └─ icon-512.svg
   └─ sounds/
      └─ README.md
```

## Como executar localmente

Como usa `service-worker`, rode com servidor local (não via `file://`).

Exemplos:

```bash
# Python
python3 -m http.server 5500

# Node (se tiver npx)
npx serve .
```

Depois abra:

- `http://localhost:5500`

## Armazenamento

- Estado salvo em `localStorage` com chave:
  - `banco-imobiliario-state-v1`