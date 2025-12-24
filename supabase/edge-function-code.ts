// ============================================================
// EDGE FUNCTION: migrate-sales
// ============================================================
// INSTRUCCIONES:
// 1. Ve a tu proyecto en supabase.com
// 2. Ve a Edge Functions (menú lateral)
// 3. Click en "Create a new function"
// 4. Nombre: migrate-sales
// 5. Pega TODO este código
// 6. Click en "Deploy"
// 7. Luego ve a Settings > Edge Functions > Secrets y agrega las credenciales
//
// IMPORTANTE: En la configuración de la función, desactivar "Enforce JWT Verification"
// O ir a Settings > Edge Functions > migrate-sales > Desactivar JWT verification
// ============================================================

// @ts-ignore - Deno imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore - Deno imports
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Declaración de tipos para Deno (solo para el editor, Supabase lo tiene globalmente)
declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ============================================================
// CONFIGURACIÓN DE LOCALES
// Modificá esta lista si agregás nuevos locales
// ============================================================
interface ShopConfig {
  key: string
  code: string
  name: string
  email: string
}

const SHOPS: ShopConfig[] = [
  { key: "SC", code: "66220", name: "Subway Corrientes", email: "66220@linisco.com.ar" },
  { key: "SL", code: "63953", name: "Subway Lacroze", email: "63953@linisco.com.ar" },
  { key: "SO", code: "72267", name: "Subway Ortiz", email: "72267@linisco.com.ar" },
  { key: "DO", code: "10019", name: "Daniel Ortiz", email: "10019@linisco.com.ar" },
  { key: "DL", code: "30036", name: "Daniel Lacroze", email: "30036@linisco.com.ar" },
  { key: "DC", code: "30038", name: "Daniel Corrientes", email: "30038@linisco.com.ar" },
  { key: "SE", code: "10020", name: "Seitu Juramento", email: "10020@linisco.com.ar" },
  { key: "SJ", code: "75248", name: "Subway Juramento", email: "75248@linisco.com.ar" },
]

const BASE_URL = "https://pos.linisco.com.ar"

// ============================================================
// FUNCIONES DE AUTENTICACIÓN Y FETCH
// ============================================================

async function getAuthToken(credential: string): Promise<string | null> {
  try {
    // Debug: mostrar primeros caracteres del credential (sin revelar passwords)
    console.log(`🔑 Credential format check: starts with "${credential.substring(0, 20)}..."`)
    console.log(`🔑 Credential length: ${credential.length}`)
    
    const response = await fetch(`${BASE_URL}/users/sign_in`, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
      },
      body: credential,
    })

    if (response.status === 201) {
      const data = await response.json()
      console.log(`✅ Auth successful, got token`)
      return data.authentication_token
    }
    
    const errorBody = await response.text()
    console.error(`❌ Auth failed: ${response.status}`)
    console.error(`❌ Auth error body: ${errorBody.substring(0, 200)}`)
    return null
  } catch (error) {
    console.error('Auth error:', error)
    return null
  }
}

async function fetchData(
  endpoint: string, 
  email: string, 
  token: string, 
  params: { fromDate: string, toDate: string }
): Promise<any[]> {
  try {
    // Usar query parameters (como en el notebook Python con requests.get params=)
    const url = new URL(`http://pos.linisco.com.ar/${endpoint}`)
    url.searchParams.set('fromDate', params.fromDate)
    url.searchParams.set('toDate', params.toDate)

    console.log(`📡 Fetching: ${url.toString()}`)

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-User-Email': email,
        'X-User-Token': token,
      },
    })

    console.log(`📡 Response status: ${response.status}`)

    if (response.status === 200) {
      const data = await response.json()
      const count = Array.isArray(data) ? data.length : 0
      console.log(`✅ ${endpoint}: ${count} records`)
      return Array.isArray(data) ? data : []
    }
    
    const errorText = await response.text()
    console.error(`❌ Fetch ${endpoint} failed: ${response.status} - ${errorText.substring(0, 200)}`)
    return []
  } catch (error) {
    console.error(`❌ Fetch ${endpoint} error:`, error)
    return []
  }
}

// ============================================================
// COLUMNAS PERMITIDAS (para filtrar datos de la API)
// ============================================================

const ALLOWED_ORDER_COLUMNS = [
  'idSaleOrder', 'number', 'total', 'subtotal', 'discount', 'tax', 'tip',
  'orderDate', 'shopNumber', 'shopName', 'paymentmethod', 'status',
  'customer', 'notes', 'source', 'channel', 'tableNumber', 'orderType'
]

const ALLOWED_PRODUCT_COLUMNS = [
  'idSaleOrder', 'idProduct', 'name', 'fixed_name', 'category',
  'quantity', 'price', 'total', 'discount', 'notes', 'modifiers', 'shopName'
]

const ALLOWED_SESSION_COLUMNS = [
  'idSession', 'shopName', 'date', 'openingDate', 'closingDate',
  'cash', 'openingCash', 'closingCash', 'totalSales', 'totalCash',
  'totalCard', 'totalOther', 'difference', 'status', 'notes'
]

function filterColumns(data: Record<string, any>, allowedColumns: string[]): Record<string, any> {
  const filtered: Record<string, any> = {}
  for (const col of allowedColumns) {
    if (data[col] !== undefined) {
      filtered[col] = data[col]
    }
  }
  return filtered
}

// ============================================================
// MIGRACIÓN POR LOCAL
// ============================================================

async function migrateShop(
  shop: ShopConfig,
  params: { fromDate: string, toDate: string },
  supabase: any
): Promise<{ orders: number, products: number, sessions: number }> {
  const result = { orders: 0, products: 0, sessions: 0 }

  // Obtener credencial desde secret (configurado en Supabase Dashboard)
  const credential = Deno.env.get(`LINISCO_${shop.key}`)
  if (!credential) {
    console.log(`⚠️ No credentials for ${shop.name} (LINISCO_${shop.key})`)
    return result
  }

  // Autenticación
  console.log(`🔐 Authenticating ${shop.name}...`)
  const token = await getAuthToken(credential)
  if (!token) {
    console.log(`❌ Auth failed for ${shop.name}`)
    return result
  }
  console.log(`✅ Authenticated ${shop.name}`)

  // Extraer email del credential JSON
  let email = shop.email
  try {
    const credData = JSON.parse(credential)
    if (credData.user?.email) {
      email = credData.user.email
    }
  } catch {}

  // ---- ÓRDENES ----
  console.log(`📦 Fetching orders from ${shop.name}...`)
  const orders = await fetchData('sale_orders', email, token, params)
  
  if (orders.length > 0) {
    // Filtrar solo columnas permitidas y agregar info del local
    const ordersFiltered = orders.map(order => {
      const filtered = filterColumns(order, ALLOWED_ORDER_COLUMNS)
      filtered.shopNumber = shop.code
      filtered.shopName = shop.name
      return filtered
    })

    try {
      const { error } = await supabase
        .from('sale_orders')
        .upsert(ordersFiltered, { onConflict: 'idSaleOrder' })
      
      if (error) {
        console.error('❌ Error inserting orders:', error.message)
      } else {
        result.orders = orders.length
        console.log(`✅ Inserted ${orders.length} orders`)
      }
    } catch (e) {
      console.error('❌ Orders exception:', e)
    }
  } else {
    console.log(`ℹ️ No orders found`)
  }

  // ---- PRODUCTOS ----
  console.log(`🛒 Fetching products from ${shop.name}...`)
  const products = await fetchData('sale_products', email, token, params)
  
  if (products.length > 0) {
    // Filtrar solo columnas permitidas
    const productsFiltered = products.map(product => {
      const filtered = filterColumns(product, ALLOWED_PRODUCT_COLUMNS)
      filtered.shopName = shop.name
      return filtered
    })

    try {
      const { error } = await supabase
        .from('sale_products')
        .insert(productsFiltered)
      
      if (error) {
        console.error('❌ Error inserting products:', error.message)
      } else {
        result.products = products.length
        console.log(`✅ Inserted ${products.length} products`)
      }
    } catch (e) {
      console.error('❌ Products exception:', e)
    }
  } else {
    console.log(`ℹ️ No products found`)
  }

  // ---- SESIONES ----
  console.log(`💰 Fetching sessions from ${shop.name}...`)
  const sessions = await fetchData('psessions', email, token, params)
  
  if (sessions.length > 0) {
    // Filtrar solo columnas permitidas
    const sessionsFiltered = sessions.map(session => {
      const filtered = filterColumns(session, ALLOWED_SESSION_COLUMNS)
      filtered.shopName = shop.name
      return filtered
    })

    try {
      const { error } = await supabase
        .from('psessions')
        .insert(sessionsFiltered)
      
      if (error) {
        console.error('❌ Error inserting sessions:', error.message)
      } else {
        result.sessions = sessions.length
        console.log(`✅ Inserted ${sessions.length} sessions`)
      }
    } catch (e) {
      console.error('❌ Sessions exception:', e)
    }
  } else {
    console.log(`ℹ️ No sessions found`)
  }

  return result
}

// ============================================================
// HANDLER PRINCIPAL
// ============================================================

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parsear body de forma segura
    let body: { fromDate?: string; toDate?: string; shops?: string[] } = {}
    
    try {
      const text = await req.text()
      if (text && text.trim()) {
        body = JSON.parse(text)
      }
    } catch (parseError) {
      console.error('Error parsing body:', parseError)
    }

    const { fromDate, toDate, shops } = body

    if (!fromDate || !toDate) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'fromDate y toDate son requeridos (formato dd/mm/yyyy)' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Crear cliente Supabase con service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Filtrar locales si se especificaron
    const shopsToMigrate = shops 
      ? SHOPS.filter(s => shops.includes(s.key))
      : SHOPS

    console.log(`\n${'='.repeat(50)}`)
    console.log(`🚀 Starting migration`)
    console.log(`📅 From: ${fromDate} To: ${toDate}`)
    console.log(`🏪 Shops: ${shopsToMigrate.map(s => s.key).join(', ')}`)
    console.log(`${'='.repeat(50)}\n`)

    const params = { fromDate, toDate }
    let totalOrders = 0
    let totalProducts = 0
    let totalSessions = 0

    // Migrar cada local
    for (const shop of shopsToMigrate) {
      console.log(`\n${'─'.repeat(40)}`)
      console.log(`🏪 Processing: ${shop.name} (${shop.key})`)
      console.log(`${'─'.repeat(40)}`)
      
      const result = await migrateShop(shop, params, supabase)
      totalOrders += result.orders
      totalProducts += result.products
      totalSessions += result.sessions
    }

    console.log(`\n${'='.repeat(50)}`)
    console.log(`📊 MIGRATION COMPLETE`)
    console.log(`📦 Orders: ${totalOrders}`)
    console.log(`🛒 Products: ${totalProducts}`)
    console.log(`💰 Sessions: ${totalSessions}`)
    console.log(`${'='.repeat(50)}\n`)

    return new Response(
      JSON.stringify({
        success: true,
        orders: totalOrders,
        products: totalProducts,
        sessions: totalSessions,
        message: `Migración completada: ${totalOrders} órdenes, ${totalProducts} productos, ${totalSessions} sesiones`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Migration error:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Error desconocido'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

