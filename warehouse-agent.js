// warehouse-agent.js
// Motor de Inteligência Operacional do Armazém baseado na Skill operacoes-armazem

const { db } = require('./database');

class WarehouseAgent {
  /**
   * Processa a mensagem do operador e retorna resposta formatada + ações interativas se houver
   * @param {string} userMessage 
   * @returns {Promise<{ text: string, action?: any, suggestions?: string[] }>}
   */
  async processMessage(userMessage) {
    const raw = (userMessage || '').trim();
    const query = raw.toLowerCase();

    if (!raw) {
      return {
        text: 'Por favor, digite o nome do produto, SKU, código de barras (EAN), endereço ou contagem física para pesquisar.',
        suggestions: ['Onde está a fita isolante 3M preta?', 'Onde acho o item SKU-9920 e quanto tem?', 'Estoque crítico', 'Itens zerados']
      };
    }

    // 1. Verificação de Ajuda / Comandos
    if (query === 'ajuda' || query === 'help' || query === 'comandos' || query === 'o que você faz?') {
      return {
        text: `🤖 **Assistente de Armazém & WMS - Comandos Disponíveis:**\n\n` +
          `• **Localização:** "Onde está a fita isolante?", "Localizar SKU-9920", "EAN 7891122334455"\n` +
          `• **Saldo & Multi-endereço:** "Quanto tem de luva nitrílica?", "Saldo SKU-001"\n` +
          `• **Auditoria & Contagem:** "Contei a caixa organizadora no endereço G2-C03-N1 e tem 15 unidades, mas o sistema marca 20"\n` +
          `• **Consultas Rápidas:** "Itens zerados", "Estoque crítico", "O que tem no corredor B?"\n` +
          `• **Transferência:** "Transferir 50 un de SKU-9920 do Pulmão para Picking"`,
        suggestions: ['Onde está a fita isolante 3M preta?', 'Onde acho o item SKU-9920 e quanto tem?', 'Ver itens zerados', 'Ver estoque crítico']
      };
    }

    // 1.1 Sugestão de Kits e Requisições Corporativas (Portal do Colaborador)
    if (query.includes('kit') || query.includes('visita') || query.includes('fábrica') || query.includes('fabrica') || query.includes('reparo') || query.includes('organizar')) {
      if (query.includes('epi') || query.includes('visita') || query.includes('fábrica') || query.includes('fabrica') || query.includes('segurança')) {
        return {
          text: `🦺 **Kit de Segurança & Visita à Fábrica Recomendado:**\n\n` +
            `1. **Luva Nitrílica Verde G** (\`SKU-9920\`) - Saldo: **620 pares** (Local: \`G1-A-01-N1-P01\`)\n` +
            `2. **Botina de Segurança Couro 42** (\`BOT-SEG-42\`) - Saldo: **18 pares** (Local: \`G1-A-03-N2-P02\`)\n\n` +
            `💡 *Você pode solicitar esses itens diretamente pelo Portal do Colaborador para retirada imediata.*`,
          suggestions: ['Onde acho o item SKU-9920 e quanto tem?', 'Onde está a fita isolante 3M preta?', 'Itens zerados']
        };
      }

      if (query.includes('elétr') || query.includes('eletr') || query.includes('reparo') || query.includes('manuten')) {
        return {
          text: `⚡ **Kit de Reparo Elétrico Rápido Recomendado:**\n\n` +
            `1. **Fita Isolante 3M Preta** (\`FIT-3M-PR\`) - Saldo: **48 un** (Local: \`G1-B-04-N2-PA\`)\n` +
            `2. **Cabo Flexível 2,5mm Azul** (\`CABO-2.5-AZ\`) - Saldo: **35 rolos** (Local: \`G1-B-03-N1-P01\`)\n` +
            `3. **Disjuntor Bipolar 32A** (\`DISJ-32A\`) - Saldo: **6 un** (Local: \`G1-B-02-N1-P03\`)\n\n` +
            `💡 *Todos os itens estão concentrados no Corredor B do Galpão 1 para retirada simplificada.*`,
          suggestions: ['Onde está a fita isolante 3M preta?', 'Ver itens zerados', 'Estoque crítico']
        };
      }
    }

    // 2. Consulta de Itens Zerados
    if (query.includes('zerado') || query.includes('sem estoque') || query.includes('saldo zero')) {
      const zerados = db.prepare(`
        SELECT p.sku, p.name, l.code as location_code, s.quantity
        FROM stock s
        JOIN products p ON s.product_id = p.id
        JOIN locations l ON s.location_id = l.id
        WHERE s.quantity = 0
      `).all();

      if (zerados.length === 0) {
        return {
          text: `✅ **Excelente! Não há nenhum item com estoque zerado no momento.** Todos os produtos possuem saldo positivo.`,
          suggestions: ['Ver estoque crítico', 'Localizar produto']
        };
      }

      let resp = `🛑 **Produtos com Estoque Zerado (${zerados.length} encontrados):**\n\n`;
      zerados.forEach(z => {
        resp += `- **${z.name}** (SKU: \`${z.sku}\`)\n  Endereço: \`${z.location_code}\` | Saldo: **0 un**\n`;
      });
      resp += `\n⚠️ *Atenção: Providencie reabastecimento ou abertura de pedido para estes SKUs.*`;
      return { text: resp, suggestions: ['Ver estoque crítico', 'Fazer inventário'] };
    }

    // 3. Consulta de Estoque Crítico / Baixo Estoque
    if (query.includes('critico') || query.includes('crítico') || query.includes('baixo estoque') || query.includes('abaixo do minimo') || query.includes('mínimo')) {
      const criticos = db.prepare(`
        SELECT p.sku, p.name, p.min_stock, SUM(s.quantity) as total_qty
        FROM products p
        LEFT JOIN stock s ON s.product_id = p.id
        GROUP BY p.id
        HAVING total_qty <= p.min_stock AND total_qty > 0
      `).all();

      if (criticos.length === 0) {
        return {
          text: `✅ **Nenhum item com estoque crítico.** Todos os itens estão acima do ponto de reposição mínimo.`,
          suggestions: ['Ver itens zerados', 'Localizar produto']
        };
      }

      let resp = `⚠️ **Itens em Nível Crítico (Abaixo do Estoque Mínimo):**\n\n`;
      criticos.forEach(c => {
        resp += `- **${c.name}** (SKU: \`${c.sku}\`)\n  Saldo Atual: **${c.total_qty} un** | Mínimo Definido: **${c.min_stock} un**\n`;
      });
      return { text: resp, suggestions: ['Ver itens zerados', 'Localizar produto'] };
    }

    // 4. Detecção de Contagem / Divergência Física de Inventário (Exemplo 4 do manual)
    const countMatch = this.detectInventoryCountIntent(raw);
    if (countMatch) {
      return this.handleInventoryDivergence(countMatch);
    }

    // 5. Consulta por Endereço específico (ex: "o que tem no endereço G1-B-04-N2-PA" ou "corredor B")
    if (query.startsWith('corredor ') || query.includes('no corredor ') || query.includes('endereço ') || query.includes('endereco ')) {
      const aisleMatch = query.match(/corredor\s+([a-z0-9_-]+)/i);
      const locMatch = query.match(/\b([gG][0-9]-[A-Za-z0-9-]+)\b/);

      if (locMatch) {
        const locCode = locMatch[1].toUpperCase();
        const items = db.prepare(`
          SELECT p.sku, p.name, l.code as location_code, s.quantity
          FROM stock s
          JOIN products p ON s.product_id = p.id
          JOIN locations l ON s.location_id = l.id
          WHERE UPPER(l.code) LIKE ?
        `).all(`%${locCode}%`);

        if (items.length === 0) {
          return {
            text: `📍 O endereço \`${locCode}\` está atualmente **vazio** ou não possui produtos alocados.`
          };
        }

        let resp = `📍 **Conteúdo do endereço \`${locCode}\`:**\n\n`;
        items.forEach(it => {
          resp += `- **${it.name}** (\`${it.sku}\`) - Saldo: **${it.quantity} un**\n`;
        });
        return { text: resp };
      }

      if (aisleMatch) {
        const aisle = aisleMatch[1].toUpperCase();
        const items = db.prepare(`
          SELECT p.sku, p.name, l.code as location_code, s.quantity
          FROM stock s
          JOIN products p ON s.product_id = p.id
          JOIN locations l ON s.location_id = l.id
          WHERE l.aisle LIKE ? OR l.code LIKE ?
        `).all(`%${aisle}%`, `%-${aisle}-%`);

        if (items.length === 0) {
          return {
            text: `📍 **Nenhum produto cadastrado no Corredor ${aisle}.** Verifique se o corredor está vazio ou se a identificação está correta.`
          };
        }

        let resp = `📍 **Itens localizados no Corredor ${aisle} (${items.length} posições):**\n\n`;
        items.forEach(it => {
          resp += `- **${it.name}** (\`${it.sku}\`)\n  Endereço: \`${it.location_code}\` | Saldo: **${it.quantity} un**\n`;
        });
        return { text: resp, suggestions: ['Iniciar inventário do corredor', 'Localizar outro item'] };
      }
    }

    // 6. Detecção especial de código EAN (dígitos numéricos de 8 a 14 números)
    const eanMatch = raw.match(/\b(\d{8,14})\b/);
    if (eanMatch) {
      const eanCandidate = eanMatch[1];
      return this.searchProductAndFormatResponse(eanCandidate, raw, true);
    }

    // 7. Consulta de Produto (SKU ou Nome/Descrição)
    const cleanSearch = query
      .replace(/onde\s+(está|esta|acho|fica|encontro)/gi, '')
      .replace(/qual\s+o\s+saldo\s+(do|da|de)/gi, '')
      .replace(/o\s+que\s+tem\s+(no|na)/gi, '')
      .replace(/quanto\s+(tem|saldo)/gi, '')
      .replace(/e\s+quanto\s+tem/gi, '')
      .replace(/\b(item|produto|código|codigo|sku|ean)\b/gi, '')
      .replace(/[?.,!]/g, '')
      .trim();

    return this.searchProductAndFormatResponse(cleanSearch, raw);
  }

  /**
   * Detecta se a mensagem é um relatório de contagem com divergência
   */
  detectInventoryCountIntent(text) {
    const lower = text.toLowerCase();
    const hasCountWord = lower.includes('contei') || lower.includes('contagem') || lower.includes('física') || lower.includes('tem apenas') || lower.includes('divergência') || lower.includes('divergencia');
    if (!hasCountWord) return null;

    // Extrair endereço estruturado primeiro para não conflitar com números de galpão (ex: G2, N1)
    const locMatch = text.match(/\b([A-Za-z0-9]+-[A-Za-z0-9-]+)\b/);
    const locationCode = locMatch ? locMatch[1].toUpperCase() : null;

    // Remover o código do endereço do texto para análise numérica pura
    let cleanedText = text;
    if (locationCode) {
      cleanedText = text.replace(new RegExp(locationCode, 'gi'), '');
    }

    let countedQty = null;
    let systemQty = null;

    // Procura contagem física informada
    const countMatches = [
      cleanedText.match(/(?:contei|tem|físico|fisico)\s+(?:apenas\s+)?(\d+)/i),
      cleanedText.match(/(\d+)\s*(?:unidades|un|peças|itens)/i),
      cleanedText.match(/(\d+)\s*(?:un|unidades)/i)
    ];
    for (const cm of countMatches) {
      if (cm) {
        countedQty = parseInt(cm[1], 10);
        break;
      }
    }

    // Procura saldo de sistema citado
    const sysMatches = [
      cleanedText.match(/sistema\s*(?:marca|está|tem|mostra)?\s*(\d+)/i),
      cleanedText.match(/era(?:\s+para\s+ter)?\s*(\d+)/i)
    ];
    for (const sm of sysMatches) {
      if (sm) {
        systemQty = parseInt(sm[1], 10);
        break;
      }
    }

    // Extrair SKU candidato se houver
    const skuMatch = cleanedText.match(/\b([A-Za-z0-9]{3,}-[A-Za-z0-9-]+)\b/);
    const skuCandidate = skuMatch ? skuMatch[1].toUpperCase() : null;

    return {
      text,
      cleanedText,
      countedQty,
      systemQty,
      locationCode,
      skuCandidate
    };
  }

  /**
   * Processa a divergência e gera card com confirmação
   */
  handleInventoryDivergence(data) {
    let stockItem = null;

    // Tentar achar pelo endereço e/ou SKU
    if (data.locationCode) {
      stockItem = db.prepare(`
        SELECT s.id as stock_id, s.quantity as current_system_qty, p.id as product_id, p.sku, p.name, l.id as location_id, l.code as location_code
        FROM stock s
        JOIN products p ON s.product_id = p.id
        JOIN locations l ON s.location_id = l.id
        WHERE UPPER(l.code) LIKE ?
        LIMIT 1
      `).get(`%${data.locationCode}%`);
    }

    // Se não achou pelo endereço, tenta por palavras do texto (ex: "caixa organizadora")
    if (!stockItem) {
      const words = ['caixa', 'organizadora', 'fita', 'luva', 'parafuso', 'porca', 'cabo', 'disjuntor', 'botina'];
      for (const w of words) {
        if (data.text.toLowerCase().includes(w)) {
          stockItem = db.prepare(`
            SELECT s.id as stock_id, s.quantity as current_system_qty, p.id as product_id, p.sku, p.name, l.id as location_id, l.code as location_code
            FROM stock s
            JOIN products p ON s.product_id = p.id
            JOIN locations l ON s.location_id = l.id
            WHERE LOWER(p.name) LIKE ? OR LOWER(p.sku) LIKE ?
            LIMIT 1
          `).get(`%${w}%`, `%${w}%`);
          if (stockItem) break;
        }
      }
    }

    if (!stockItem) {
      return {
        text: `⚠️ **Aviso de Contagem:** Não consegui localizar com precisão o produto ou endereço mencionado.\n` +
          `Por favor, informe no padrão: *"Contei [X] unidades do SKU [CÓDIGO] no endereço [LOCAL]"* para registrar a conferência.`
      };
    }

    const sysQty = stockItem.current_system_qty;
    const physQty = (data.countedQty !== null) ? data.countedQty : 0;
    const divergence = physQty - sysQty;

    let divergenceLabel = `${divergence > 0 ? '+' : ''}${divergence} un.`;

    const responseText = 
      `⚠️ **Divergência Identificada:**\n` +
      `- **Produto:** ${stockItem.name} (\`${stockItem.sku}\`)\n` +
      `- **Endereço:** \`${stockItem.location_code}\`\n` +
      `- **Saldo Sistema:** ${sysQty} un.\n` +
      `- **Contagem Física:** ${physQty} un.\n` +
      `- **Divergência:** **${divergenceLabel}**\n\n` +
      `❓ **Deseja confirmar o ajuste do registro para ${physQty} unidades no endereço \`${stockItem.location_code}\`?**\n` +
      `*(Por favor, clique no botão de confirmação abaixo ou confirme para aplicar com registro de auditoria).*`;

    return {
      text: responseText,
      action: {
        type: 'CONFIRM_ADJUSTMENT',
        payload: {
          stockId: stockItem.stock_id,
          productId: stockItem.product_id,
          productSku: stockItem.sku,
          productName: stockItem.name,
          locationId: stockItem.location_id,
          locationCode: stockItem.location_code,
          systemQty: sysQty,
          countedQty: physQty,
          divergence: divergence
        }
      },
      suggestions: [`Confirmar ajuste para ${physQty} un`, `Cancelar ajuste`]
    };
  }

  /**
   * Busca produto por SKU, EAN ou Nome e formata a resposta no padrão exigido pelo SKILL.md
   */
  searchProductAndFormatResponse(cleanSearch, originalMessage, isEanExplicit = false) {
    if (!cleanSearch) {
      cleanSearch = originalMessage.trim();
    }

    // 1. Tentar busca exata por SKU ou EAN
    let products = db.prepare(`
      SELECT p.*
      FROM products p
      WHERE UPPER(p.sku) = UPPER(?) OR p.ean = ?
    `).all(cleanSearch, cleanSearch);

    // 2. Se não encontrou, busca ampla por texto (LIKE)
    if (products.length === 0 && !isEanExplicit) {
      const searchTerms = cleanSearch.split(/\s+/).filter(t => t.length > 2);
      if (searchTerms.length > 0) {
        let sql = `SELECT p.* FROM products p WHERE `;
        let conditions = searchTerms.map(() => `(p.name LIKE ? OR p.sku LIKE ? OR p.category LIKE ?)`).join(' AND ');
        sql += conditions;

        let params = [];
        for (const term of searchTerms) {
          const p = `%${term}%`;
          params.push(p, p, p);
        }

        try {
          products = db.prepare(sql).all(...params);
        } catch (e) {
          products = [];
        }
      }
    }

    // Regra 3 do SKILL.md: Produto Não Localizado
    if (products.length === 0) {
      const isEan = isEanExplicit || /^\d{8,14}$/.test(cleanSearch.replace(/\D/g, ''));
      const idLabel = isEan ? `EAN \`${cleanSearch}\`` : `código/nome \`${cleanSearch}\``;

      return {
        text: `❌ **Item com ${idLabel} não localizado no estoque ativo.**\n\n` +
          `• Verifique se a grafia ou os dígitos do código foram digitados corretamente.\n` +
          `• Verifique as áreas de **Recebimento / Doca / Triagem** ou mercadorias em **Trânsito / Conferência**.\n` +
          `• Verifique se o produto não está sob outra nomenclatura ou código de fabricante.`,
        suggestions: ['Consultar estoque geral', 'Ver itens zerados', 'Cadastrar novo produto']
      };
    }

    // Regra 1.4: Resolução de Ambiguidades se houver mais de um item correspondente
    if (products.length > 1) {
      let resp = `🔍 **Encontrei ${products.length} produtos compatíveis:**\n\n`;
      products.forEach((p, idx) => {
        resp += `${idx + 1}. **${p.name}** (SKU: \`${p.sku}\`) - Cat: *${p.category}*\n`;
      });
      resp += `\n*Por favor, informe o SKU ou clique em uma das opções abaixo para ver a localização e saldo exatos:*`;
      return {
        text: resp,
        suggestions: products.map(p => `Onde está o SKU ${p.sku}?`)
      };
    }

    // Produto Único Localizado -> Buscar endereços e saldos
    const prod = products[0];
    const stocks = db.prepare(`
      SELECT s.quantity, l.code, l.warehouse, l.aisle, l.rack, l.level, l.shelf, l.type, l.description as loc_desc
      FROM stock s
      JOIN locations l ON s.location_id = l.id
      WHERE s.product_id = ?
      ORDER BY s.quantity DESC
    `).all(prod.id);

    const totalQty = stocks.reduce((sum, item) => sum + item.quantity, 0);

    // Regra 2 do SKILL.md: Multi-endereçamento
    if (stocks.length > 1) {
      let resp = `📍 **SKU \`${prod.sku}\` - ${prod.name}**\n`;
      resp += `Encontrado em **${stocks.length} endereços**:\n\n`;

      stocks.forEach((st, i) => {
        const areaLabel = st.type === 'PULMAO' ? 'Pulmão / Sobrerrack' : 'Área de Picking';
        resp += `${i + 1}. \`${st.code}\`: **${st.quantity} ${prod.unit}** (${areaLabel})\n`;
      });

      resp += `\n**Total Geral:** **${totalQty} ${prod.unit}**\n`;
      resp += `*(Fonte: \`estoque.db / WMS Ativo\`)*`;

      return {
        text: resp,
        suggestions: [
          `Transferir de Pulmão para Picking`,
          `Fazer contagem de ${prod.sku}`,
          `Ver no mapa do galpão`
        ]
      };
    }

    // Item em endereço único (Exemplo 1 do manual)
    if (stocks.length === 1) {
      const st = stocks[0];
      const statusBadge = st.quantity === 0 ? '🛑 (Zerado)' : (st.quantity <= prod.min_stock ? '⚠️ (Estoque Baixo)' : '✅');

      let structuredDesc = '';
      if (st.aisle && st.rack) {
        structuredDesc = `Galpão **${st.warehouse}** | Corredor **${st.aisle}** | Rack **${st.rack}** | Nível **${st.level}** | Prateleira **${st.shelf}** (\`${st.code}\`)`;
      } else {
        structuredDesc = `\`${st.code}\``;
      }

      let resp = `📍 **${prod.name} (SKU: \`${prod.sku}\`)**\n`;
      resp += `- **Endereço:** ${structuredDesc}\n`;
      resp += `- **Saldo disponível:** **${st.quantity} ${prod.unit}** ${statusBadge}\n`;
      resp += `*(Fonte: \`estoque.db / WMS Ativo\`)*`;

      return {
        text: resp,
        suggestions: [
          `Contar saldo de ${prod.sku}`,
          `Histórico de ${prod.sku}`,
          `Ver no mapa do galpão`
        ]
      };
    }

    // Sem estoque registrado em nenhum local
    return {
      text: `📍 **${prod.name} (SKU: \`${prod.sku}\`)**\n` +
        `O produto está cadastrado no catálogo, porém **não possui nenhum endereço de armazenagem vinculado** ou saldo atribuído.\n` +
        `• Recomenda-se realizar o endereçamento inicial via Doca de Recebimento.`,
      suggestions: [`Alocar ${prod.sku} em um endereço`, `Consultar estoque geral`]
    };
  }

  /**
   * Executa o ajuste de inventário no banco de dados e cria registro de auditoria
   */
  async applyAdjustment(data, operator = 'Operador Galpão', reason = 'Ajuste de Inventário Físico') {
    const { productId, locationId, systemQty, countedQty, divergence } = data;

    const checkStock = db.prepare('SELECT id, quantity FROM stock WHERE product_id = ? AND location_id = ?').get(productId, locationId);
    if (!checkStock) {
      throw new Error('Registro de estoque não localizado para ajuste.');
    }

    // Atualiza o saldo
    db.prepare(`
      UPDATE stock
      SET quantity = ?, last_counted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(countedQty, checkStock.id);

    // Registra movimento de auditoria
    db.prepare(`
      INSERT INTO movements (product_id, type, to_location_id, quantity, previous_quantity, new_quantity, delta, reason, operator)
      VALUES (?, 'AJUSTE_INVENTARIO', ?, ?, ?, ?, ?, ?, ?)
    `).run(productId, locationId, countedQty, systemQty, countedQty, divergence, reason, operator);

    return {
      success: true,
      newQuantity: countedQty,
      delta: divergence
    };
  }
}

module.exports = new WarehouseAgent();

