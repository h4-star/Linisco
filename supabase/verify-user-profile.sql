-- =============================================
-- Verificar si el usuario tiene perfil en user_profiles
-- Ejecuta esto reemplazando 'TU_USER_ID' con el ID del usuario
-- =============================================

-- Reemplaza esto con el user_id que aparece en los logs de la consola
-- Ejemplo: '392e33f7-ab3b-4dd5-a266-7d745bfe8dec'
SET @user_id = '392e33f7-ab3b-4dd5-a266-7d745bfe8dec';

-- Verificar si el usuario tiene perfil
SELECT 
    id,
    email,
    role,
    assigned_shops,
    is_active
FROM user_profiles
WHERE id = '392e33f7-ab3b-4dd5-a266-7d745bfe8dec';

-- Si no existe, crear el perfil
INSERT INTO user_profiles (id, email, role, is_active)
SELECT 
    id,
    email,
    CASE 
        WHEN email = 'h4subway@gmail.com' THEN 'admin'
        ELSE 'employee'
    END as role,
    true as is_active
FROM auth.users
WHERE id = '392e33f7-ab3b-4dd5-a266-7d745bfe8dec'
ON CONFLICT (id) DO NOTHING;

-- Verificar estructura de foreign key
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'inventory_products';
