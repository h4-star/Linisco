-- =============================================
-- ESQUEMA DE BASE DE DATOS SUPABASE v2
-- Linisco Dashboard - Ventas POS
-- =============================================
-- INSTRUCCIONES:
-- 1. Ve a tu proyecto en supabase.com
-- 2. Ve a SQL Editor
-- 3. Copia y pega todo este contenido
-- 4. Ejecuta el script
-- =============================================

-- Eliminar tablas existentes
DROP TABLE IF EXISTS sale_products CASCADE;
DROP TABLE IF EXISTS sale_orders CASCADE;
DROP TABLE IF EXISTS psessions CASCADE;

-- =============================================
-- TABLA: sale_orders (Órdenes de venta)
-- Incluye todas las columnas que puede devolver la API
-- =============================================
CREATE TABLE sale_orders (
    id BIGSERIAL PRIMARY KEY,
    "idSaleOrder" TEXT UNIQUE,
    "idCustomer" TEXT,
    number INTEGER DEFAULT 0,
    total DECIMAL(12, 2) DEFAULT 0,
    subtotal DECIMAL(12, 2) DEFAULT 0,
    discount DECIMAL(12, 2) DEFAULT 0,
    tax DECIMAL(12, 2) DEFAULT 0,
    tip DECIMAL(12, 2) DEFAULT 0,
    "orderDate" TEXT,
    "shopNumber" TEXT,
    "shopName" TEXT,
    paymentmethod TEXT,
    status TEXT,
    customer TEXT,
    notes TEXT,
    source TEXT,
    channel TEXT,
    "tableNumber" TEXT,
    "orderType" TEXT,
    "deliveryAddress" TEXT,
    "createdAt" TEXT,
    "updatedAt" TEXT,
    -- Columna JSONB para guardar cualquier campo extra
    extra_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sale_orders_shop ON sale_orders("shopName");
CREATE INDEX idx_sale_orders_date ON sale_orders("orderDate");
CREATE INDEX idx_sale_orders_id ON sale_orders("idSaleOrder");

-- =============================================
-- TABLA: sale_products (Productos vendidos)
-- =============================================
CREATE TABLE sale_products (
    id BIGSERIAL PRIMARY KEY,
    "idSaleOrder" TEXT,
    "idProduct" TEXT,
    "idControlSheetDef" TEXT,
    name TEXT,
    fixed_name TEXT,
    category TEXT,
    quantity DECIMAL(12, 4) DEFAULT 1,
    price DECIMAL(12, 2) DEFAULT 0,
    total DECIMAL(12, 2) DEFAULT 0,
    discount DECIMAL(12, 2) DEFAULT 0,
    notes TEXT,
    modifiers TEXT,
    "shopName" TEXT,
    extra_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sale_products_order ON sale_products("idSaleOrder");
CREATE INDEX idx_sale_products_shop ON sale_products("shopName");
CREATE INDEX idx_sale_products_name ON sale_products(name);

-- Constraint UNIQUE para evitar duplicados y permitir upsert
ALTER TABLE sale_products ADD CONSTRAINT unique_sale_product UNIQUE ("idSaleOrder", "idProduct");

-- =============================================
-- TABLA: psessions (Sesiones de caja)
-- =============================================
CREATE TABLE psessions (
    id BIGSERIAL PRIMARY KEY,
    "idSession" TEXT,
    "shopName" TEXT,
    date TEXT,
    "openingDate" TEXT,
    "closingDate" TEXT,
    cash DECIMAL(12, 2) DEFAULT 0,
    "openingCash" DECIMAL(12, 2) DEFAULT 0,
    "closingCash" DECIMAL(12, 2) DEFAULT 0,
    "totalSales" DECIMAL(12, 2) DEFAULT 0,
    "totalCash" DECIMAL(12, 2) DEFAULT 0,
    "totalCard" DECIMAL(12, 2) DEFAULT 0,
    "totalOther" DECIMAL(12, 2) DEFAULT 0,
    cc_visa DECIMAL(12, 2) DEFAULT 0,
    cc_master DECIMAL(12, 2) DEFAULT 0,
    cc_amex DECIMAL(12, 2) DEFAULT 0,
    cc_other DECIMAL(12, 2) DEFAULT 0,
    dc_visa DECIMAL(12, 2) DEFAULT 0,
    dc_master DECIMAL(12, 2) DEFAULT 0,
    dc_maestro DECIMAL(12, 2) DEFAULT 0,
    dc_other DECIMAL(12, 2) DEFAULT 0,
    mercadopago DECIMAL(12, 2) DEFAULT 0,
    difference DECIMAL(12, 2) DEFAULT 0,
    status TEXT,
    notes TEXT,
    extra_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_psessions_shop ON psessions("shopName");
CREATE INDEX idx_psessions_date ON psessions(date);

-- Constraint UNIQUE para evitar duplicados y permitir upsert
ALTER TABLE psessions ADD CONSTRAINT unique_session UNIQUE ("idSession");

-- =============================================
-- ROW LEVEL SECURITY (RLS) - Permitir todo
-- =============================================
ALTER TABLE sale_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE psessions ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas
CREATE POLICY "Allow all on sale_orders" ON sale_orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on sale_products" ON sale_products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on psessions" ON psessions FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- VISTAS
-- =============================================
CREATE OR REPLACE VIEW ventas_por_local AS
SELECT 
    "shopName",
    COUNT(*) as total_tickets,
    SUM(total) as total_ventas,
    SUM(total) / 1.21 as total_sin_iva,
    AVG(total) as ticket_promedio,
    SUM(CASE WHEN number = 0 THEN total ELSE 0 END) as ventas_sin_facturar
FROM sale_orders
GROUP BY "shopName";

