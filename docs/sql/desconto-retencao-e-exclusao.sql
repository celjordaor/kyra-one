-- Migration: desconto de retenção na exclusão de conta.
-- Rodar manualmente no SQL Editor do Supabase (projeto eqzqrwbtibelafvzvbfb).
--
-- Quando um assinante ativo tenta excluir a conta, o app oferece um desconto
-- permanente pra ele ficar (29,90 -> 19,90 no Controle, 49,90 -> 29,90 no
-- Pro). Se aceitar, o valor é atualizado direto no Asaas e registrado aqui
-- pra refletir no app (tela /assinar e /perfil).
--
-- Aditiva, default NULL — não quebra nada em quem nunca usou o fluxo.

ALTER TABLE public.assinaturas
  ADD COLUMN IF NOT EXISTS valor_desconto numeric(10,2) NULL,
  ADD COLUMN IF NOT EXISTS desconto_retencao_em timestamptz NULL;

COMMENT ON COLUMN public.assinaturas.valor_desconto IS
  'Valor mensal com desconto de retenção aplicado (permanente), quando o assinante aceitou a oferta ao tentar excluir a conta. NULL = sem desconto, paga o valor cheio do plano.';
COMMENT ON COLUMN public.assinaturas.desconto_retencao_em IS
  'Data/hora em que o desconto de retenção foi aceito e aplicado no Asaas.';
