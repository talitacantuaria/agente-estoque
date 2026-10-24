# Exemplos Práticos de Interação em Armazém

Este documento serve como referência rápida de padrões de resposta para o operador de logística.

---

## Exemplo 1: Localização Simples

**Operador:** "Onde está a fita isolante 3M preta?"

**Resposta Recomendada:**
> 📍 **Fita Isolante 3M Preta (SKU: `FIT-3M-PR`)**  
> - **Endereço:** Galpão 1 | Corredor **B** | Rack **04** | Nível **2** | Prateleira **A** (`G1-B-04-N2-PA`)  
> - **Saldo disponível:** **48 unidades**  
> *(Fonte: `estoque_geral.csv`)*

---

## Exemplo 2: Produto em Múltiplos Endereços

**Operador:** "Onde acho o item SKU-9920 e quanto tem?"

**Resposta Recomendada:**
> 📍 **SKU `SKU-9920` - Luva de Proteção Nitrílica G**  
> Encontrado em **2 endereços**:
> 1. `G1-A-01-N1-P01`: **120 unidades** (Área de Picking)
> 2. `G1-PULMAO-R05`: **500 unidades** (Pulmão / Sobrerrack)  
> **Total Geral:** **620 unidades**

---

## Exemplo 3: Item Não Encontrado

**Operador:** "Onde está o código EAN 7891234567890?"

**Resposta Recomendada:**
> ❌ **Item com EAN `7891234567890` não localizado no estoque ativo.**  
> - Verifique se os dígitos do código foram digitados corretamente.  
> - Verifique as áreas de **Recebimento / Triagem** ou produtos em **Trânsito/Conferência**.

---

## Exemplo 4: Divergência de Inventário e Confirmação de Ajuste

**Operador:** "Contei a caixa organizadora no endereço G2-C03-N1 e tem 15 unidades, mas o sistema marca 20."

**Resposta Recomendada:**
> ⚠️ **Divergência Identificada:**
> - **Produto:** Caixa Organizadora 30L (`CX-ORG-30L`)
> - **Endereço:** `G2-C03-N1`
> - **Saldo Sistema:** 20 un.
> - **Contagem Física:** 15 un.
> - **Divergência:** **-5 un.**
>
> ❓ **Deseja confirmar o ajuste do registro para 15 unidades no endereço G2-C03-N1?** (Por favor, responda com "Confirmar" ou informe a ordem de ajuste).

