-- Auditoria de segurança — Fase 2 (docs/auditoria-seguranca-2026-10.md)
-- EXECUTADO em 10/out/2026 via mcp__Supabase__execute_sql (projeto KyraOne,
-- eqzqrwbtibelafvzvbfb), validado logo em seguida (ver documento da
-- auditoria). Mantido aqui só como registro/histórico — já rodou.

-- ── Item 1/2: bloqueia auto-promoção de role via REST direta ──
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Não autorizado a alterar role.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_role();

ALTER POLICY profiles_update_own ON public.profiles
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- ── Item 3: revoga EXECUTE das funções SECURITY DEFINER expostas via RPC ──
-- (PUBLIC precisa ser revogado também — anon/authenticated herdam dele)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_profile_role() FROM PUBLIC, anon, authenticated;

-- ── Item 7: CHECK de formato do CPF ──
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_cpf_format CHECK (cpf IS NULL OR cpf ~ '^[0-9]{11}$');

-- ── Item 8a: wrap de auth.uid() em (select ...) — performance das policies ──
ALTER POLICY select_own_account_balance ON public.account_balance USING ((select auth.uid()) = user_id);
ALTER POLICY insert_own_account_balance ON public.account_balance WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY update_own_account_balance ON public.account_balance USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY delete_own_account_balance ON public.account_balance USING ((select auth.uid()) = user_id);
ALTER POLICY assinaturas_select_own ON public.assinaturas USING ((select auth.uid()) = profile_id);
ALTER POLICY bud_select ON public.budgets USING ((select auth.uid()) = user_id);
ALTER POLICY bud_insert ON public.budgets WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY bud_update ON public.budgets USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY bud_delete ON public.budgets USING ((select auth.uid()) = user_id);
ALTER POLICY cexp_select ON public.card_expenses USING ((select auth.uid()) = user_id);
ALTER POLICY cexp_insert ON public.card_expenses WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY cexp_update ON public.card_expenses USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY cexp_delete ON public.card_expenses USING ((select auth.uid()) = user_id);
ALTER POLICY cinst_select ON public.card_installments USING ((select auth.uid()) = user_id);
ALTER POLICY cinst_insert ON public.card_installments WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY cinst_update ON public.card_installments USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY cinst_delete ON public.card_installments USING ((select auth.uid()) = user_id);
ALTER POLICY cat_select ON public.categories USING ((select auth.uid()) = user_id);
ALTER POLICY cat_insert ON public.categories WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY cat_update ON public.categories USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY cat_delete ON public.categories USING ((select auth.uid()) = user_id);
ALTER POLICY card_select ON public.credit_cards USING ((select auth.uid()) = user_id);
ALTER POLICY card_insert ON public.credit_cards WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY card_update ON public.credit_cards USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY card_delete ON public.credit_cards USING ((select auth.uid()) = user_id);
ALTER POLICY contrib_select ON public.goal_contributions USING ((select auth.uid()) = user_id);
ALTER POLICY contrib_insert ON public.goal_contributions WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY contrib_update ON public.goal_contributions USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY contrib_delete ON public.goal_contributions USING ((select auth.uid()) = user_id);
ALTER POLICY goal_select ON public.goals USING ((select auth.uid()) = user_id);
ALTER POLICY goal_insert ON public.goals WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY goal_update ON public.goals USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY goal_delete ON public.goals USING ((select auth.uid()) = user_id);
ALTER POLICY inv_select ON public.invoices USING ((select auth.uid()) = user_id);
ALTER POLICY inv_insert ON public.invoices WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY inv_update ON public.invoices USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY inv_delete ON public.invoices USING ((select auth.uid()) = user_id);
ALTER POLICY profiles_select_own ON public.profiles USING ((select auth.uid()) = id);
ALTER POLICY profiles_insert_own ON public.profiles WITH CHECK ((select auth.uid()) = id);
ALTER POLICY trx_select ON public.transactions USING ((select auth.uid()) = user_id);
ALTER POLICY trx_insert ON public.transactions WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY trx_update ON public.transactions USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY trx_delete ON public.transactions USING ((select auth.uid()) = user_id);

-- ── Item 8b: índices de cobertura nas FKs sem índice ──
CREATE INDEX IF NOT EXISTS idx_card_expenses_card_id ON public.card_expenses(card_id);
CREATE INDEX IF NOT EXISTS idx_card_expenses_invoice_id ON public.card_expenses(invoice_id);
CREATE INDEX IF NOT EXISTS idx_card_installments_card_id ON public.card_installments(card_id);
CREATE INDEX IF NOT EXISTS idx_card_installments_invoice_id ON public.card_installments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_card_installments_parent_expense_id ON public.card_installments(parent_expense_id);
CREATE INDEX IF NOT EXISTS idx_goal_contributions_goal_id ON public.goal_contributions(goal_id);
CREATE INDEX IF NOT EXISTS idx_invoices_card_id ON public.invoices(card_id);
CREATE INDEX IF NOT EXISTS idx_invoices_transaction_id ON public.invoices(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transactions_card_id ON public.transactions(card_id);
