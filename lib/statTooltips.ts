/**
 * Tooltips ⓘ exibidos ao lado dos títulos de aspectos/stats.
 * Chave = label do aspecto (como vem nos dados) ou título exibido.
 */
export const STAT_TOOLTIPS: Record<string, string> = {
  "Eficiência Defensiva":
    "Agrupa três leituras do impacto defensivo: Erros Totais (quanto menos, melhor), Ações sem Bola/90 (duelos vencidos + recuperações + interceptações + rebatidas + chutes bloqueados) e o Índice de Eficiência (saldo entre ações e custos com shrinkage por minutagem). Selo só quando as três ficam acima da média.",
  "Índice de Eficiência":
    "Saldo defensivo do atleta: duelos vencidos, interceptações, rebatidas e chutes bloqueados/90 menos faltas e duelos perdidos/90 (excluindo os que viraram falta, para não contar duas vezes), com shrinkage por minutagem e z-scores winsorizados. Positivo = acima da média; negativo = abaixo.",
  "Ações sem Bola/90":
    "Soma por 90 minutos de duelos defensivos vencidos, recuperações de bola, interceptações, rebatidas e chutes bloqueados.",
  Recuperações:
    "Bolas recuperadas por 90 minutos: posse retomada após disputa, segunda bola ou bola solta.",
  "Passes Criativos":
    "Soma de Passes em Profundidade/90 + Passes Inteligentes/90 (through balls e smart passes): bolas que quebram linhas e criam chances de finalização.",
};
