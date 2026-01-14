-- =============================================
-- FIX V2: Políticas RLS más permisivas para Inventario
-- Ejecuta este script en Supabase SQL Editor
-- =============================================

-- Eliminar TODAS las políticas existentes de INSERT
DROP POLICY IF EXISTS "Users can create products" ON inventory_products;
DROP POLICY IF EXISTS "Users can create purchases" ON inventory_purchases;

-- Crear políticas MUY permisivas temporalmente para debugging
-- Cualquier usuario autenticado puede crear productos (sin verificar user_id)
CREATE POLICY "Users can create products"
    ON inventory_products FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Cualquier usuario autenticado puede crear compras (sin verificar user_id)
CREATE POLICY "Users can create purchases"
    ON inventory_purchases FOR INSERT
    TO authenticated
    WITH CHECK (true);

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
AND cmd = 'INSERT'
ORDER BY tablename, policyname;
