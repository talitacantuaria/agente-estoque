// database.js - Gerenciador do Banco de Dados SQLite do Agente de Armazém
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DB_PATH = path.join(__dirname, 'estoque.db');
const db = new DatabaseSync(DB_PATH);

// Ativar chaves estrangeiras e modo WAL para alta performance
db.exec('PRAGMA foreign_keys = ON;');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE NOT NULL,
      ean TEXT,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL DEFAULT 'Geral',
      unit TEXT NOT NULL DEFAULT 'UN',
      min_stock INTEGER NOT NULL DEFAULT 10,
      max_stock INTEGER NOT NULL DEFAULT 1000,
      image_url TEXT,
      icon TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      warehouse TEXT NOT NULL,
      aisle TEXT NOT NULL,
      rack TEXT NOT NULL,
      level TEXT NOT NULL,
      shelf TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'PICKING', -- PICKING, PULMAO, DOCA, EXPEDICAO
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL DEFAULT 0,
      last_counted_at DATETIME,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(product_id, location_id)
    );

    CREATE TABLE IF NOT EXISTS movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      type TEXT NOT NULL, -- ENTRADA, SAIDA, TRANSFERENCIA, AJUSTE_INVENTARIO, REQUISICAO
      from_location_id INTEGER REFERENCES locations(id),
      to_location_id INTEGER REFERENCES locations(id),
      quantity INTEGER NOT NULL,
      previous_quantity INTEGER,
      new_quantity INTEGER,
      delta INTEGER,
      reason TEXT,
      operator TEXT NOT NULL DEFAULT 'Operador Galpão',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS requisitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      requester_name TEXT NOT NULL,
      department TEXT NOT NULL,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'CONCLUIDO', -- PENDENTE, CONCLUIDO, CANCELADO
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS requisition_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requisition_id INTEGER NOT NULL REFERENCES requisitions(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      location_id INTEGER REFERENCES locations(id),
      quantity INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      mode TEXT NOT NULL, -- SKU, ENDERECO, CATEGORIA, GERAL
      filter_value TEXT,
      status TEXT NOT NULL DEFAULT 'ABERTO', -- ABERTO, CONCLUIDO
      operator TEXT NOT NULL DEFAULT 'Operador Galpão',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS inventory_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER REFERENCES inventory_sessions(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
      system_quantity INTEGER NOT NULL,
      counted_quantity INTEGER,
      divergence INTEGER,
      status TEXT NOT NULL DEFAULT 'PENDENTE', -- PENDENTE, CONFERIDO, AJUSTADO
      notes TEXT,
      counted_at DATETIME
    );
  `);

  // Migrações dinâmicas para bases já existentes
  try { db.exec(`ALTER TABLE products ADD COLUMN image_url TEXT;`); } catch (e) {}
  try { db.exec(`ALTER TABLE products ADD COLUMN icon TEXT;`); } catch (e) {}

  // Se o banco estiver vazio, carrega semente inicial
  const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
  if (productCount === 0) {
    seedInitialData();
  } else {
    // Atualiza imagens e ícones para os itens iniciais
    updateProductImages();
  }
}

function updateProductImages() {
  const images = {
    'FIT-3M-PR': { icon: '⚡', url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=400&q=80' },
    'SKU-9920': { icon: '🧤', url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=400&q=80' },
    'SKU-001': { icon: '🔩', url: 'https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?auto=format&fit=crop&w=400&q=80' },
    'SKU-002': { icon: '⚙️', url: 'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=400&q=80' },
    'CX-ORG-30L': { icon: '📦', url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=400&q=80' },
    'DISJ-32A': { icon: '🔌', url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=400&q=80' },
    'CABO-2.5-AZ': { icon: '🧵', url: 'https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?auto=format&fit=crop&w=400&q=80' },
    'BOT-SEG-42': { icon: '🥾', url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=80' }
  };

  const update = db.prepare('UPDATE products SET icon = ?, image_url = ? WHERE sku = ?');
  for (const [sku, val] of Object.entries(images)) {
    update.run(val.icon, val.url, sku);
  }
}

function seedInitialData() {
  console.log('Populando dados iniciais operacionais baseados na documentação...');

  // 1. Inserir Locais padrão
  const insertLocation = db.prepare(`
    INSERT OR IGNORE INTO locations (code, warehouse, aisle, rack, level, shelf, type, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const initialLocations = [
    ['G1-B-04-N2-PA', 'G1', 'B', '04', 'N2', 'PA', 'PICKING', 'Galpão 1, Corredor B, Rack 04, Nível 2, Prateleira A'],
    ['G1-A-01-N1-P01', 'G1', 'A', '01', 'N1', 'P01', 'PICKING', 'Galpão 1, Corredor A, Rack 01, Nível 1, Prateleira 01 (Picking)'],
    ['G1-PULMAO-R05', 'G1', 'PULMAO', 'R05', 'N3', 'P01', 'PULMAO', 'Galpão 1, Área de Pulmão / Sobrerrack R05'],
    ['G1-C02-R01-N2', 'G1', 'C02', 'R01', 'N2', 'P01', 'PICKING', 'Galpão 1, Corredor C02, Rack 01, Nível 2'],
    ['G1-C02-R01-N3', 'G1', 'C02', 'R01', 'N3', 'P01', 'PICKING', 'Galpão 1, Corredor C02, Rack 01, Nível 3'],
    ['G2-C03-N1', 'G2', 'C03', 'R01', 'N1', 'P01', 'PICKING', 'Galpão 2, Corredor C03, Nível 1'],
    ['G1-B-02-N1-P03', 'G1', 'B', '02', 'N1', 'P03', 'PICKING', 'Galpão 1, Corredor B, Rack 02, Nível 1'],
    ['G1-B-03-N1-P01', 'G1', 'B', '03', 'N1', 'P01', 'PICKING', 'Galpão 1, Corredor B, Rack 03, Nível 1'],
    ['G1-A-03-N2-P02', 'G1', 'A', '03', 'N2', 'P02', 'PICKING', 'Galpão 1, Corredor A, Rack 03, Nível 2'],
    ['G1-DOCA-REC', 'G1', 'DOCA', 'D01', 'N0', 'REC', 'DOCA', 'Doca de Recebimento e Conferência de Mercadoria']
  ];

  for (const loc of initialLocations) {
    insertLocation.run(...loc);
  }

  // 2. Inserir Produtos com fotos e ícones
  const insertProduct = db.prepare(`
    INSERT INTO products (sku, ean, name, description, category, unit, min_stock, max_stock, icon, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const initialProducts = [
    {
      sku: 'FIT-3M-PR',
      ean: '7891122334455',
      name: 'Fita Isolante 3M Imperial Preta 19mm x 20m',
      description: 'Fita isolante antichama de alta flexibilidade e isolamento até 750V',
      category: 'Elétrica',
      unit: 'UN',
      min_stock: 20,
      max_stock: 200,
      icon: '⚡',
      image_url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=400&q=80',
      stocks: [{ loc: 'G1-B-04-N2-PA', qty: 48 }]
    },
    {
      sku: 'SKU-9920',
      ean: '7892233445566',
      name: 'Luva de Proteção Nitrílica Verde G',
      description: 'Luva impermeável para manuseio de químicos e óleos com forro de algodão',
      category: 'EPI',
      unit: 'PAR',
      min_stock: 100,
      max_stock: 1000,
      icon: '🧤',
      image_url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=400&q=80',
      stocks: [
        { loc: 'G1-A-01-N1-P01', qty: 120 },
        { loc: 'G1-PULMAO-R05', qty: 500 }
      ]
    },
    {
      sku: 'SKU-001',
      ean: '7893344556677',
      name: 'Parafuso Sextavado Aço Zincado 8mm x 40mm',
      description: 'Parafuso sextavado rosca inteira classe 8.8 zincado branco',
      category: 'Fixadores',
      unit: 'UN',
      min_stock: 50,
      max_stock: 500,
      icon: '🔩',
      image_url: 'https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?auto=format&fit=crop&w=400&q=80',
      stocks: [{ loc: 'G1-C02-R01-N2', qty: 150 }]
    },
    {
      sku: 'SKU-002',
      ean: '7894455667788',
      name: 'Porca M8 Auto-travante com Nylon Zincada',
      description: 'Porca sextavada auto-travante com anel de nylon M8',
      category: 'Fixadores',
      unit: 'UN',
      min_stock: 50,
      max_stock: 500,
      icon: '⚙️',
      image_url: 'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=400&q=80',
      stocks: [{ loc: 'G1-C02-R01-N3', qty: 0 }]
    },
    {
      sku: 'CX-ORG-30L',
      ean: '7895566778899',
      name: 'Caixa Organizadora Plástica Transparente 30L',
      description: 'Caixa organizadora empilhável com travas laterais e tampa',
      category: 'Armazenagem',
      unit: 'UN',
      min_stock: 10,
      max_stock: 100,
      icon: '📦',
      image_url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=400&q=80',
      stocks: [{ loc: 'G2-C03-N1', qty: 20 }]
    },
    {
      sku: 'DISJ-32A',
      ean: '7896677889900',
      name: 'Disjuntor Bipolar Curva C 32A DIN',
      description: 'Mini disjuntor termomagnético 32A padrão trilho DIN',
      category: 'Elétrica',
      unit: 'UN',
      min_stock: 15,
      max_stock: 80,
      icon: '🔌',
      image_url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=400&q=80',
      stocks: [{ loc: 'G1-B-02-N1-P03', qty: 6 }]
    },
    {
      sku: 'CABO-2.5-AZ',
      ean: '7897788990011',
      name: 'Cabo Flexível 750V 2,5mm Rolo 100m Azul',
      description: 'Condutor de cobre para instalações prediais elétricas normatizado',
      category: 'Elétrica',
      unit: 'ROLO',
      min_stock: 10,
      max_stock: 80,
      icon: '🧵',
      image_url: 'https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?auto=format&fit=crop&w=400&q=80',
      stocks: [{ loc: 'G1-B-03-N1-P01', qty: 35 }]
    },
    {
      sku: 'BOT-SEG-42',
      ean: '7898899001122',
      name: 'Botina de Segurança em Couro Bico de Aço 42',
      description: 'Calçado de segurança com biqueira de aço e solado bi-densidade',
      category: 'EPI',
      unit: 'PAR',
      min_stock: 12,
      max_stock: 60,
      icon: '🥾',
      image_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=80',
      stocks: [{ loc: 'G1-A-03-N2-P02', qty: 18 }]
    }
  ];

  const getLocId = db.prepare('SELECT id FROM locations WHERE code = ?');
  const insertStock = db.prepare(`
    INSERT INTO stock (product_id, location_id, quantity)
    VALUES (?, ?, ?)
  `);
  const insertMovement = db.prepare(`
    INSERT INTO movements (product_id, type, to_location_id, quantity, previous_quantity, new_quantity, delta, reason, operator)
    VALUES (?, 'ENTRADA', ?, ?, 0, ?, ?, 'Carga Inicial do Sistema WMS', 'Sistema')
  `);

  for (const prod of initialProducts) {
    const res = insertProduct.run(
      prod.sku,
      prod.ean,
      prod.name,
      prod.description,
      prod.category,
      prod.unit,
      prod.min_stock,
      prod.max_stock,
      prod.icon,
      prod.image_url
    );
    const productId = Number(res.lastInsertRowid);

    for (const s of prod.stocks) {
      const loc = getLocId.get(s.loc);
      if (loc) {
        insertStock.run(productId, loc.id, s.qty);
        if (s.qty > 0) {
          insertMovement.run(productId, loc.id, s.qty, s.qty, s.qty);
        }
      }
    }
  }

  console.log('Banco de dados inicializado com sucesso com catálogo completo!');
}

function resetDatabase() {
  db.exec(`
    DROP TABLE IF EXISTS requisition_items;
    DROP TABLE IF EXISTS requisitions;
    DROP TABLE IF EXISTS inventory_items;
    DROP TABLE IF EXISTS inventory_sessions;
    DROP TABLE IF EXISTS movements;
    DROP TABLE IF EXISTS stock;
    DROP TABLE IF EXISTS locations;
    DROP TABLE IF EXISTS products;
  `);
  initDatabase();
}

module.exports = {
  db,
  initDatabase,
  resetDatabase
};
