// server.js - Servidor Backend API REST & Servidor Web do Agente WMS
const express = require('express');
const cors = require('cors');
const path = require('node:path');
const fs = require('node:fs');
const multer = require('multer');
const { db, initDatabase, resetDatabase } = require('./database');
const warehouseAgent = require('./warehouse-agent');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar upload para importação de CSV
const upload = multer({ dest: path.join(__dirname, 'uploads/') });

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Inicializa o banco de dados SQLite
initDatabase();

// -------------------------------------------------------------
// ROTAS DA API
// -------------------------------------------------------------

/**
 * 1. Métricas do Dashboard Geral
 */
app.get('/api/dashboard', (req, res) => {
  try {
    const totalSkus = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
    const totalQty = db.prepare('SELECT COALESCE(SUM(quantity), 0) as total FROM stock').get().total;

    const zeroStock = db.prepare(`
      SELECT COUNT(DISTINCT p.id) as c
      FROM products p
      LEFT JOIN stock s ON s.product_id = p.id
      GROUP BY p.id
      HAVING COALESCE(SUM(s.quantity), 0) = 0
    `).all().length;

    const criticalStock = db.prepare(`
      SELECT COUNT(DISTINCT p.id) as c
      FROM products p
      JOIN stock s ON s.product_id = p.id
      GROUP BY p.id
      HAVING SUM(s.quantity) <= p.min_stock AND SUM(s.quantity) > 0
    `).all().length;

    const totalLocations = db.prepare('SELECT COUNT(*) as c FROM locations').get().c;
    const occupiedLocations = db.prepare('SELECT COUNT(DISTINCT location_id) as c FROM stock WHERE quantity > 0').get().c;

    const recentMovements = db.prepare(`
      SELECT m.*, p.sku, p.name as product_name,
             l_from.code as from_code, l_to.code as to_code
      FROM movements m
      JOIN products p ON m.product_id = p.id
      LEFT JOIN locations l_from ON m.from_location_id = l_from.id
      LEFT JOIN locations l_to ON m.to_location_id = l_to.id
      ORDER BY m.created_at DESC
      LIMIT 8
    `).all();

    const categoryStats = db.prepare(`
      SELECT p.category, COUNT(DISTINCT p.id) as skus, COALESCE(SUM(s.quantity), 0) as total_qty
      FROM products p
      LEFT JOIN stock s ON s.product_id = p.id
      GROUP BY p.category
      ORDER BY total_qty DESC
    `).all();

    // Acuracidade aproximada baseada nas últimas contagens
    const countStats = db.prepare(`
      SELECT 
        COUNT(*) as total_counts,
        COALESCE(SUM(CASE WHEN delta = 0 THEN 1 ELSE 0 END), 0) as exact_counts
      FROM movements
      WHERE type = 'AJUSTE_INVENTARIO'
    `).get();

    const accuracyRate = (countStats && countStats.total_counts > 0)
      ? Math.round((countStats.exact_counts / countStats.total_counts) * 100) 
      : 98;

    res.json({
      totalSkus,
      totalQty,
      zeroStock,
      criticalStock,
      totalLocations,
      occupiedLocations,
      accuracyRate,
      recentMovements,
      categoryStats
    });
  } catch (err) {
    console.error('Erro dashboard:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 2. Consulta de Produtos e Estoque com Busca Flexível
 */
app.get('/api/products', (req, res) => {
  try {
    const { q, category, status } = req.query;

    let sql = `
      SELECT p.*,
        COALESCE(SUM(s.quantity), 0) as total_quantity,
        COUNT(s.id) as locations_count
      FROM products p
      LEFT JOIN stock s ON s.product_id = p.id
    `;
    const whereClauses = [];
    const params = [];

    if (q && q.trim()) {
      const term = `%${q.trim()}%`;
      whereClauses.push(`(p.sku LIKE ? OR p.ean LIKE ? OR p.name LIKE ? OR p.description LIKE ?)`);
      params.push(term, term, term, term);
    }

    if (category && category !== 'ALL') {
      whereClauses.push('p.category = ?');
      params.push(category);
    }

    if (whereClauses.length > 0) {
      sql += ' WHERE ' + whereClauses.join(' AND ');
    }

    sql += ' GROUP BY p.id';

    if (status === 'ZERO') {
      sql += ' HAVING total_quantity = 0';
    } else if (status === 'CRITICAL') {
      sql += ' HAVING total_quantity <= p.min_stock AND total_quantity > 0';
    } else if (status === 'OK') {
      sql += ' HAVING total_quantity > p.min_stock';
    }

    sql += ' ORDER BY p.name ASC';

    const products = db.prepare(sql).all(...params);

    // Carregar os estoques detalhados por endereço para cada produto retornado
    const getStocks = db.prepare(`
      SELECT s.id as stock_id, s.quantity, s.last_counted_at,
             l.id as location_id, l.code, l.warehouse, l.aisle, l.rack, l.level, l.shelf, l.type, l.description as location_description
      FROM stock s
      JOIN locations l ON s.location_id = l.id
      WHERE s.product_id = ?
      ORDER BY s.quantity DESC
    `);

    const result = products.map(prod => {
      const stocks = getStocks.all(prod.id);
      return {
        ...prod,
        stocks,
        status: prod.total_quantity === 0 ? 'ZERADO' : (prod.total_quantity <= prod.min_stock ? 'CRITICO' : 'NORMAL')
      };
    });

    res.json(result);
  } catch (err) {
    console.error('Erro listar produtos:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 3. Detalhes de um produto por SKU ou ID
 */
app.get('/api/products/:identifier', (req, res) => {
  try {
    const { identifier } = req.params;
    let prod = null;

    if (/^\d+$/.test(identifier)) {
      prod = db.prepare('SELECT * FROM products WHERE id = ?').get(identifier);
    } else {
      prod = db.prepare('SELECT * FROM products WHERE UPPER(sku) = UPPER(?) OR ean = ?').get(identifier, identifier);
    }

    if (!prod) {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }

    const stocks = db.prepare(`
      SELECT s.id as stock_id, s.quantity, s.last_counted_at,
             l.id as location_id, l.code, l.warehouse, l.aisle, l.rack, l.level, l.shelf, l.type, l.description as loc_description
      FROM stock s
      JOIN locations l ON s.location_id = l.id
      WHERE s.product_id = ?
    `).all(prod.id);

    const movements = db.prepare(`
      SELECT m.*, l_from.code as from_code, l_to.code as to_code
      FROM movements m
      LEFT JOIN locations l_from ON m.from_location_id = l_from.id
      LEFT JOIN locations l_to ON m.to_location_id = l_to.id
      WHERE m.product_id = ?
      ORDER BY m.created_at DESC
      LIMIT 15
    `).all(prod.id);

    const totalQty = stocks.reduce((acc, cur) => acc + cur.quantity, 0);

    res.json({
      product: prod,
      stocks,
      totalQuantity: totalQty,
      movements
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 4. Cadastro de Novo Produto
 */
app.post('/api/products', (req, res) => {
  try {
    const { sku, ean, name, description, category, unit, min_stock, location_code, initial_quantity } = req.body;

    if (!sku || !name) {
      return res.status(400).json({ error: 'SKU e Nome são obrigatórios.' });
    }

    const insertProd = db.prepare(`
      INSERT INTO products (sku, ean, name, description, category, unit, min_stock)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertProd.run(
      sku.trim().toUpperCase(),
      ean ? ean.trim() : null,
      name.trim(),
      description || '',
      category || 'Geral',
      unit || 'UN',
      parseInt(min_stock, 10) || 10
    );

    const productId = Number(result.lastInsertRowid);

    // Se informou endereço inicial, vincula e adiciona saldo
    if (location_code) {
      let loc = db.prepare('SELECT id FROM locations WHERE code = ?').get(location_code.trim().toUpperCase());
      if (!loc) {
        // Criar local automaticamente se não existir
        const parts = location_code.split('-');
        const warehouse = parts[0] || 'G1';
        const aisle = parts[1] || 'A';
        const rack = parts[2] || '01';
        const level = parts[3] || 'N1';
        const shelf = parts[4] || 'P01';

        const insLoc = db.prepare(`
          INSERT INTO locations (code, warehouse, aisle, rack, level, shelf, type)
          VALUES (?, ?, ?, ?, ?, ?, 'PICKING')
        `);
        const locRes = insLoc.run(location_code.trim().toUpperCase(), warehouse, aisle, rack, level, shelf);
        loc = { id: Number(locRes.lastInsertRowid) };
      }

      const qty = parseInt(initial_quantity, 10) || 0;
      db.prepare(`
        INSERT INTO stock (product_id, location_id, quantity)
        VALUES (?, ?, ?)
      `).run(productId, loc.id, qty);

      if (qty > 0) {
        db.prepare(`
          INSERT INTO movements (product_id, type, to_location_id, quantity, previous_quantity, new_quantity, delta, reason, operator)
          VALUES (?, 'ENTRADA', ?, ?, 0, ?, ?, 'Cadastro Inicial', 'Operador Galpão')
        `).run(productId, loc.id, qty, qty, qty);
      }
    }

    res.json({ success: true, productId, sku });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 5. Locais de Armazenagem
 */
app.get('/api/locations', (req, res) => {
  try {
    const locations = db.prepare(`
      SELECT l.*,
        COUNT(s.id) as items_stored,
        COALESCE(SUM(s.quantity), 0) as total_units
      FROM locations l
      LEFT JOIN stock s ON s.location_id = l.id
      GROUP BY l.id
      ORDER BY l.warehouse, l.aisle, l.rack, l.level, l.shelf
    `).all();

    res.json(locations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 6. Dados para Sessão de Inventário e Contagem
 */
app.get('/api/inventory', (req, res) => {
  try {
    const { aisle, warehouse, category } = req.query;

    let sql = `
      SELECT s.id as stock_id, s.quantity as system_quantity, s.last_counted_at,
             p.id as product_id, p.sku, p.name as product_name, p.category, p.unit, p.min_stock,
             l.id as location_id, l.code as location_code, l.warehouse, l.aisle, l.rack, l.level, l.shelf, l.type
      FROM stock s
      JOIN products p ON s.product_id = p.id
      JOIN locations l ON s.location_id = l.id
    `;
    const where = [];
    const params = [];

    if (warehouse && warehouse !== 'ALL') {
      where.push('l.warehouse = ?');
      params.push(warehouse);
    }
    if (aisle && aisle !== 'ALL') {
      where.push('l.aisle = ?');
      params.push(aisle);
    }
    if (category && category !== 'ALL') {
      where.push('p.category = ?');
      params.push(category);
    }

    if (where.length > 0) {
      sql += ' WHERE ' + where.join(' AND ');
    }

    sql += ' ORDER BY l.code, p.sku';

    const items = db.prepare(sql).all(...params);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 7. Execução do Ajuste de Inventário com Confirmação Obrigatória
 * (Regra SKILL.md: NUNCA altere saldos sem confirmação explícita)
 */
app.post('/api/inventory/apply-adjustment', async (req, res) => {
  try {
    const { productId, locationId, systemQty, countedQty, divergence, reason, operator, confirmed } = req.body;

    if (!confirmed) {
      return res.status(400).json({
        error: 'Confirmação obrigatória não recebida. As diretrizes do armazém exigem confirmação explícita para alteração de saldo.'
      });
    }

    const result = await warehouseAgent.applyAdjustment({
      productId: Number(productId),
      locationId: Number(locationId),
      systemQty: Number(systemQty),
      countedQty: Number(countedQty),
      divergence: Number(divergence)
    }, operator || 'Operador Galpão', reason || 'Ajuste de Inventário Físico');

    res.json({
      success: true,
      message: `Ajuste efetuado com sucesso! Saldo atualizado para ${countedQty} unidades com registro de auditoria.`,
      result
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 8. Transferência entre Endereços (ex: Pulmão -> Picking)
 */
app.post('/api/movements/transfer', (req, res) => {
  try {
    const { productId, fromLocationId, toLocationId, quantity, operator, reason } = req.body;
    const qty = parseInt(quantity, 10);

    if (!qty || qty <= 0) {
      return res.status(400).json({ error: 'Quantidade de transferência inválida.' });
    }

    if (fromLocationId === toLocationId) {
      return res.status(400).json({ error: 'O endereço de origem e destino devem ser diferentes.' });
    }

    // Checa saldo de origem
    const sourceStock = db.prepare('SELECT id, quantity FROM stock WHERE product_id = ? AND location_id = ?').get(productId, fromLocationId);
    if (!sourceStock || sourceStock.quantity < qty) {
      return res.status(400).json({
        error: `Saldo insuficiente na origem. Saldo disponível: ${sourceStock ? sourceStock.quantity : 0}`
      });
    }

    // Deduz da origem
    const newSourceQty = sourceStock.quantity - qty;
    db.prepare('UPDATE stock SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newSourceQty, sourceStock.id);

    // Adiciona no destino (cria registro se não existir)
    const targetStock = db.prepare('SELECT id, quantity FROM stock WHERE product_id = ? AND location_id = ?').get(productId, toLocationId);
    let newTargetQty = qty;
    if (targetStock) {
      newTargetQty = targetStock.quantity + qty;
      db.prepare('UPDATE stock SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newTargetQty, targetStock.id);
    } else {
      db.prepare('INSERT INTO stock (product_id, location_id, quantity) VALUES (?, ?, ?)').run(productId, toLocationId, qty);
    }

    // Registra movimento de auditoria
    db.prepare(`
      INSERT INTO movements (product_id, type, from_location_id, to_location_id, quantity, previous_quantity, new_quantity, delta, reason, operator)
      VALUES (?, 'TRANSFERENCIA', ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      productId,
      fromLocationId,
      toLocationId,
      qty,
      sourceStock.quantity,
      newSourceQty,
      reason || 'Transferência Interna de Armazém',
      operator || 'Operador Galpão'
    );

    res.json({
      success: true,
      message: `Transferência de ${qty} unidades concluída com sucesso!`,
      newSourceQty,
      newTargetQty
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 9. Histórico de Movimentações (Auditoria)
 */
app.get('/api/movements', (req, res) => {
  try {
    const { limit = 50, type, sku } = req.query;

    let sql = `
      SELECT m.*, p.sku, p.name as product_name, p.unit,
             l_from.code as from_code, l_to.code as to_code
      FROM movements m
      JOIN products p ON m.product_id = p.id
      LEFT JOIN locations l_from ON m.from_location_id = l_from.id
      LEFT JOIN locations l_to ON m.to_location_id = l_to.id
    `;
    const where = [];
    const params = [];

    if (type && type !== 'ALL') {
      where.push('m.type = ?');
      params.push(type);
    }
    if (sku) {
      where.push('UPPER(p.sku) = UPPER(?)');
      params.push(sku);
    }

    if (where.length > 0) {
      sql += ' WHERE ' + where.join(' AND ');
    }

    sql += ' ORDER BY m.created_at DESC LIMIT ?';
    params.push(parseInt(limit, 10));

    const movements = db.prepare(sql).all(...params);
    res.json(movements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 10. Chat do Agente de Armazém (Processamento de Linguagem Natural Operacional)
 */
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    const response = await warehouseAgent.processMessage(message);
    res.json(response);
  } catch (err) {
    console.error('Erro chat agente:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 11. Requisições e Retiradas do Portal do Colaborador (Para Qualquer Pessoa da Empresa)
 */
app.post('/api/requisitions', (req, res) => {
  try {
    const { requester_name, department, reason, items } = req.body;
    if (!requester_name || !department || !items || !items.length) {
      return res.status(400).json({ error: 'Nome do solicitante, departamento e itens são obrigatórios.' });
    }

    const code = 'REQ-' + Math.floor(100000 + Math.random() * 900000);

    const insertReq = db.prepare(`
      INSERT INTO requisitions (code, requester_name, department, reason, status)
      VALUES (?, ?, ?, ?, 'CONCLUIDO')
    `);
    const reqResult = insertReq.run(code, requester_name.trim(), department.trim(), reason || 'Retirada Expressa Colaborador');
    const requisitionId = Number(reqResult.lastInsertRowid);

    const insertReqItem = db.prepare(`
      INSERT INTO requisition_items (requisition_id, product_id, location_id, quantity)
      VALUES (?, ?, ?, ?)
    `);

    const updateStock = db.prepare('UPDATE stock SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    const insertMovement = db.prepare(`
      INSERT INTO movements (product_id, type, from_location_id, quantity, previous_quantity, new_quantity, delta, reason, operator)
      VALUES (?, 'SAIDA', ?, ?, ?, ?, ?, ?, ?)
    `);

    const processedItems = [];

    for (const it of items) {
      const prodId = Number(it.productId);
      const qty = Number(it.quantity);

      // Localiza estoque disponível (priorizando área de picking)
      const stockItem = db.prepare(`
        SELECT s.*, l.code as location_code
        FROM stock s
        JOIN locations l ON s.location_id = l.id
        WHERE s.product_id = ? AND s.quantity >= ?
        ORDER BY CASE WHEN l.type = 'PICKING' THEN 0 ELSE 1 END, s.quantity ASC
        LIMIT 1
      `).get(prodId, qty);

      if (!stockItem) {
        throw new Error(`Saldo insuficiente no armazém para o item ID ${prodId} (solicitado: ${qty}).`);
      }

      const prevQty = stockItem.quantity;
      const newQty = prevQty - qty;

      updateStock.run(qty, stockItem.id);
      insertReqItem.run(requisitionId, prodId, stockItem.location_id, qty);
      insertMovement.run(
        prodId,
        stockItem.location_id,
        qty,
        prevQty,
        newQty,
        -qty,
        `Requisição ${code} (${requester_name} - ${department})`,
        requester_name
      );

      const prod = db.prepare('SELECT name, sku, unit, icon FROM products WHERE id = ?').get(prodId);
      processedItems.push({
        ...prod,
        quantity: qty,
        location: stockItem.location_code
      });
    }

    res.json({
      success: true,
      code,
      requisitionId,
      requester_name,
      department,
      items: processedItems,
      message: 'Requisição gerada com sucesso! Materiais liberados para retirada imediata.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/requisitions', (req, res) => {
  try {
    const reqs = db.prepare(`
      SELECT r.*, COUNT(ri.id) as total_items, COALESCE(SUM(ri.quantity), 0) as total_quantity
      FROM requisitions r
      LEFT JOIN requisition_items ri ON ri.requisition_id = r.id
      GROUP BY r.id
      ORDER BY r.created_at DESC
      LIMIT 20
    `).all();

    const getItems = db.prepare(`
      SELECT ri.*, p.sku, p.name as product_name, p.unit, p.icon, l.code as location_code
      FROM requisition_items ri
      JOIN products p ON ri.product_id = p.id
      JOIN locations l ON ri.location_id = l.id
      WHERE ri.requisition_id = ?
    `);

    const result = reqs.map(r => ({
      ...r,
      items: getItems.all(r.id)
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 11. Restauração de Dados Padrão (Seed)
 */
app.post('/api/data/reset', (req, res) => {
  try {
    resetDatabase();
    res.json({ success: true, message: 'Base de dados resetada com os dados oficiais de demonstração.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 12. Exportação de Estoque em CSV
 */
app.get('/api/data/export', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT p.sku, p.ean, p.name, p.category, p.unit, l.code as location_code, s.quantity, p.min_stock
      FROM stock s
      JOIN products p ON s.product_id = p.id
      JOIN locations l ON s.location_id = l.id
      ORDER BY p.name
    `).all();

    let csv = 'SKU;EAN;Descricao;Categoria;Unidade;Endereco;Quantidade;EstoqueMinimo\n';
    rows.forEach(r => {
      csv += `"${r.sku}";"${r.ean || ''}";"${r.name}";"${r.category}";"${r.unit}";"${r.location_code}";${r.quantity};${r.min_stock}\n`;
    });

    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.attachment(`estoque_armazem_${new Date().toISOString().slice(0, 10)}.csv`);
    res.send('\uFEFF' + csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Fallback para Single-Page Application (SPA)
 */
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar Servidor
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 AGENTE DE ESTOQUE & WMS - SOFTWARE OPERACIONAL`);
  console.log(`📡 Servidor ativo em: http://localhost:${PORT}`);
  console.log(`📦 Banco de dados SQLite: ${path.join(__dirname, 'estoque.db')}`);
  console.log(`=======================================================`);
});
