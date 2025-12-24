-- =============================================
-- ESQUEMA DE BASE DE DATOS SUPABASE
-- Linisco Dashboard - Ventas POS
-- =============================================
-- INSTRUCCIONES:
-- 1. Ve a tu proyecto en supabase.com
-- 2. Ve a SQL Editor
-- 3. Copia y pega todo este contenido
-- 4. Ejecuta el script
-- =============================================

-- Habilitar extensión UUID si no existe
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- ELIMINAR TABLAS EXISTENTES (para recrear)
-- =============================================
DROP TABLE IF EXISTS sale_products CASCADE;
DROP TABLE IF EXISTS sale_orders CASCADE;
DROP TABLE IF EXISTS psessions CASCADE;

-- =============================================
-- TABLA: sale_orders (Órdenes de venta)
-- =============================================
CREATE TABLE sale_orders (
    id BIGSERIAL PRIMARY KEY,
    "idSaleOrder" TEXT UNIQUE NOT NULL,
    number INTEGER DEFAULT 0,
    total DECIMAL(12, 2) NOT NULL DEFAULT 0,
    subtotal DECIMAL(12, 2) DEFAULT 0,
    discount DECIMAL(12, 2) DEFAULT 0,
    tax DECIMAL(12, 2) DEFAULT 0,
    tip DECIMAL(12, 2) DEFAULT 0,
    "orderDate" TIMESTAMP WITH TIME ZONE,
    "shopNumber" TEXT,
    "shopName" TEXT,
    paymentmethod TEXT,
    status TEXT,
    customer TEXT,
    notes TEXT,
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para búsquedas frecuentes
CREATE INDEX idx_sale_orders_shop ON sale_orders("shopName");
CREATE INDEX idx_sale_orders_date ON sale_orders("orderDate");
CREATE INDEX idx_sale_orders_shop_date ON sale_orders("shopName", "orderDate");

-- =============================================
-- TABLA: sale_products (Productos vendidos)
-- =============================================
CREATE TABLE sale_products (
    id BIGSERIAL PRIMARY KEY,
    "idSaleOrder" TEXT,
    "idProduct" TEXT,
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_sale_products_order ON sale_products("idSaleOrder");
CREATE INDEX idx_sale_products_shop ON sale_products("shopName");
CREATE INDEX idx_sale_products_name ON sale_products(name);

-- =============================================
-- TABLA: psessions (Sesiones de caja)
-- =============================================
CREATE TABLE psessions (
    id BIGSERIAL PRIMARY KEY,
    "idSession" TEXT,
    "shopName" TEXT,
    date DATE,
    "openingDate" TIMESTAMP WITH TIME ZONE,
    "closingDate" TIMESTAMP WITH TIME ZONE,
    cash DECIMAL(12, 2) DEFAULT 0,
    "openingCash" DECIMAL(12, 2) DEFAULT 0,
    "closingCash" DECIMAL(12, 2) DEFAULT 0,
    "totalSales" DECIMAL(12, 2) DEFAULT 0,
    "totalCash" DECIMAL(12, 2) DEFAULT 0,
    "totalCard" DECIMAL(12, 2) DEFAULT 0,
    "totalOther" DECIMAL(12, 2) DEFAULT 0,
    difference DECIMAL(12, 2) DEFAULT 0,
    status TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_psessions_shop ON psessions("shopName");
CREATE INDEX idx_psessions_date ON psessions(date);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Habilitar RLS en todas las tablas
ALTER TABLE sale_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE psessions ENABLE ROW LEVEL SECURITY;

-- Política para lectura pública (dashboard) - SELECT
CREATE POLICY "Permitir lectura pública de sale_orders"
    ON sale_orders FOR SELECT
    USING (true);

CREATE POLICY "Permitir lectura pública de sale_products"
    ON sale_products FOR SELECT
    USING (true);

CREATE POLICY "Permitir lectura pública de psessions"
    ON psessions FOR SELECT
    USING (true);

-- Política para INSERT (anon y service_role)
CREATE POLICY "Insertar sale_orders"
    ON sale_orders FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Insertar sale_products"
    ON sale_products FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Insertar psessions"
    ON psessions FOR INSERT
    WITH CHECK (true);

-- Política para UPDATE
CREATE POLICY "Actualizar sale_orders"
    ON sale_orders FOR UPDATE
    USING (true);

CREATE POLICY "Actualizar sale_products"
    ON sale_products FOR UPDATE
    USING (true);

CREATE POLICY "Actualizar psessions"
    ON psessions FOR UPDATE
    USING (true);

-- =============================================
-- FUNCIÓN: Actualizar timestamp updated_at
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para sale_orders
DROP TRIGGER IF EXISTS update_sale_orders_updated_at ON sale_orders;
CREATE TRIGGER update_sale_orders_updated_at
    BEFORE UPDATE ON sale_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- VISTAS ÚTILES
-- =============================================

-- Vista: Resumen de ventas por local
CREATE OR REPLACE VIEW ventas_por_local AS
SELECT 
    "shopName",
    COUNT(*) as total_tickets,
    SUM(total) as total_ventas,
    SUM(total) / 1.21 as total_sin_iva,
    AVG(total) as ticket_promedio,
    SUM(CASE WHEN number = 0 THEN total ELSE 0 END) as ventas_sin_facturar,
    SUM(CASE WHEN number = 0 THEN 1 ELSE 0 END) as tickets_sin_facturar
FROM sale_orders
GROUP BY "shopName";

-- Vista: Ventas por hora
CREATE OR REPLACE VIEW ventas_por_hora AS
SELECT 
    "shopName",
    EXTRACT(HOUR FROM "orderDate") as hora,
    COUNT(*) as tickets,
    SUM(total) as total
FROM sale_orders
GROUP BY "shopName", EXTRACT(HOUR FROM "orderDate")
ORDER BY hora;

-- Vista: Productos más vendidos
CREATE OR REPLACE VIEW productos_top AS
SELECT 
    COALESCE(fixed_name, name) as producto,
    SUM(quantity) as cantidad_total,
    SUM(total) as venta_total,
    COUNT(DISTINCT "idSaleOrder") as en_tickets
FROM sale_products
GROUP BY COALESCE(fixed_name, name)
ORDER BY venta_total DESC;

-- =============================================
-- COMENTARIOS DE DOCUMENTACIÓN
-- =============================================
COMMENT ON TABLE sale_orders IS 'Órdenes de venta del sistema POS Linisco';
COMMENT ON TABLE sale_products IS 'Productos vendidos en cada orden';
COMMENT ON TABLE psessions IS 'Sesiones de caja (apertura/cierre)';

COMMENT ON COLUMN sale_orders.number IS 'Número de factura (0 = sin facturar)';
COMMENT ON COLUMN sale_orders."shopNumber" IS 'Código del local en el sistema POS';
COMMENT ON COLUMN sale_orders."shopName" IS 'Nombre legible del local';
