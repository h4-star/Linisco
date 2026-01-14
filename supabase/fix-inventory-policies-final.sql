-- =============================================
-- FIX FINAL: Solución definitiva para políticas RLS
-- Ejecuta este script COMPLETO en Supabase SQL Editor
-- =============================================

-- PASO 1: Eliminar TODAS las políticas existentes (sin excepciones)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Eliminar todas las políticas de inventory_products
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'inventory_products') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON inventory_products', r.policyname);
    END LOOP;
    
    -- Eliminar todas las políticas de inventory_purchases
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'inventory_purchases') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON inventory_purchases', r.policyname);
    END LOOP;
END $$;

-- PASO 2: Verificar que se eliminaron todas
SELECT 'Políticas restantes de inventory_products:' as info;
SELECT policyname FROM pg_policies WHERE tablename = 'inventory_products';

SELECT 'Políticas restantes de inventory_purchases:' as info;
SELECT policyname FROM pg_policies WHERE tablename = 'inventory_purchases';

-- PASO 3: Crear políticas MUY simples desde cero

-- SELECT: Todos los usuarios autenticados pueden ver productos
CREATE POLICY "Anyone can view products"
    ON inventory_products FOR SELECT
    TO authenticated
    USING (true);

-- INSERT: Todos los usuarios autenticados pueden crear productos
CREATE POLICY "Anyone can create products"
    ON inventory_products FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- UPDATE: Usuarios pueden actualizar sus propios productos, admins pueden actualizar todos
CREATE POLICY "Users can update own products"
    ON inventory_products FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update any product"
    ON inventory_products FOR UPDATE
    TO authenticated
    USING (public.is_admin_or_manager(auth.uid()));

-- DELETE: Solo admins pueden eliminar
CREATE POLICY "Admins can delete products"
    ON inventory_products FOR DELETE
    TO authenticated
    USING (public.is_admin_or_manager(auth.uid()));

-- SELECT: Todos los usuarios autenticados pueden ver compras
CREATE POLICY "Anyone can view purchases"
    ON inventory_purchases FOR SELECT
    TO authenticated
    USING (true);

-- INSERT: Todos los usuarios autenticados pueden crear compras
CREATE POLICY "Anyone can create purchases"
    ON inventory_purchases FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- UPDATE: Usuarios pueden actualizar sus propias compras, admins pueden actualizar todas
CREATE POLICY "Users can update own purchases"
    ON inventory_purchases FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update any purchase"
    ON inventory_purchases FOR UPDATE
    TO authenticated
    USING (public.is_admin_or_manager(auth.uid()));

-- DELETE: Solo admins pueden eliminar
CREATE POLICY "Admins can delete purchases"
    ON inventory_purchases FOR DELETE
    TO authenticated
    USING (public.is_admin_or_manager(auth.uid()));

-- PASO 4: Verificar que RLS está habilitado
ALTER TABLE inventory_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_purchases ENABLE ROW LEVEL SECURITY;

-- PASO 5: Mostrar todas las políticas creadas
SELECT '=== POLÍTICAS FINALES ===' as info;

SELECT 
    tablename,
    policyname,
    cmd,
    with_check
FROM pg_policies
WHERE tablename IN ('inventory_products', 'inventory_purchases')
ORDER BY tablename, cmd, policyname;
