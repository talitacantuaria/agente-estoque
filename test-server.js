// test-server.js
const { initDatabase, db, resetDatabase } = require('./database');
const warehouseAgent = require('./warehouse-agent');

async function testAll() {
  console.log('🧪 Iniciando testes de integração e conformidade...');

  // 1. Resetar banco para garantir estado limpo
  resetDatabase();

  // 2. Verificar Dashboard KPIs
  const totalSkus = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
  console.log(`✓ Total SKUs cadastrados: ${totalSkus} (Esperado: 8)`);
  if (totalSkus !== 8) throw new Error('Falha no total de SKUs');

  // 3. Testar Cenário 1: Localização Simples
  const r1 = await warehouseAgent.processMessage('Onde está a fita isolante 3M preta?');
  console.log('\n[Cenário 1 - Fita Isolante]');
  console.log(r1.text);
  if (!r1.text.includes('G1-B-04-N2-PA') || !r1.text.includes('48 UN')) {
    throw new Error('Falha no Cenário 1');
  }

  // 4. Testar Cenário 2: Multi-Endereçamento
  const r2 = await warehouseAgent.processMessage('Onde acho o item SKU-9920 e quanto tem?');
  console.log('\n[Cenário 2 - Multi-Endereçamento]');
  console.log(r2.text);
  if (!r2.text.includes('2 endereços') || !r2.text.includes('620 PAR')) {
    throw new Error('Falha no Cenário 2');
  }

  // 5. Testar Cenário 3: Item Não Encontrado
  const r3 = await warehouseAgent.processMessage('Onde está o código EAN 7891234567890?');
  console.log('\n[Cenário 3 - Não Encontrado]');
  console.log(r3.text);
  if (!r3.text.includes('não localizado') || !r3.text.includes('Recebimento / Doca / Triagem')) {
    throw new Error('Falha no Cenário 3');
  }

  // 6. Testar Cenário 4: Divergência de Inventário e Confirmação
  const r4 = await warehouseAgent.processMessage('Contei a caixa organizadora no endereço G2-C03-N1 e tem 15 unidades, mas o sistema marca 20.');
  console.log('\n[Cenário 4 - Divergência]');
  console.log(r4.text);
  if (!r4.action || r4.action.type !== 'CONFIRM_ADJUSTMENT' || r4.action.payload.divergence !== -5) {
    throw new Error('Falha no Cenário 4: Divergência esperada de -5');
  }

  // 7. Testar Aplicação de Ajuste com Auditoria
  const adjResult = await warehouseAgent.applyAdjustment(r4.action.payload, 'Operador Teste', 'Auditoria Rotina');
  console.log('\n[Aplicação de Ajuste de Saldo]');
  console.log('Resultado do ajuste:', adjResult);

  const updatedStock = db.prepare('SELECT quantity FROM stock WHERE id = ?').get(r4.action.payload.stockId);
  console.log(`Saldo atualizado no banco SQLite: ${updatedStock.quantity} un. (Esperado: 15)`);
  if (updatedStock.quantity !== 15) {
    throw new Error('Saldo não atualizado corretamente!');
  }

  const movement = db.prepare('SELECT * FROM movements WHERE type = ? ORDER BY id DESC LIMIT 1').get('AJUSTE_INVENTARIO');
  console.log(`Auditoria gravada: Delta ${movement.delta}, Operador: ${movement.operator}, Motivo: ${movement.reason}`);
  if (movement.delta !== -5) {
    throw new Error('Registro de auditoria incorreto!');
  }

  console.log('\n🎉 TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!');
}

testAll().catch(err => {
  console.error('❌ Erro no teste:', err);
  process.exit(1);
});

