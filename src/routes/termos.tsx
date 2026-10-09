import { createFileRoute } from "@tanstack/react-router";
import { LegalPageLayout, Section, P, Ul } from "@/components/legal/legal-page-layout";
import {
  EMPRESA_RAZAO_SOCIAL,
  EMPRESA_CNPJ,
  EMPRESA_CIDADE_UF,
  EMPRESA_EMAIL_CONTATO,
} from "@/lib/constants";

export const Route = createFileRoute("/termos")({
  component: TermosPage,
});

function TermosPage() {
  return (
    <LegalPageLayout titulo="Termos de Uso" atualizadoEm="9 de outubro de 2026">
      <Section title="1. Quem somos">
        <P>
          O KyraOne é um aplicativo de finanças pessoais operado por{" "}
          <strong>{EMPRESA_RAZAO_SOCIAL}</strong>, inscrita no CNPJ sob o nº {EMPRESA_CNPJ}, com
          sede em {EMPRESA_CIDADE_UF}, Brasil. Ao criar uma conta ou usar o KyraOne, você concorda
          com estes Termos de Uso e com nossa{" "}
          <a href="/privacidade" className="font-medium text-primary hover:underline">
            Política de Privacidade
          </a>
          .
        </P>
      </Section>

      <Section title="2. O que é o KyraOne">
        <P>
          O KyraOne é uma ferramenta de organização financeira pessoal: controle de receitas e
          despesas, categorias, cartões de crédito e faturas, metas e orçamentos, e o registro de
          despesas por conversa no WhatsApp através da nossa assistente, a Kyra. O KyraOne não é uma
          instituição financeira, não realiza pagamentos, transferências ou movimentações bancárias
          reais — é uma ferramenta de controle e organização dos dados que você mesmo informa.
        </P>
      </Section>

      <Section title="3. Cadastro e conta">
        <P>
          Pra usar o KyraOne, você precisa criar uma conta com nome, e-mail e senha. Você é
          responsável por manter a confidencialidade da sua senha e por tudo que acontece na sua
          conta. Avise a gente imediatamente ({EMPRESA_EMAIL_CONTATO}) se desconfiar de acesso não
          autorizado.
        </P>
        <P>
          Você precisa ter pelo menos 18 anos, ou ser maior de idade segundo a lei do seu país, pra
          criar uma conta.
        </P>
      </Section>

      <Section title="4. Período de teste e planos">
        <P>
          Todo cadastro novo começa com 14 dias de teste gratuito, com acesso completo ao plano Kyra
          One Pro, sem necessidade de cartão de crédito ou Pix. Depois do período de teste, pra
          continuar usando o KyraOne é preciso assinar um dos planos pagos disponíveis na tela
          "Assinar" dentro do app. Os valores vigentes são sempre os exibidos nessa tela no momento
          da contratação.
        </P>
        <P>
          As cobranças são processadas por um parceiro de pagamentos (Asaas), via Pix ou cartão de
          crédito, em ciclo mensal. Você pode cancelar sua assinatura a qualquer momento dentro do
          app, o que interrompe cobranças futuras — o acesso aos recursos pagos continua até o fim
          do período já pago.
        </P>
      </Section>

      <Section title="5. Exclusão de conta">
        <P>
          Você pode excluir sua conta e todos os seus dados a qualquer momento, diretamente no app
          (Mais → Excluir conta). A exclusão é definitiva e imediata: apaga seus dados pessoais e
          financeiros cadastrados e cancela qualquer assinatura ativa. Não é possível desfazer essa
          ação nem recuperar os dados depois.
        </P>
      </Section>

      <Section title="6. Uso aceitável">
        <P>Ao usar o KyraOne, você concorda em não:</P>
        <Ul>
          <li>Usar o serviço para fins ilegais ou fraudulentos;</li>
          <li>Tentar acessar contas de outras pessoas ou burlar mecanismos de segurança;</li>
          <li>Fazer engenharia reversa, copiar ou reproduzir o app sem autorização;</li>
          <li>
            Sobrecarregar ou tentar comprometer a infraestrutura do serviço (incluindo a integração
            via WhatsApp).
          </li>
        </Ul>
      </Section>

      <Section title="7. Seus dados, suas decisões">
        <P>
          O KyraOne registra exatamente as informações que você fornece (manualmente ou por mensagem
          no WhatsApp). Não oferecemos aconselhamento financeiro, de investimento ou tributário — as
          funcionalidades do app servem pra organização e visualização dos seus próprios dados.
        </P>
      </Section>

      <Section title="8. Disponibilidade do serviço">
        <P>
          Fazemos o possível pra manter o KyraOne disponível, mas não garantimos operação
          ininterrupta ou livre de falhas. Podemos, eventualmente, pausar o serviço para manutenção,
          com aviso prévio quando possível.
        </P>
      </Section>

      <Section title="9. Alterações nestes termos">
        <P>
          Podemos atualizar estes Termos de Uso de tempos em tempos. Mudanças relevantes serão
          comunicadas por e-mail ou dentro do próprio app. O uso contínuo do KyraOne depois de uma
          atualização representa sua concordância com os novos termos.
        </P>
      </Section>

      <Section title="10. Contato">
        <P>
          Dúvidas sobre estes Termos de Uso? Fala com a gente em{" "}
          <a
            href={`mailto:${EMPRESA_EMAIL_CONTATO}`}
            className="font-medium text-primary hover:underline"
          >
            {EMPRESA_EMAIL_CONTATO}
          </a>
          .
        </P>
      </Section>
    </LegalPageLayout>
  );
}
