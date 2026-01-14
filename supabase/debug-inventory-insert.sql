-- =============================================
-- DEBUG: Verificar políticas y permisos de Inventario
-- Ejecuta este script para diagnosticar el problema
-- =============================================

-- 1. Verificar que RLS está habilitado
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('inventory_products', 'inventory_purchases')
AND schemaname = 'public';

-- 2. Ver TODAS las políticas de inventory_products
SELECT 
    policyname,
    cmd,
    permissive,
    roles,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'inventory_products'
ORDER BY cmd, policyname;

-- 3. Ver TODAS las políticas de inventory_purchases
SELECT 
    policyname,
    cmd,
    permissive,
    roles,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'inventory_purchases'
ORDER BY cmd, policyname;

-- 4. Verificar que las funciones helper existen
SELECT 
    proname as function_name,
    prosrc as function_body
FROM pg_proc
WHERE proname IN ('is_admin_or_manager', 'is_admin_user')
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 5. Verificar estructura de la tabla
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'inventory_products'
AND table_schema = 'public'
ORDER BY ordinal_position;
