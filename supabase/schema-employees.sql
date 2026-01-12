-- =============================================
-- ESQUEMA DE EMPLEADOS Y GESTIÓN
-- Linisco Dashboard - Sistema de Empleados
-- =============================================
-- INSTRUCCIONES:
-- 1. Ve a tu proyecto en supabase.com
-- 2. Ve a SQL Editor
-- 3. Copia y pega todo este contenido
-- 4. Ejecuta el script
-- =============================================

-- =============================================
-- TABLA: user_profiles (Perfiles de usuario con roles)
-- =============================================
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'manager', 'employee')),
    assigned_shops TEXT[] DEFAULT '{}', -- Tiendas asignadas al empleado
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- Trigger para crear perfil automáticamente cuando se registra un usuario
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, role)
    VALUES (
        NEW.id, 
        NEW.email,
        CASE 
            WHEN NEW.email = 'h4subway@gmail.com' THEN 'admin'
            ELSE 'employee'
        END
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar trigger si existe y recrearlo
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- =============================================
-- TABLA: employee_messages (Mensajes de empleados)
-- =============================================
CREATE TABLE IF NOT EXISTS employee_messages (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'urgente', 'sugerencia', 'reclamo', 'consulta')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'read', 'replied', 'archived')),
    admin_reply TEXT,
    replied_at TIMESTAMP WITH TIME ZONE,
    replied_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_employee_messages_user ON employee_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_messages_status ON employee_messages(status);
CREATE INDEX IF NOT EXISTS idx_employee_messages_created ON employee_messages(created_at DESC);

-- =============================================
-- TABLA: cash_closings (Cierres de caja manuales)
-- =============================================
CREATE TABLE IF NOT EXISTS cash_closings (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    shop_name TEXT NOT NULL,
    closing_date DATE NOT NULL,
    shift TEXT NOT NULL CHECK (shift IN ('morning', 'afternoon', 'night', 'full')),
    
    -- Montos declarados por el empleado (métodos de pago)
    cash_sales DECIMAL(12, 2) DEFAULT 0,           -- Efectivo
    card_sales DECIMAL(12, 2) DEFAULT 0,           -- Tarjetas
    mercadopago_sales DECIMAL(12, 2) DEFAULT 0,    -- Mercado Pago QR
    rappi_sales DECIMAL(12, 2) DEFAULT 0,          -- Rappi
    pedidosya_sales DECIMAL(12, 2) DEFAULT 0,      -- Pedidos Ya
    mp_delivery_sales DECIMAL(12, 2) DEFAULT 0,    -- Mercado Pago Delivery
    other_sales DECIMAL(12, 2) DEFAULT 0,          -- Otros
    total_declared DECIMAL(12, 2) DEFAULT 0,
    
    -- Caja física
    opening_cash DECIMAL(12, 2) DEFAULT 0,
    closing_cash DECIMAL(12, 2) DEFAULT 0,
    cash_difference DECIMAL(12, 2) DEFAULT 0,
    
    -- Comparación con API (se llena automáticamente)
    api_total DECIMAL(12, 2),
    api_cash DECIMAL(12, 2),
    api_card DECIMAL(12, 2),
    variance DECIMAL(12, 2), -- Diferencia entre declarado y API
    variance_percentage DECIMAL(5, 2),
    
    -- Estado y notas
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'review', 'rejected')),
    notes TEXT,
    admin_notes TEXT,
    reviewed_by UUID REFERENCES user_profiles(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Evitar duplicados
    UNIQUE(shop_name, closing_date, shift)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_cash_closings_user ON cash_closings(user_id);
CREATE INDEX IF NOT EXISTS idx_cash_closings_shop ON cash_closings(shop_name);
CREATE INDEX IF NOT EXISTS idx_cash_closings_date ON cash_closings(closing_date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_closings_status ON cash_closings(status);

-- =============================================
-- TABLA: tickets (Solicitudes varias)
-- =============================================
CREATE TABLE IF NOT EXISTS tickets (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    shop_name TEXT, -- Puede ser null para tickets personales
    
    -- Tipo de ticket
    ticket_type TEXT NOT NULL CHECK (ticket_type IN (
        'repair',      -- Arreglos/mantenimiento
        'vacation',    -- Vacaciones
        'day_off',     -- Franco semanal / fecha especial
        'supply',      -- Pedido de insumos
        'other'        -- Otros
    )),
    
    -- Detalles
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    
    -- Para vacaciones/francos
    date_from DATE,
    date_to DATE,
    
    -- Estado y seguimiento
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'approved', 'rejected', 'completed', 'cancelled')),
    assigned_to UUID REFERENCES user_profiles(id),
    
    -- Respuesta/resolución
    resolution TEXT,
    resolved_by UUID REFERENCES user_profiles(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    -- Archivos adjuntos (URLs)
    attachments TEXT[] DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_type ON tickets(ticket_type);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_shop ON tickets(shop_name);
CREATE INDEX IF NOT EXISTS idx_tickets_created ON tickets(created_at DESC);

-- =============================================
-- TABLA: ticket_comments (Comentarios en tickets)
-- =============================================
CREATE TABLE IF NOT EXISTS ticket_comments (
    id BIGSERIAL PRIMARY KEY,
    ticket_id BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket ON ticket_comments(ticket_id);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Habilitar RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;

-- =============================================
-- FUNCIÓN AUXILIAR: Verificar si usuario es admin (evita recursión)
-- =============================================
CREATE OR REPLACE FUNCTION public.is_admin_user(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role FROM public.user_profiles WHERE id = user_id;
    RETURN user_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin_or_manager(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role FROM public.user_profiles WHERE id = user_id;
    RETURN user_role IN ('admin', 'manager');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- POLÍTICAS: user_profiles
-- =============================================

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON user_profiles;
DROP POLICY IF EXISTS "Allow all authenticated to read profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

-- Todos los usuarios autenticados pueden leer perfiles (necesario para ver nombres en mensajes, etc)
CREATE POLICY "Allow all authenticated to read profiles"
    ON user_profiles FOR SELECT
    TO authenticated
    USING (true);

-- Usuarios pueden insertar su propio perfil
CREATE POLICY "Users can insert own profile"
    ON user_profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- Usuarios pueden actualizar su propio perfil
CREATE POLICY "Users can update own profile"
    ON user_profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Admins pueden actualizar cualquier perfil
CREATE POLICY "Admins can update any profile"
    ON user_profiles FOR UPDATE
    TO authenticated
    USING (public.is_admin_user(auth.uid()));

-- =============================================
-- POLÍTICAS: employee_messages
-- =============================================

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Employees can view own messages" ON employee_messages;
DROP POLICY IF EXISTS "Admins can view all messages" ON employee_messages;
DROP POLICY IF EXISTS "Employees can create messages" ON employee_messages;
DROP POLICY IF EXISTS "Admins can update messages" ON employee_messages;

-- Empleados pueden ver sus propios mensajes
CREATE POLICY "Employees can view own messages"
    ON employee_messages FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Admins pueden ver todos los mensajes
CREATE POLICY "Admins can view all messages"
    ON employee_messages FOR SELECT
    TO authenticated
    USING (public.is_admin_user(auth.uid()));

-- Empleados pueden crear mensajes
CREATE POLICY "Employees can create messages"
    ON employee_messages FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Admins pueden actualizar mensajes (para responder)
CREATE POLICY "Admins can update messages"
    ON employee_messages FOR UPDATE
    TO authenticated
    USING (public.is_admin_user(auth.uid()));

-- =============================================
-- POLÍTICAS: cash_closings
-- =============================================

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Employees can view own closings" ON cash_closings;
DROP POLICY IF EXISTS "Admins can view all closings" ON cash_closings;
DROP POLICY IF EXISTS "Employees can create closings" ON cash_closings;
DROP POLICY IF EXISTS "Employees can update pending closings" ON cash_closings;
DROP POLICY IF EXISTS "Admins can update any closing" ON cash_closings;

-- Empleados pueden ver sus propios cierres
CREATE POLICY "Employees can view own closings"
    ON cash_closings FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Admins/managers pueden ver todos los cierres
CREATE POLICY "Admins can view all closings"
    ON cash_closings FOR SELECT
    TO authenticated
    USING (public.is_admin_or_manager(auth.uid()));

-- Empleados pueden crear cierres
CREATE POLICY "Employees can create closings"
    ON cash_closings FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Empleados pueden actualizar sus cierres pendientes
CREATE POLICY "Employees can update pending closings"
    ON cash_closings FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id AND status = 'pending')
    WITH CHECK (auth.uid() = user_id);

-- Admins pueden actualizar cualquier cierre
CREATE POLICY "Admins can update any closing"
    ON cash_closings FOR UPDATE
    TO authenticated
    USING (public.is_admin_or_manager(auth.uid()));

-- =============================================
-- POLÍTICAS: tickets
-- =============================================

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Employees can view own tickets" ON tickets;
DROP POLICY IF EXISTS "Admins can view all tickets" ON tickets;
DROP POLICY IF EXISTS "Employees can create tickets" ON tickets;
DROP POLICY IF EXISTS "Employees can update own open tickets" ON tickets;
DROP POLICY IF EXISTS "Admins can update any ticket" ON tickets;

-- Empleados pueden ver sus propios tickets
CREATE POLICY "Employees can view own tickets"
    ON tickets FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Admins pueden ver todos los tickets
CREATE POLICY "Admins can view all tickets"
    ON tickets FOR SELECT
    TO authenticated
    USING (public.is_admin_or_manager(auth.uid()));

-- Empleados pueden crear tickets
CREATE POLICY "Employees can create tickets"
    ON tickets FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Empleados pueden actualizar sus tickets abiertos
CREATE POLICY "Employees can update own open tickets"
    ON tickets FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id AND status IN ('open', 'in_progress'))
    WITH CHECK (auth.uid() = user_id);

-- Admins pueden actualizar cualquier ticket
CREATE POLICY "Admins can update any ticket"
    ON tickets FOR UPDATE
    TO authenticated
    USING (public.is_admin_or_manager(auth.uid()));

-- =============================================
-- POLÍTICAS: ticket_comments
-- =============================================

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Users can view ticket comments" ON ticket_comments;
DROP POLICY IF EXISTS "Users can create ticket comments" ON ticket_comments;

-- Usuarios pueden ver comentarios de tickets que pueden ver
CREATE POLICY "Users can view ticket comments"
    ON ticket_comments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM tickets t
            WHERE t.id = ticket_id 
            AND (t.user_id = auth.uid() OR public.is_admin_or_manager(auth.uid()))
        )
    );

-- Usuarios pueden crear comentarios en tickets que pueden ver
CREATE POLICY "Users can create ticket comments"
    ON ticket_comments FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM tickets t
            WHERE t.id = ticket_id 
            AND (t.user_id = auth.uid() OR public.is_admin_or_manager(auth.uid()))
        )
    );

-- =============================================
-- FUNCIONES ÚTILES
-- =============================================

-- Función para obtener el rol del usuario actual
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
BEGIN
    RETURN (
        SELECT role FROM user_profiles WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para verificar si el usuario es admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        SELECT role = 'admin' FROM user_profiles WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a todas las tablas nuevas
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_employee_messages_updated_at ON employee_messages;
CREATE TRIGGER update_employee_messages_updated_at
    BEFORE UPDATE ON employee_messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_cash_closings_updated_at ON cash_closings;
CREATE TRIGGER update_cash_closings_updated_at
    BEFORE UPDATE ON cash_closings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_tickets_updated_at ON tickets;
CREATE TRIGGER update_tickets_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- VISTAS ÚTILES
-- =============================================

-- Vista: Resumen de mensajes pendientes (para dashboard admin)
CREATE OR REPLACE VIEW pending_messages_summary AS
SELECT 
    category,
    COUNT(*) as count,
    MIN(created_at) as oldest
FROM employee_messages
WHERE status = 'pending'
GROUP BY category;

-- Vista: Resumen de tickets abiertos
CREATE OR REPLACE VIEW open_tickets_summary AS
SELECT 
    ticket_type,
    priority,
    COUNT(*) as count
FROM tickets
WHERE status IN ('open', 'in_progress')
GROUP BY ticket_type, priority;

-- Vista: Cierres de caja con varianza significativa
CREATE OR REPLACE VIEW closings_with_variance AS
SELECT 
    cc.*,
    up.full_name,
    up.email
FROM cash_closings cc
JOIN user_profiles up ON cc.user_id = up.id
WHERE ABS(cc.variance_percentage) > 5 -- Más de 5% de diferencia
ORDER BY cc.closing_date DESC;

-- =============================================
-- DATOS INICIALES
-- =============================================

-- Insertar perfil admin para usuario existente si no existe
INSERT INTO user_profiles (id, email, role, full_name)
SELECT id, email, 'admin', 'Administrador'
FROM auth.users 
WHERE email = 'h4subway@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- =============================================
-- COMENTARIOS
-- =============================================
COMMENT ON TABLE user_profiles IS 'Perfiles de usuario con roles y permisos';
COMMENT ON TABLE employee_messages IS 'Mensajes de empleados hacia administración';
COMMENT ON TABLE cash_closings IS 'Cierres de caja manuales reportados por empleados';
COMMENT ON TABLE tickets IS 'Tickets de solicitudes: arreglos, vacaciones, francos, etc.';
COMMENT ON TABLE ticket_comments IS 'Comentarios y seguimiento de tickets';

COMMENT ON COLUMN user_profiles.role IS 'Rol: admin (acceso total), manager (gestión), employee (portal básico)';
COMMENT ON COLUMN user_profiles.assigned_shops IS 'Array de tiendas asignadas al empleado';
COMMENT ON COLUMN cash_closings.variance IS 'Diferencia entre total declarado y total de API (positivo = declaró más)';
COMMENT ON COLUMN tickets.ticket_type IS 'Tipo: repair, vacation, day_off, supply, other';
