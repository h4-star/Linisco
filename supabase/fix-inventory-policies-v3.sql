-- =============================================
-- FIX V3: Solución completa para políticas RLS de Inventario
-- Ejecuta este script completo en Supabase SQL Editor
-- =============================================

-- Paso 1: Verificar que RLS esté habilitado
ALTER TABLE inventory_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_purchases ENABLE ROW LEVEL SECURITY;

-- Paso 2: Eliminar TODAS las políticas de INSERT existentes (por si hay duplicadas)
DROP POLICY IF EXISTS "Users can create products" ON inventory_products;
DROP POLICY IF EXISTS "Users can create purchases" ON inventory_purchases;

-- Paso 3: Crear políticas MUY simples y permisivas
-- Permitir a cualquier usuario autenticado crear productos
CREATE POLICY "Allow authenticated users to create products"
    ON inventory_products FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Permitir a cualquier usuario autenticado crear compras
CREATE POLICY "Allow authenticated users to create purchases"
    ON inventory_purchases FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Paso 4: Verificar las políticas creadas
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

-- Paso 5: Verificar que RLS está habilitado
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('inventory_products', 'inventory_purchases')
AND schemaname = 'public';
