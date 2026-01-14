-- =============================================
-- ESQUEMA: INVENTARIO
-- Linisco Dashboard - Sistema de Inventario
-- =============================================
-- INSTRUCCIONES:
-- 1. Ve a tu proyecto en supabase.com
-- 2. Ve a SQL Editor
-- 3. Copia y pega todo este contenido
-- 4. Ejecuta el script
-- =============================================

-- =============================================
-- TABLA: inventory_products (Productos del inventario)
-- =============================================
CREATE TABLE IF NOT EXISTS inventory_products (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    
    -- Información del producto
    name TEXT NOT NULL,
    unit_of_measure TEXT NOT NULL, -- kg, litros, unidades, cajas, etc.
    category TEXT, -- Categoría opcional (ej: "Insumos", "Bebidas", "Limpieza")
    description TEXT,
    
    -- Local asociado
    shop_name TEXT NOT NULL,
    
    -- Estado
    is_active BOOLEAN DEFAULT true,
    
    -- Metadatos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Evitar productos duplicados en el mismo local
    UNIQUE(name, shop_name)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_inventory_products_user ON inventory_products(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_products_shop ON inventory_products(shop_name);
CREATE INDEX IF NOT EXISTS idx_inventory_products_name ON inventory_products(name);
CREATE INDEX IF NOT EXISTS idx_inventory_products_active ON inventory_products(is_active);

-- =============================================
-- TABLA: inventory_purchases (Compras de inventario)
-- =============================================
CREATE TABLE IF NOT EXISTS inventory_purchases (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES inventory_products(id) ON DELETE CASCADE,
    
    -- Información de la compra
    purchase_date DATE NOT NULL,
    quantity DECIMAL(12, 4) NOT NULL DEFAULT 0,
    unit_of_measure TEXT NOT NULL, -- Debe coincidir con la unidad del producto
    unit_price DECIMAL(12, 2), -- Precio por unidad (opcional, para referencia)
    total_amount DECIMAL(12, 2), -- Total de la compra (opcional)
    
    -- Local asociado
    shop_name TEXT NOT NULL,
    
    -- Información adicional
    supplier_name TEXT,
    invoice_number TEXT, -- Número de factura relacionada (opcional)
    notes TEXT,
    
    -- Metadatos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_inventory_purchases_user ON inventory_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_purchases_product ON inventory_purchases(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_purchases_shop ON inventory_purchases(shop_name);
CREATE INDEX IF NOT EXISTS idx_inventory_purchases_date ON inventory_purchases(purchase_date DESC);

-- =============================================
-- TABLA: product_prices (Precios de productos)
-- =============================================
CREATE TABLE IF NOT EXISTS product_prices (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES inventory_products(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    
    -- Información del precio
    price DECIMAL(12, 2) NOT NULL,
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_current BOOLEAN DEFAULT true, -- Solo un precio puede ser actual por producto
    
    -- Metadatos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_product_prices_product ON product_prices(product_id);
CREATE INDEX IF NOT EXISTS idx_product_prices_current ON product_prices(is_current);
CREATE INDEX IF NOT EXISTS idx_product_prices_date ON product_prices(effective_date DESC);

-- Trigger para asegurar que solo un precio sea actual por producto
CREATE OR REPLACE FUNCTION set_single_current_price()
RETURNS TRIGGER AS $$
BEGIN
    -- Si se marca un precio como actual, desmarcar los demás del mismo producto
    IF NEW.is_current = true THEN
        UPDATE product_prices
        SET is_current = false
        WHERE product_id = NEW.product_id
        AND id != NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_single_current_price ON product_prices;
CREATE TRIGGER trigger_set_single_current_price
    BEFORE INSERT OR UPDATE ON product_prices
    FOR EACH ROW
    EXECUTE FUNCTION set_single_current_price();

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Habilitar RLS
ALTER TABLE inventory_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_prices ENABLE ROW LEVEL SECURITY;

-- =============================================
-- POLÍTICAS: inventory_products
-- =============================================

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Users can view products in assigned shops" ON inventory_products;
DROP POLICY IF EXISTS "Admins can view all products" ON inventory_products;
DROP POLICY IF EXISTS "Users can create products" ON inventory_products;
DROP POLICY IF EXISTS "Users can update own products" ON inventory_products;
DROP POLICY IF EXISTS "Admins can update any product" ON inventory_products;
DROP POLICY IF EXISTS "Admins can delete products" ON inventory_products;

-- Usuarios pueden ver productos de sus locales asignados
CREATE POLICY "Users can view products in assigned shops"
    ON inventory_products FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND assigned_shops @> ARRAY[shop_name]
        )
        OR public.is_admin_or_manager(auth.uid())
    );

-- Admins pueden ver todos los productos
CREATE POLICY "Admins can view all products"
    ON inventory_products FOR SELECT
    TO authenticated
    USING (public.is_admin_or_manager(auth.uid()));

-- Usuarios pueden crear productos (cualquier usuario autenticado puede crear)
CREATE POLICY "Users can create products"
    ON inventory_products FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Usuarios pueden actualizar productos que crearon
CREATE POLICY "Users can update own products"
    ON inventory_products FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Admins pueden actualizar cualquier producto
CREATE POLICY "Admins can update any product"
    ON inventory_products FOR UPDATE
    TO authenticated
    USING (public.is_admin_or_manager(auth.uid()));

-- Admins pueden eliminar productos
CREATE POLICY "Admins can delete products"
    ON inventory_products FOR DELETE
    TO authenticated
    USING (public.is_admin_or_manager(auth.uid()));

-- =============================================
-- POLÍTICAS: inventory_purchases
-- =============================================

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Users can view purchases in assigned shops" ON inventory_purchases;
DROP POLICY IF EXISTS "Admins can view all purchases" ON inventory_purchases;
DROP POLICY IF EXISTS "Users can create purchases" ON inventory_purchases;
DROP POLICY IF EXISTS "Users can update own purchases" ON inventory_purchases;
DROP POLICY IF EXISTS "Admins can update any purchase" ON inventory_purchases;
DROP POLICY IF EXISTS "Admins can delete purchases" ON inventory_purchases;

-- Usuarios pueden ver compras de sus locales asignados
CREATE POLICY "Users can view purchases in assigned shops"
    ON inventory_purchases FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND assigned_shops @> ARRAY[shop_name]
        )
        OR public.is_admin_or_manager(auth.uid())
    );

-- Admins pueden ver todas las compras
CREATE POLICY "Admins can view all purchases"
    ON inventory_purchases FOR SELECT
    TO authenticated
    USING (public.is_admin_or_manager(auth.uid()));

-- Usuarios pueden crear compras (cualquier usuario autenticado puede crear)
CREATE POLICY "Users can create purchases"
    ON inventory_purchases FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Usuarios pueden actualizar compras que crearon
CREATE POLICY "Users can update own purchases"
    ON inventory_purchases FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Admins pueden actualizar cualquier compra
CREATE POLICY "Admins can update any purchase"
    ON inventory_purchases FOR UPDATE
    TO authenticated
    USING (public.is_admin_or_manager(auth.uid()));

-- Admins pueden eliminar compras
CREATE POLICY "Admins can delete purchases"
    ON inventory_purchases FOR DELETE
    TO authenticated
    USING (public.is_admin_or_manager(auth.uid()));

-- =============================================
-- POLÍTICAS: product_prices
-- =============================================

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Users can view prices" ON product_prices;
DROP POLICY IF EXISTS "Admins can manage prices" ON product_prices;

-- Todos los usuarios autenticados pueden ver precios
CREATE POLICY "Users can view prices"
    ON product_prices FOR SELECT
    TO authenticated
    USING (true);

-- Solo admins pueden gestionar precios
CREATE POLICY "Admins can manage prices"
    ON product_prices FOR ALL
    TO authenticated
    USING (public.is_admin_or_manager(auth.uid()));

-- =============================================
-- TRIGGERS
-- =============================================

-- Trigger para actualizar updated_at
DROP TRIGGER IF EXISTS update_inventory_products_updated_at ON inventory_products;
CREATE TRIGGER update_inventory_products_updated_at
    BEFORE UPDATE ON inventory_products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_inventory_purchases_updated_at ON inventory_purchases;
CREATE TRIGGER update_inventory_purchases_updated_at
    BEFORE UPDATE ON inventory_purchases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_product_prices_updated_at ON product_prices;
CREATE TRIGGER update_product_prices_updated_at
    BEFORE UPDATE ON product_prices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- VISTAS ÚTILES
-- =============================================

-- Vista: Inventario con precios actuales y stock calculado
CREATE OR REPLACE VIEW inventory_with_prices AS
SELECT 
    p.id,
    p.name,
    p.unit_of_measure,
    p.category,
    p.shop_name,
    p.is_active,
    pp.price as current_price,
    pp.effective_date as price_date,
    -- Stock total (suma de todas las compras)
    COALESCE(SUM(pur.quantity), 0) as total_stock,
    -- Valor total del inventario (stock * precio)
    COALESCE(SUM(pur.quantity) * pp.price, 0) as total_value,
    p.created_at,
    p.updated_at
FROM inventory_products p
LEFT JOIN product_prices pp ON p.id = pp.product_id AND pp.is_current = true
LEFT JOIN inventory_purchases pur ON p.id = pur.product_id
WHERE p.is_active = true
GROUP BY p.id, p.name, p.unit_of_measure, p.category, p.shop_name, p.is_active, pp.price, pp.effective_date, p.created_at, p.updated_at;

-- Vista: Consumo semanal por producto
CREATE OR REPLACE VIEW weekly_consumption AS
SELECT 
    p.id as product_id,
    p.name,
    p.shop_name,
    p.unit_of_measure,
    -- Compras de la última semana
    SUM(CASE 
        WHEN pur.purchase_date >= CURRENT_DATE - INTERVAL '7 days' 
        THEN pur.quantity 
        ELSE 0 
    END) as consumption_last_week,
    -- Compras del mes actual
    SUM(CASE 
        WHEN pur.purchase_date >= DATE_TRUNC('month', CURRENT_DATE)
        THEN pur.quantity 
        ELSE 0 
    END) as consumption_this_month,
    -- Total de compras
    SUM(pur.quantity) as total_purchased
FROM inventory_products p
LEFT JOIN inventory_purchases pur ON p.id = pur.product_id
WHERE p.is_active = true
GROUP BY p.id, p.name, p.shop_name, p.unit_of_measure;

-- =============================================
-- COMENTARIOS
-- =============================================
COMMENT ON TABLE inventory_products IS 'Productos del inventario por local';
COMMENT ON TABLE inventory_purchases IS 'Compras de productos de inventario';
COMMENT ON TABLE product_prices IS 'Precios de productos para cálculo de valor de inventario';
COMMENT ON COLUMN inventory_products.unit_of_measure IS 'Unidad de medida: kg, litros, unidades, cajas, etc.';
COMMENT ON COLUMN inventory_purchases.quantity IS 'Cantidad comprada en la unidad de medida del producto';
COMMENT ON COLUMN product_prices.is_current IS 'Indica si este es el precio actual del producto';
