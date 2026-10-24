# 📦 AgenteEstoque WMS - Software Operacional de Armazém e Logística

Software completo de gestão operacional de armazém, localização de produtos, controle de estoque e auditoria com Assistente de IA integrado, concebido a partir das diretrizes de **Operações de Armazém**.

---

## 🚀 Como Iniciar o Software

### 1. Iniciar o Servidor
No diretório do projeto (`agente-estoque`):

```bash
npm start
```
*(ou `node server.js`)*

O sistema inicializa o banco de dados SQLite local (`estoque.db`), aplica a carga inicial com dados operacionais e disponibiliza o software na porta padrão:

🔗 **Acesse no navegador:** [http://localhost:3000](http://localhost:3000)

---

## 🌟 Principais Funcionalidades

### 1. 📊 Dashboard Operacional em Tempo Real
- Indicadores chaves (KPIs):
  - **SKUs Ativos**
  - **Saldo Total em Peças**
  - **Estoque Zerado (🛑)** com clique direto para visualização
  - **Estoque Crítico (⚠️)** com itens abaixo do ponto de reposição
  - **Taxa de Acuracidade do Galpão (%)**
- Gráfico de ocupação por categoria de produtos.
- Tabela resumida das últimas movimentações e auditorias.

### 2. 🔍 Consulta e Localização Estruturada (WMS)
- Busca unificada e instantânea por:
  - **SKU / Código Interno** (ex: `FIT-3M-PR`, `SKU-001`)
  - **Código de Barras / EAN** (ex: `7891122334455`)
  - **Nome ou Descrição Comercial** (ex: `fita isolante`, `luva nitrílica`)
- Endereço estruturado exibido no padrão normatizado:  
  `[Galpão]-[Corredor]-[Rack]-[Nível]-[Prateleira]` (Ex: `G1-B-04-N2-PA`)
- **Multi-endereçamento em destaque:**
  - Separação clara de saldos entre **Área de Picking** e **Pulmão / Sobrerrack** (ex: item `SKU-9920` com 120 un no picking e 500 un no pulmão, somando 620 un totais).
- **Mapa Esquemático do Galpão:**
  - Clique em "Mapa" para abrir visualização interativa com destaque do corredor e prateleira.

### 3. 📋 Módulo de Inventário e Contagem Física
- Tabela de conferência instantânea:
  - `SKU | Descrição | Endereço | Qtd. Sistema | Qtd. Contada | Divergência | Status | Ação`
- Filtros por Galpão (`G1`, `G2`) e por Corredor (`A`, `B`, `C02`, `C03`, `Pulmão`).
- Cálculo em tempo real da divergência conforme o operador digita a contagem física.
- **Regra Fundamental de Segurança Operacional:**
  - *Nenhum saldo é alterado sem confirmação explícita.*
  - Ao clicar em "Ajustar", o sistema exibe um modal detalhando Produto, Endereço, Saldo Anterior, Nova Quantidade e Variação (Delta), registrando auditoria imutável com data, hora e operador.

### 4. 🔄 Transferências e Auditoria Completa
- Transferência assistida entre locais (ex: reabastecimento de picking a partir do pulmão).
- Validação automática de saldo disponível na origem.
- Histórico completo de auditoria com filtros por tipo (`ENTRADA`, `TRANSFERENCIA`, `AJUSTE_INVENTARIO`).
- Exportação de dados do armazém em formato CSV.

### 5. 🤖 Assistente Virtual Operacional (Chat Inteligente)
Chat inteligente integrado à interface, configurado com a persona operacional de piso de fábrica:
- **Respostas Diretas e Padronizadas:** Utiliza códigos em negrito e cita fontes de dados.
- **Detecção de Divergências em Linguagem Natural:**
  - Exemplo: *"Contei a caixa organizadora no endereço G2-C03-N1 e tem 15 unidades, mas o sistema marca 20."*
  - O assistente calcula a divergência de **-5 unidades** e gera um botão de confirmação com 1 clique direto na janela do chat!
- **Cenários Cobertos:**
  - Localização simples (Fita Isolante 3M).
  - Multi-endereço (Luva Nitrílica SKU-9920).
  - Produto não encontrado com orientação de busca em Doca/Recebimento ou Triagem.
  - Alertas de itens zerados e estoque crítico.

### 6. 📱 Simulador de Leitor de Código de Barras
- Botão "Bipar Código" para simular leitores ópticos de coletores de dados (Honeywell, Zebra ou smartphones), com retorno sonoro (bip) e busca imediata.

---

## 🛠️ Tecnologias Utilizadas

- **Backend:** Node.js (v24), Express.js, CORS, Multer.
- **Banco de Dados:** SQLite nativo (`node:sqlite`) em arquivo persistente (`estoque.db`).
- **Frontend:** HTML5, Tailwind CSS, Lucide Icons, Vanilla JavaScript reativo.
- **Arquitetura:** Single-Page Application (SPA) RESTful sem build complexo, com carregamento instantâneo.

---

## 🧪 Como Executar os Testes

Execute a suíte de testes de conformidade operacional:

```bash
node test-server.js
```
Todos os cenários de teste são validados automaticamente contra o banco de dados SQLite.

