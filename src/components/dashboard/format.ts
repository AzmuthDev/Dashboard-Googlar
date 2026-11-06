const brlFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const intFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const decFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

export const formatBRL = (n: number) => brlFmt.format(Number.isFinite(n) ? n : 0);
export const formatInt = (n: number) => intFmt.format(Math.round(Number.isFinite(n) ? n : 0));
export const formatDec = (n: number) => decFmt.format(Number.isFinite(n) ? n : 0);
export const formatPct = (n: number) => `${Math.round(Number.isFinite(n) ? n : 0)}%`;
