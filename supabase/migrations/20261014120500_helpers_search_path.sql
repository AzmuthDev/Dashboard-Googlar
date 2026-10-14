-- Fixa search_path dos helpers (advisor function_search_path_mutable).
alter function public._mesas_cliente() set search_path = public;
alter function public._acao_de_opcao(text) set search_path = public;
