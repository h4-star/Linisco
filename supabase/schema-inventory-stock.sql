-- =============================================
-- ESQUEMA: CONTROL DE INVENTARIO - EXISTENCIAS
-- Linisco Dashboard - Sistema de Control de Inventario
-- =============================================
-- INSTRUCCIONES:
-- 1. Ve a tu proyecto en supabase.com
-- 2. Ve a SQL Editor
-- 3. Copia y pega todo este contenido
-- 4. Ejecuta el script
-- =============================================

-- =============================================
-- TABLA: inventory_stock_snapshots (Existencias por fecha)
-- =============================================
CREATE TABLE IF NOT EXISTS inventory_stock_snapshots (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES inventory_products(id) ON DELETE CASCADE,
    
    -- Información del snapshot
    snapshot_date DATE NOT NULL, -- Fecha del inventario
    quantity DECIMAL(12, 4) NOT NULL DEFAULT 0, -- Cantidad en existencia
    unit_of_measure TEXT NOT NULL, -- Debe coincidir con la unidad del producto
    
    -- Local asociado
    shop_name TEXT NOT NULL,
    
    -- Información adicional
    notes TEXT, -- Notas sobre el inventario
    is_initial_stock BOOLEAN DEFAULT false, -- Indica si es el stock inicial del período
    
    -- Metadatos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Evitar duplicados: un producto solo puede tener un snapshot por fecha y local
    UNIQUE(product_id, snapshot_date, shop_name)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_inventory_stock_snapshots_user ON inventory_stock_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_stock_snapshots_product ON inventory_stock_snapshots(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_stock_snapshots_shop ON inventory_stock_snapshots(shop_name);
CREATE INDEX IF NOT EXISTS idx_inventory_stock_snapshots_date ON inventory_stock_snapshots(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_stock_snapshots_initial ON inventory_stock_snapshots(is_initial_stock);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Habilitar RLS
ALTER TABLE inventory_stock_snapshots ENABLE ROW LEVEL SECURITY;

-- =============================================
-- POLÍTICAS: inventory_stock_snapshots
-- =============================================

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Anyone can view stock snapshots" ON inventory_stock_snapshots;
DROP POLICY IF EXISTS "Anyone can create stock snapshots" ON inventory_stock_snapshots;
DROP POLICY IF EXISTS "Users can update own snapshots" ON inventory_stock_snapshots;
DROP POLICY IF EXISTS "Admins can update any snapshot" ON inventory_stock_snapshots;
DROP POLICY IF EXISTS "Admins can delete snapshots" ON inventory_stock_snapshots;

-- Todos los usuarios autenticados pueden ver snapshots
CREATE POLICY "Anyone can view stock snapshots"
    ON inventory_stock_snapshots FOR SELECT
    TO authenticated
    USING (true);

-- Todos los usuarios autenticados pueden crear snapshots
CREATE POLICY "Anyone can create stock snapshots"
    ON inventory_stock_snapshots FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Usuarios pueden actualizar sus propios snapshots
CREATE POLICY "Users can update own snapshots"
    ON inventory_stock_snapshots FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Admins pueden actualizar cualquier snapshot
CREATE POLICY "Admins can update any snapshot"
    ON inventory_stock_snapshots FOR UPDATE
    TO authenticated
    USING (public.is_admin_or_manager(auth.uid()));

-- Admins pueden eliminar snapshots
CREATE POLICY "Admins can delete snapshots"
    ON inventory_stock_snapshots FOR DELETE
    TO authenticated
    USING (public.is_admin_or_manager(auth.uid()));

-- =============================================
-- TRIGGERS
-- =============================================

-- Trigger para actualizar updated_at
DROP TRIGGER IF EXISTS update_inventory_stock_snapshots_updated_at ON inventory_stock_snapshots;
CREATE TRIGGER update_inventory_stock_snapshots_updated_at
    BEFORE UPDATE ON inventory_stock_snapshots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- VISTAS ÚTILES
-- =============================================

-- Vista: Utilización de productos por período
CREATE OR REPLACE VIEW product_utilization AS
SELECT 
    p.id as product_id,
    p.name,
    p.shop_name,
    p.unit_of_measure,
    
    -- Stock inicial (último snapshot antes del período o el más reciente)
    COALESCE(
        (SELECT quantity 
         FROM inventory_stock_snapshots 
         WHERE product_id = p.id 
         AND shop_name = p.shop_name
         AND is_initial_stock = true
         ORDER BY snapshot_date DESC 
         LIMIT 1),
        0
    ) as initial_stock,
    
    -- Compras del período (últimos 30 días por defecto)
    COALESCE(
        (SELECT SUM(quantity)
         FROM inventory_purchases
         WHERE product_id = p.id
         AND shop_name = p.shop_name
         AND purchase_date >= CURRENT_DATE - INTERVAL '30 days'),
        0
    ) as purchases_last_30_days,
    
    -- Compras totales (todas las compras)
    COALESCE(
        (SELECT SUM(quantity)
         FROM inventory_purchases
         WHERE product_id = p.id
         AND shop_name = p.shop_name),
        0
    ) as total_purchases,
    
    -- Stock actual calculado (stock inicial + compras totales)
    COALESCE(
        (SELECT quantity 
         FROM inventory_stock_snapshots 
         WHERE product_id = p.id 
         AND shop_name = p.shop_name
         AND is_initial_stock = true
         ORDER BY snapshot_date DESC 
         LIMIT 1),
        0
    ) + COALESCE(
        (SELECT SUM(quantity)
         FROM inventory_purchases
         WHERE product_id = p.id
         AND shop_name = p.shop_name),
        0
    ) as calculated_current_stock,
    
    -- Utilización del período (compras del período / días del período)
    CASE 
        WHEN COALESCE(
            (SELECT SUM(quantity)
             FROM inventory_purchases
             WHERE product_id = p.id
             AND shop_name = p.shop_name
             AND purchase_date >= CURRENT_DATE - INTERVAL '30 days'),
            0
        ) > 0 THEN
            COALESCE(
                (SELECT SUM(quantity)
                 FROM inventory_purchases
                 WHERE product_id = p.id
                 AND shop_name = p.shop_name
                 AND purchase_date >= CURRENT_DATE - INTERVAL '30 days'),
                0
            ) / 30.0
        ELSE 0
    END as daily_utilization_avg
    
FROM inventory_products p
WHERE p.is_active = true;

-- =============================================
-- COMENTARIOS
-- =============================================
COMMENT ON TABLE inventory_stock_snapshots IS 'Snapshots de existencias de inventario por fecha';
COMMENT ON COLUMN inventory_stock_snapshots.snapshot_date IS 'Fecha del inventario/existencia';
COMMENT ON COLUMN inventory_stock_snapshots.is_initial_stock IS 'Indica si este es el stock inicial del período de análisis';
COMMENT ON COLUMN inventory_stock_snapshots.quantity IS 'Cantidad en existencia en la fecha del snapshot';
