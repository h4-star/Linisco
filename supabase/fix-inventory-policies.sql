-- =============================================
-- FIX: Políticas RLS para Inventario
-- Ejecuta este script en Supabase SQL Editor
-- =============================================

-- Eliminar políticas existentes de INSERT
DROP POLICY IF EXISTS "Users can create products" ON inventory_products;
DROP POLICY IF EXISTS "Users can create purchases" ON inventory_purchases;

-- Crear políticas simplificadas para INSERT
-- Cualquier usuario autenticado puede crear productos
CREATE POLICY "Users can create products"
    ON inventory_products FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Cualquier usuario autenticado puede crear compras
CREATE POLICY "Users can create purchases"
    ON inventory_purchases FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Verificar que las políticas se crearon correctamente
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename IN ('inventory_products', 'inventory_purchases')
ORDER BY tablename, policyname;
