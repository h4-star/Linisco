-- =============================================
-- CONFIGURACIÓN DE AUTENTICACIÓN
-- Linisco Dashboard - Usuarios permitidos
-- =============================================
-- INSTRUCCIONES:
-- 1. Ve a tu proyecto en supabase.com
-- 2. Ve a Authentication > Users
-- 3. Click en "Add user" y crea usuarios manualmente
-- O ejecuta este script en SQL Editor (solo funciona con service_role)
-- =============================================

-- Opción 1: Crear usuarios desde el Dashboard de Supabase
-- Es la forma más fácil:
-- 1. Ve a Authentication > Users
-- 2. Click "Add user"
-- 3. Ingresa email y contraseña
-- 4. El usuario podrá iniciar sesión inmediatamente

-- Opción 2: Si querés restringir quién puede registrarse
-- Ve a Authentication > Providers > Email
-- Desactiva "Allow new users to sign up"
-- Así solo vos podés crear usuarios desde el dashboard

-- =============================================
-- TABLA: user_roles (opcional, para control de acceso)
-- =============================================
CREATE TABLE IF NOT EXISTS user_roles (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT DEFAULT 'viewer', -- admin, editor, viewer
    shops TEXT[] DEFAULT '{}', -- Locales a los que tiene acceso
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_email ON user_roles(email);

-- Habilitar RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Solo admins pueden ver/editar roles
CREATE POLICY "Users can view own role" ON user_roles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles" ON user_roles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- =============================================
-- FUNCIÓN: Crear rol al registrar usuario
-- =============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO user_roles (user_id, email, role)
    VALUES (NEW.id, NEW.email, 'viewer');
    RETURN NEW;
END;
$$;

-- Trigger para nuevos usuarios
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================
-- COMENTARIOS
-- =============================================
COMMENT ON TABLE user_roles IS 'Roles y permisos de usuarios del dashboard';
COMMENT ON COLUMN user_roles.role IS 'admin: todo, editor: puede migrar, viewer: solo lectura';
COMMENT ON COLUMN user_roles.shops IS 'Array de códigos de locales a los que tiene acceso';

