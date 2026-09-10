import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_URL,
});

const tenantSlug = 'distribuidora-sanjose';

const products = [
  { sku: 'ACE-001', name: 'Aceite Vegetal 1L', description: 'Caja x 24', cost: 52, price: 62, stock: 3, minAlert: 10 },
  { sku: 'ARR-001', name: 'Arroz Oro 50lb', description: 'Saco 50lb', cost: 140, price: 150, stock: 45, minAlert: 10 },
  { sku: 'AZU-001', name: 'Azúcar Blanca 50lb', description: 'Saco 50lb', cost: 120, price: 130, stock: 2, minAlert: 8 },
  { sku: 'FRJ-001', name: 'Frijoles Rojos 100lb', description: 'Quintal', cost: 185, price: 200, stock: 22, minAlert: 5 },
  { sku: 'LEC-001', name: 'Leche Entera 1L', description: 'Caja x 12', cost: 25, price: 30, stock: 80, minAlert: 20 },
  { sku: 'SAL-001', name: 'Sal de Mesa 1kg', description: 'Bolsa x 24', cost: 8, price: 12, stock: 5, minAlert: 20 },
  { sku: 'DET-001', name: 'Detergente en Polvo 5kg', description: 'Caja x 4', cost: 180, price: 220, stock: 4, minAlert: 15 },
  { sku: 'JBN-001', name: 'Jabón de Baño x 50', description: 'Caja x 50', cost: 95, price: 115, stock: 38, minAlert: 10 },
  { sku: 'CAF-001', name: 'Café Imperial 400g', description: 'Caja x 12', cost: 65, price: 85, stock: 17, minAlert: 5 },
  { sku: 'SPG-001', name: 'Sopa Maggi x 12', description: 'Caja x 12 sabores', cost: 28, price: 38, stock: 62, minAlert: 12 },
];

const suppliers = [
  { name: 'Distribuidora Central S.A.', contactName: 'Carlos Mendoza', phone: '+505 8877-2323', email: 'ventas@distcentral.com.ni', taxId: '03141990123456', address: 'Zona Franca Las Mercedes, Managua' },
  { name: 'Importadora Bebidas del Sur', contactName: 'Ana Lucía Gómez', phone: '+505 8977-1100', email: 'pedidos@bebsur.com.ni', taxId: '03141985234567', address: 'Carretera a Masaya Km 9, Managua' },
  { name: 'Lácteos & Granos del Valle', contactName: 'Roberto Paz', phone: '+505 8811-6655', email: 'contacto@delvalle.com.ni', taxId: '03141995889900', address: 'Km 12 Carretera Norte, Managua' },
];

const employees = [
  { firstName: 'Mario', lastName: 'Alvarado', email: 'mario.alvarado@distribuidora.com.ni', phone: '+505 8911-2233', role: 'Vendedor de Ruta', department: 'Ventas Exterior', salary: 14500, commissionRate: 2.5, hireDate: new Date('2024-03-15') },
  { firstName: 'Elena', lastName: 'Torres', email: 'elena.torres@distribuidora.com.ni', phone: '+505 8822-3344', role: 'Jefe de Bodega', department: 'Inventario & Logística', salary: 16000, commissionRate: 0, hireDate: new Date('2023-01-10') },
  { firstName: 'Kevin', lastName: 'Mejía', email: 'kevin.mejia@distribuidora.com.ni', phone: '+505 8833-5566', role: 'Cajero Principal', department: 'Caja & Facturación', salary: 13000, commissionRate: 0.5, hireDate: new Date('2025-06-01') },
  { firstName: 'José', lastName: 'Castillo', email: 'jose.castillo@distribuidora.com.ni', phone: '+505 8900-1122', role: 'Conductor de Reparto', department: 'Logística', salary: 12500, commissionRate: 1.0, hireDate: new Date('2024-11-01'), isActive: false },
];

const customers = [
  { firstName: 'María', lastName: 'López', documentId: '0011915040001A' },
  { firstName: 'Juan', lastName: 'Pérez', documentId: '0012007050002B' },
  { firstName: 'Pedro', lastName: 'Martínez', documentId: '0012311060003C' },
  { firstName: 'Ana', lastName: 'Castillo', documentId: '0011912080004D' },
];

const taxRates = [
  { name: 'IVA General 15%', rate: 15, isInclusive: true, isDefault: true },
  { name: 'IVA 10% (productos básicos)', rate: 10, isInclusive: false, isDefault: false },
  { name: 'Exento (0%)', rate: 0, isInclusive: false, isDefault: false },
];

async function main() {
  console.log('Limpiando datos previos del seed...');
  await prisma.saleItem.deleteMany({});
  await prisma.cashMovement.deleteMany({});
  await prisma.sale.deleteMany({});
  await prisma.cashSession.deleteMany({});
  await prisma.purchaseOrder.deleteMany({});
  await prisma.employee.deleteMany({});
  await prisma.supplier.deleteMany({});
  await prisma.taxRate.deleteMany({});
  await prisma.inventory.deleteMany({});
  await prisma.item.deleteMany({});
  await prisma.person.deleteMany({});
  await prisma.branch.deleteMany({});
  await prisma.tenant.deleteMany({});

  console.log('Creando tenant demo...');
  const tenant = await prisma.tenant.create({
    data: {
      slug: tenantSlug,
      name: 'Distribuidora San José',
      industry: 'DISTRIBUTION',
      modules: ['inventory', 'pos', 'distribution'],
      settings: { currency: 'NIO', timezone: 'America/Managua' },
    },
  });

  const branch = await prisma.branch.create({
    data: {
      tenantId: tenant.id,
      name: 'Sucursal Central Managua',
      address: 'Col. Los Robles, Distrito I, Managua',
    },
  });

  console.log(`Creando ${products.length} productos e inventario...`);
  const itemRecords: { id: string; price: number; name: string }[] = [];
  for (const p of products) {
    const item = await prisma.item.create({
      data: {
        tenantId: tenant.id,
        sku: p.sku,
        name: p.name,
        description: p.description,
        cost: p.cost,
        price: p.price,
        isService: false,
        attributes: {},
      },
    });
    await prisma.inventory.create({
      data: { tenantId: tenant.id, itemId: item.id, branchId: branch.id, stock: p.stock, minAlert: p.minAlert },
    });
    itemRecords.push({ id: item.id, price: p.price, name: p.name });
  }

  console.log('Creando proveedores...');
  const supplierRecords = [];
  for (const s of suppliers) {
    const supplier = await prisma.supplier.create({
      data: {
        tenantId: tenant.id,
        name: s.name,
        contactName: s.contactName,
        phone: s.phone,
        email: s.email,
        taxId: s.taxId,
        address: s.address,
        isActive: true,
      },
    });
    supplierRecords.push(supplier);
  }

  console.log('Creando órdenes de compra...');
  const poDefinitions = [
    { index: 0, orderNumber: 'PO-2026-001', status: 'RECEIVED', subtotal: 30434.78, taxAmount: 4565.22, total: 35000.0, receivedAt: new Date('2026-09-01T10:00:00Z'), notes: 'Recibido completo en bodega principal' },
    { index: 1, orderNumber: 'PO-2026-002', status: 'PENDING', subtotal: 16000.0, taxAmount: 2400.0, total: 18400.0, receivedAt: null, notes: 'Despacho programado para el viernes' },
    { index: 2, orderNumber: 'PO-2026-003', status: 'ORDERED', subtotal: 10869.57, taxAmount: 1630.43, total: 12500.0, receivedAt: new Date('2026-09-08T09:30:00Z'), notes: 'En tránsito desde bodega de distribución' },
  ];
  for (const po of poDefinitions) {
    await prisma.purchaseOrder.create({
      data: {
        tenantId: tenant.id,
        supplierId: supplierRecords[po.index].id,
        branchId: branch.id,
        orderNumber: po.orderNumber,
        status: po.status,
        subtotal: po.subtotal,
        taxAmount: po.taxAmount,
        total: po.total,
        notes: po.notes,
        receivedAt: po.receivedAt ?? new Date(),
      },
    });
  }

  console.log('Creando empleados (Person + Employee)...');
  for (const e of employees) {
    const person = await prisma.person.create({
      data: {
        tenantId: tenant.id,
        firstName: e.firstName,
        lastName: e.lastName,
        email: e.email,
        phone: e.phone,
        metadata: { department: e.department, commissionRate: e.commissionRate },
      },
    });
    await prisma.employee.create({
      data: {
        tenantId: tenant.id,
        personId: person.id,
        branchId: branch.id,
        position: e.role,
        salary: e.salary,
        hireDate: e.hireDate,
        isActive: e.isActive !== false,
      },
    });
  }
  const employeePerson = await prisma.employee.findFirst({
    where: { tenantId: tenant.id },
    orderBy: { hireDate: 'asc' },
  });

  console.log('Creando usuarios de acceso demo...');
  const adminPassword = await bcrypt.hash('Admin123!', 10);
  const staffPassword = await bcrypt.hash('Cajero123!', 10);
  const posPin = await bcrypt.hash('1234', 10);

  const adminPerson = await prisma.person.findFirst({ where: { tenantId: tenant.id, email: 'elena.torres@distribuidora.com.ni' } });
  const staffPerson = await prisma.person.findFirst({ where: { tenantId: tenant.id, email: 'kevin.mejia@distribuidora.com.ni' } });

  await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'admin@distribuidora-sanjose.com',
      passwordHash: adminPassword,
      role: 'TENANT_ADMIN',
      personId: adminPerson?.id ?? null,
    },
  });

  await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'cajero@distribuidora-sanjose.com',
      passwordHash: staffPassword,
      posPinHash: posPin,
      role: 'STAFF',
      personId: staffPerson?.id ?? null,
    },
  });

  console.log('Creando clientes...');
  const customerRecords = [];
  for (const c of customers) {
    const person = await prisma.person.create({
      data: {
        tenantId: tenant.id,
        firstName: c.firstName,
        lastName: c.lastName,
        documentId: c.documentId,
        metadata: {},
      },
    });
    customerRecords.push(person);
  }

  console.log('Creando tasas de impuesto...');
  for (const t of taxRates) {
    if (t.isDefault) {
      await prisma.taxRate.updateMany({
        where: { tenantId: tenant.id },
        data: { isDefault: false },
      });
    }
    await prisma.taxRate.create({
      data: { tenantId: tenant.id, name: t.name, rate: t.rate, isInclusive: t.isInclusive, isActive: true, isDefault: t.isDefault },
    });
  }

  console.log('Abriendo sesión de caja...');
  const cashSession = await prisma.cashSession.create({
    data: {
      tenantId: tenant.id,
      branchId: branch.id,
      employeeId: employeePerson?.id ?? null,
      openingAmount: 5000,
      status: 'OPEN',
    },
  });
  const movements = [
    { type: 'IN' as const, amount: 2000, concept: 'Fondo adicional gerencia' },
    { type: 'OUT' as const, amount: 800, concept: 'Pago a proveedor (adelanto)' },
    { type: 'OUT' as const, amount: 150, concept: 'Gastos de limpieza' },
  ];
  for (const m of movements) {
    await prisma.cashMovement.create({
      data: { tenantId: tenant.id, sessionId: cashSession.id, type: m.type, amount: m.amount, concept: m.concept },
    });
  }

  console.log('Generando ventas de los últimos 7 días...');
  let invoiceSeq = 1000;
  async function addSale(dayOffset: number, hour: number, lines: [number, number][], customerId?: string) {
    const saleAt = new Date();
    saleAt.setDate(saleAt.getDate() - dayOffset);
    saleAt.setHours(hour, Math.floor(Math.random() * 60), 0, 0);

    let subtotal = 0;
    for (const [idx, qty] of lines) {
      subtotal += itemRecords[idx].price * qty;
    }
    const total = Math.round(subtotal * 100) / 100;
    const taxAmount = Math.round((total - total / 1.15) * 100) / 100;

    const sale = await prisma.sale.create({
      data: {
        tenantId: tenant.id,
        personId: customerId ?? null,
        cashSessionId: dayOffset === 0 ? cashSession.id : null,
        subtotal,
        taxAmount,
        discount: 0,
        total,
        status: 'COMPLETED',
        invoiceNumber: `FAC-${invoiceSeq++}`,
      },
    });

    for (const [idx, qty] of lines) {
      await prisma.saleItem.create({
        data: {
          saleId: sale.id,
          itemId: itemRecords[idx].id,
          quantity: qty,
          price: itemRecords[idx].price,
        },
      });
    }
  }

  // Ventas de hoy (asociadas a la caja abierta)
  await addSale(0, 9, [[0, 4], [2, 2], [5, 3]], customerRecords[0].id);
  await addSale(0, 11, [[1, 5], [7, 3]]);
  await addSale(0, 14, [[3, 2], [8, 1]], customerRecords[1].id);
  await addSale(0, 16, [[4, 6], [9, 2]], customerRecords[3].id);

  // Ventas de días anteriores
  await addSale(1, 17, [[1, 4], [8, 2]], customerRecords[2].id);
  await addSale(1, 12, [[0, 6], [9, 1]]);
  await addSale(2, 15, [[3, 3], [5, 2], [7, 2]], customerRecords[0].id);
  await addSale(2, 10, [[4, 5], [1, 2]]);
  await addSale(3, 16, [[9, 3], [8, 1]], customerRecords[1].id);
  await addSale(3, 11, [[0, 8], [2, 4]]);
  await addSale(4, 14, [[1, 3], [4, 4]], customerRecords[3].id);
  await addSale(4, 9, [[7, 6], [6, 1]]);
  await addSale(5, 12, [[3, 4], [8, 2], [5, 3]], customerRecords[2].id);
  await addSale(5, 17, [[4, 7], [9, 1]]);
  await addSale(6, 10, [[0, 5], [1, 3]], customerRecords[0].id);
  await addSale(6, 15, [[2, 6], [7, 1], [8, 1]]);

  console.log('Seed completado:');
  console.log(`  - Tenant: ${tenant.slug}`);
  console.log(`  - Branch: ${branch.name}`);
  console.log(`  - Items + Inventory: ${products.length}`);
  console.log(`  - Proveedores: ${suppliers.length} | Órdenes de compra: ${poDefinitions.length}`);
  console.log(`  - Empleados: ${employees.length} | Clientes: ${customerRecords.length}`);
  console.log(`  - Tasas de impuesto: ${taxRates.length}`);
  console.log('  - Sesión de caja abierta + ventas de 7 días');
  console.log('  - Usuarios demo: admin@distribuidora-sanjose.com / Admin123!');
  console.log('  - Usuario POS: cajero@distribuidora-sanjose.com / PIN 1234');
}

main()
  .catch((e) => {
    console.error('Error en el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });