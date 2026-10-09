import { createFileRoute } from "@tanstack/react-router";
import { LegalPageLayout, Section, P, Ul } from "@/components/legal/legal-page-layout";
import {
  EMPRESA_RAZAO_SOCIAL,
  EMPRESA_CNPJ,
  EMPRESA_CIDADE_UF,
  EMPRESA_EMAIL_CONTATO,
} from "@/lib/constants";

export const Route = createFileRoute("/privacidade")({
  component: PrivacidadePage,
});

function PrivacidadePage() {
  return (
    <LegalPageLayout titulo="Política de Privacidade" atualizadoEm="9 de outubro de 2026">
      <Section title="1. Quem trata seus dados">
        <P>
          Esta Política de Privacidade explica como <strong>{EMPRESA_RAZAO_SOCIAL}</strong> (CNPJ{" "}
          {EMPRESA_CNPJ}, sede em {EMPRESA_CIDADE_UF}), responsável pelo KyraOne, coleta, usa e
          protege seus dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (Lei nº
          13.709/2018 — LGPD).
        </P>
        <P>
          Pra qualquer assunto relacionado aos seus dados pessoais — dúvidas, solicitações ou
          reclamações — fala com a gente em{" "}
          <a
            href={`mailto:${EMPRESA_EMAIL_CONTATO}`}
            className="font-medium text-primary hover:underline"
          >
            {EMPRESA_EMAIL_CONTATO}
          </a>
          .
        </P>
      </Section>

      <Section title="2. Quais dados coletamos">
        <P>Coletamos os dados que você mesmo informa ao usar o KyraOne:</P>
        <Ul>
          <li>
            <strong>Cadastro:</strong> nome, e-mail e senha (armazenada de forma criptografada,
            nunca em texto puro);
          </li>
          <li>
            <strong>Perfil e cobrança:</strong> CPF e número de WhatsApp, quando você opta por
            assinar um plano pago ou vincular seu WhatsApp à Kyra;
          </li>
          <li>
            <strong>Dados financeiros:</strong> transações, categorias, cartões de crédito, faturas,
            metas e orçamentos que você cadastra manualmente ou relata por mensagem no WhatsApp;
          </li>
          <li>
            <strong>Mensagens do WhatsApp:</strong> o conteúdo das mensagens trocadas com a Kyra,
            usado exclusivamente pra extrair e registrar as despesas e receitas que você reporta;
          </li>
          <li>
            <strong>Dados técnicos:</strong> informações de acesso (data/hora de login, tipo de
            dispositivo) usadas pra segurança e diagnóstico de problemas.
          </li>
        </Ul>
        <P>
          Não coletamos dados sensíveis (saúde, biometria, origem racial, orientação sexual,
          convicções religiosas ou políticas) e não há motivo pra você nos informar isso.
        </P>
      </Section>

      <Section title="3. Para que usamos seus dados">
        <Ul>
          <li>Criar e manter sua conta, e autenticar seu acesso;</li>
          <li>Processar e exibir suas informações financeiras dentro do app;</li>
          <li>Processar sua assinatura e cobranças (via nosso parceiro de pagamentos);</li>
          <li>Interpretar e registrar despesas/receitas relatadas por você via WhatsApp;</li>
          <li>
            Enviar e-mails relacionados à sua conta — confirmação de cadastro, recuperação de senha,
            avisos sobre sua assinatura ou período de teste. Não enviamos e-mails de marketing ou
            newsletter sem o seu consentimento prévio e específico;
          </li>
          <li>
            Cumprir obrigações legais e responder a autoridades competentes, quando exigido por lei.
          </li>
        </Ul>
        <P>
          A base legal pra esse tratamento é a <strong>execução do contrato</strong> que você firma
          ao criar uma conta e aceitar estes termos (art. 7º, V, da LGPD), e o{" "}
          <strong>cumprimento de obrigação legal ou regulatória</strong> quando aplicável.
        </P>
      </Section>

      <Section title="4. Com quem compartilhamos seus dados">
        <P>
          Não vendemos seus dados pessoais. Compartilhamos dados apenas com prestadores de serviço
          estritamente necessários pra operar o KyraOne (nossos operadores de dados, nos termos da
          LGPD):
        </P>
        <Ul>
          <li>
            <strong>Supabase</strong> — banco de dados e autenticação, infraestrutura AWS na região
            sa-east-1 (São Paulo, Brasil);
          </li>
          <li>
            <strong>Vercel</strong> — hospedagem do aplicativo web;
          </li>
          <li>
            <strong>Asaas</strong> — processamento de pagamentos (recebe CPF, nome e e-mail para
            emissão de cobranças);
          </li>
          <li>
            <strong>Meta (WhatsApp Cloud API)</strong> — envio e recebimento de mensagens quando
            você usa a Kyra pelo WhatsApp;
          </li>
          <li>Servidor próprio (VPS) usado para orquestrar a integração com o WhatsApp.</li>
        </Ul>
        <P>
          Esses parceiros só recebem os dados estritamente necessários pra prestar o serviço
          contratado, e têm suas próprias políticas de privacidade.
        </P>
      </Section>

      <Section title="5. Cookies">
        <P>
          Hoje o KyraOne usa apenas cookies e armazenamento local{" "}
          <strong>estritamente necessários</strong> pro funcionamento do app — manter sua sessão de
          login ativa e lembrar preferências de exibição. Não usamos, atualmente, cookies de
          rastreamento, publicidade ou ferramentas de análise de terceiros (como Google Analytics ou
          Meta Pixel).
        </P>
        <P>
          Se no futuro passarmos a usar cookies de análise ou publicidade, vamos atualizar esta
          política e pedir seu consentimento antes de ativá-los, conforme exige a LGPD.
        </P>
      </Section>

      <Section title="6. Por quanto tempo guardamos seus dados">
        <P>
          Guardamos seus dados enquanto sua conta estiver ativa. Você pode excluir sua conta e todos
          os seus dados a qualquer momento, diretamente no app (Mais → Excluir conta) — a exclusão é
          imediata e definitiva. Dados que a lei exige que guardemos por mais tempo (como registros
          fiscais de cobranças já realizadas) são mantidos apenas pelo prazo legal exigido, de forma
          isolada do restante da sua conta.
        </P>
      </Section>

      <Section title="7. Seus direitos (LGPD)">
        <P>Como titular dos dados, você tem direito a:</P>
        <Ul>
          <li>Confirmar se tratamos seus dados, e acessá-los;</li>
          <li>Corrigir dados incompletos, inexatos ou desatualizados;</li>
          <li>
            Solicitar a exclusão dos seus dados — o que você pode fazer diretamente no app, a
            qualquer momento;
          </li>
          <li>Solicitar a portabilidade dos seus dados a outro fornecedor;</li>
          <li>Revogar seu consentimento, quando o tratamento depender dele;</li>
          <li>Ser informado sobre com quem compartilhamos seus dados;</li>
          <li>Pedir a revisão de decisões automatizadas que te afetem.</li>
        </Ul>
        <P>
          Pra exercer qualquer um desses direitos, escreva pra{" "}
          <a
            href={`mailto:${EMPRESA_EMAIL_CONTATO}`}
            className="font-medium text-primary hover:underline"
          >
            {EMPRESA_EMAIL_CONTATO}
          </a>
          . Respondemos em até 15 dias.
        </P>
      </Section>

      <Section title="8. Segurança">
        <P>
          Usamos práticas de mercado pra proteger seus dados: senhas criptografadas, conexões HTTPS,
          controle de acesso por linha (cada usuário só acessa os próprios dados, reforçado por
          regras de segurança no banco de dados), e acesso restrito da nossa equipe a dados de
          produção.
        </P>
      </Section>

      <Section title="9. Alterações nesta política">
        <P>
          Podemos atualizar esta Política de Privacidade de tempos em tempos. Mudanças relevantes
          serão comunicadas por e-mail ou dentro do próprio app, com a data de atualização sempre
          visível no topo desta página.
        </P>
      </Section>

      <Section title="10. Contato e encarregado de dados">
        <P>
          Pra qualquer dúvida, solicitação ou reclamação sobre o tratamento dos seus dados pessoais,
          entre em contato em{" "}
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
