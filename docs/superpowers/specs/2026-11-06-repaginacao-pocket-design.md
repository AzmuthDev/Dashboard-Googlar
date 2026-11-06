# Repaginação do Pocket — design aprovado (06/11/2026)

## Objetivo
Deixar o Pocket com cara de produto Googlar (não "simples"), usando a marca nova,
com números reais no Dashboard e os bugs de layout corrigidos. Primeira entrega:
base visual + shell + Dashboard + Triagem. Segunda entrega: Empresas, Planejador,
Áudios LSA e Acessos (herdam a base, sem redesenho próprio ainda).

## Decisões do usuário
- Paleta: grafite + verde da marca (#3DF2A0 como único destaque).
- Escopo: shell + Dashboard + Triagem primeiro.
- Métricas: trocar números inventados por métricas reais.

## Base visual
- Tokens em `src/index.css`: fundo `#0E0F12`, cards `#15161A`, texto `#F4F4F5`,
  destaque `#3DF2A0`; status vermelho/âmbar/violeta suaves. Tema claro equivalente
  com verde escuro `#0B8A55` para contraste.
- Fontes: Unbounded (títulos e números), Inter (corpo).
- `@custom-variant dark` ligado à classe `.dark` (antes seguia o tema do SO).
- Ant Design configurado pelo `ConfigProvider` (algoritmo escuro + tokens da marca),
  com os overrides globais `!important` reduzidos.

## Shell
- Sidebar em seções (Visão geral, Auditoria, Admin), item ativo com traço verde,
  badge de dúvidas pendentes na Triagem, estado recolhido salvo no navegador,
  cadeado consistente com a regra de acesso.
- Busca rápida Ctrl+K: páginas e troca de empresa.
- Cabeçalho em uma linha: Empresa / Página, seletor de empresa, sincronizar, tema.

## Dashboard
- KPIs reais: Economia (custo dos negativados), Termos auditados (+ campanhas),
  Conversões (soma), % Triado (com barra).
- Remove tendências fixas, "Novos leads B2B", "Acurácia IA" e o carrossel de fotos.
- "Fila de triagem": barra por status + atalho para as dúvidas.

## Triagem
- Busca dentro da página filtrando termo, palavra-chave, campanha e grupo.
- Abas como controle segmentado com contagens coloridas.
- Lógica de triagem, envio, exportação, importação e limpeza inalterada.

## Testes
- Funções puras `src/utils/dashboardMetrics.ts` e `src/utils/termSearch.ts` com
  testes `node --test`.
- `npm test`, `npm run build`, verificação no navegador (dois temas, desktop e mobile).
