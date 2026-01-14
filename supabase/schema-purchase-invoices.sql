-- =============================================
-- ESQUEMA: FACTURAS DE COMPRA
-- Linisco Dashboard - Sistema de Facturas de Compra
-- =============================================
-- INSTRUCCIONES:
-- 1. Ve a tu proyecto en supabase.com
-- 2. Ve a SQL Editor
-- 3. Copia y pega todo este contenido
-- 4. Ejecuta el script
-- =============================================

-- =============================================
-- TABLA: purchase_invoices (Facturas de compra)
-- =============================================
CREATE TABLE IF NOT EXISTS purchase_invoices (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    
    -- Información básica de la factura
    invoice_number TEXT NOT NULL,
    invoice_date DATE NOT NULL,
    supplier_name TEXT,
    supplier_cuit TEXT,
    
    -- Montos (subtotal obligatorio, impuestos opcionales)
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
    iva DECIMAL(12, 2), -- IVA (opcional)
    internal_taxes DECIMAL(12, 2), -- Impuestos internos (opcional)
    total DECIMAL(12, 2) NOT NULL DEFAULT 0, -- Total calculado
    
    -- Información adicional
    shop_name TEXT, -- Local asociado (opcional)
    notes TEXT, -- Notas adicionales
    attachment_url TEXT, -- URL de imagen/PDF de la factura (opcional)
    
    -- Metadatos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Evitar facturas duplicadas (mismo número y fecha)
    UNIQUE(invoice_number, invoice_date)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_user ON purchase_invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_date ON purchase_invoices(invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_shop ON purchase_invoices(shop_name);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_supplier ON purchase_invoices(supplier_name);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_number ON purchase_invoices(invoice_number);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Habilitar RLS
ALTER TABLE purchase_invoices ENABLE ROW LEVEL SECURITY;

-- =============================================
-- POLÍTICAS: purchase_invoices
-- =============================================

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Users can view own invoices" ON purchase_invoices;
DROP POLICY IF EXISTS "Admins can view all invoices" ON purchase_invoices;
DROP POLICY IF EXISTS "Users can create invoices" ON purchase_invoices;
DROP POLICY IF EXISTS "Users can update own invoices" ON purchase_invoices;
DROP POLICY IF EXISTS "Admins can update any invoice" ON purchase_invoices;
DROP POLICY IF EXISTS "Admins can delete invoices" ON purchase_invoices;

-- Usuarios pueden ver sus propias facturas
CREATE POLICY "Users can view own invoices"
    ON purchase_invoices FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Admins pueden ver todas las facturas
CREATE POLICY "Admins can view all invoices"
    ON purchase_invoices FOR SELECT
    TO authenticated
    USING (public.is_admin_or_manager(auth.uid()));

-- Usuarios pueden crear facturas
CREATE POLICY "Users can create invoices"
    ON purchase_invoices FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Usuarios pueden actualizar sus propias facturas
CREATE POLICY "Users can update own invoices"
    ON purchase_invoices FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Admins pueden actualizar cualquier factura
CREATE POLICY "Admins can update any invoice"
    ON purchase_invoices FOR UPDATE
    TO authenticated
    USING (public.is_admin_or_manager(auth.uid()));

-- Admins pueden eliminar facturas
CREATE POLICY "Admins can delete invoices"
    ON purchase_invoices FOR DELETE
    TO authenticated
    USING (public.is_admin_or_manager(auth.uid()));

-- =============================================
-- TRIGGERS
-- =============================================

-- Trigger para calcular el total automáticamente
CREATE OR REPLACE FUNCTION calculate_purchase_invoice_total()
RETURNS TRIGGER AS $$
BEGIN
    -- Calcular total: subtotal + iva (si existe) + impuestos internos (si existe)
    NEW.total := NEW.subtotal 
        + COALESCE(NEW.iva, 0) 
        + COALESCE(NEW.internal_taxes, 0);
    
    -- Actualizar updated_at
    NEW.updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger antes de insertar o actualizar
DROP TRIGGER IF EXISTS trigger_calculate_purchase_invoice_total ON purchase_invoices;
CREATE TRIGGER trigger_calculate_purchase_invoice_total
    BEFORE INSERT OR UPDATE ON purchase_invoices
    FOR EACH ROW
    EXECUTE FUNCTION calculate_purchase_invoice_total();

-- Trigger para actualizar updated_at
DROP TRIGGER IF EXISTS update_purchase_invoices_updated_at ON purchase_invoices;
CREATE TRIGGER update_purchase_invoices_updated_at
    BEFORE UPDATE ON purchase_invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- COMENTARIOS
-- =============================================
COMMENT ON TABLE purchase_invoices IS 'Facturas de compra cargadas por empleados y administradores';
COMMENT ON COLUMN purchase_invoices.subtotal IS 'Subtotal de la factura (obligatorio)';
COMMENT ON COLUMN purchase_invoices.iva IS 'IVA de la factura (opcional)';
COMMENT ON COLUMN purchase_invoices.internal_taxes IS 'Impuestos internos (opcional)';
COMMENT ON COLUMN purchase_invoices.total IS 'Total calculado automáticamente (subtotal + iva + impuestos internos)';
