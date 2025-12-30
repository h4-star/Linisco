// ============================================================
// EDGE FUNCTION: migrate-sales
// ============================================================
// Soporta dos modos:
// 1. MANUAL: Con fromDate y toDate específicos
// 2. AUTO: Sin parámetros, sincroniza última hora (para cron cada 15 min)
// ============================================================

// @ts-ignore - Deno imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore - Deno imports
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

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
// UTILIDADES DE FECHA
// ============================================================
function formatDateDDMMYYYY(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

// Convertir fecha UTC a hora Argentina (UTC-3)
function convertToArgentinaTime(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return dateStr // Si no es parseable, devolver original
    
    // Restar 3 horas para convertir de UTC a Argentina (o sumar si el servidor ya está en UTC)
    // Argentina es UTC-3, pero como el POS puede enviar en UTC, ajustamos
    const argentinaDate = new Date(date.getTime() - (3 * 60 * 60 * 1000))
    
    // Formatear como ISO sin la Z (hora local Argentina)
    const year = argentinaDate.getUTCFullYear()
    const month = (argentinaDate.getUTCMonth() + 1).toString().padStart(2, '0')
    const day = argentinaDate.getUTCDate().toString().padStart(2, '0')
    const hours = argentinaDate.getUTCHours().toString().padStart(2, '0')
    const minutes = argentinaDate.getUTCMinutes().toString().padStart(2, '0')
    const seconds = argentinaDate.getUTCSeconds().toString().padStart(2, '0')
    
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
  } catch {
    return dateStr
  }
}

function getAutoDateRange(): { fromDate: string; toDate: string } {
  const now = new Date()
  // Buscar las últimas 24 horas para asegurar que no perdemos datos
  // aunque el cron falle algunas veces
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  
  return {
    fromDate: formatDateDDMMYYYY(oneDayAgo),
    toDate: formatDateDDMMYYYY(now)
  }
}

// ============================================================
// FUNCIONES DE AUTENTICACIÓN Y FETCH
// ============================================================

async function getAuthToken(credential: string): Promise<string | null> {
  try {
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
      return data.authentication_token
    }
    
    console.error(`❌ Auth failed: ${response.status}`)
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
    const url = new URL(`http://pos.linisco.com.ar/${endpoint}`)
    url.searchParams.set('fromDate', params.fromDate)
    url.searchParams.set('toDate', params.toDate)

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-User-Email': email,
        'X-User-Token': token,
      },
    })

    if (response.status === 200) {
      const data = await response.json()
      return Array.isArray(data) ? data : []
    }
    
    return []
  } catch (error) {
    console.error(`❌ Fetch ${endpoint} error:`, error)
    return []
  }
}

// ============================================================
// COLUMNAS PERMITIDAS
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
// MIGRACIÓN POR LOCAL (con soporte incremental)
// ============================================================

async function migrateShop(
  shop: ShopConfig,
  params: { fromDate: string, toDate: string },
  supabase: any,
  isAutoMode: boolean
): Promise<{ orders: number, products: number, sessions: number, newOrders: number }> {
  const result = { orders: 0, products: 0, sessions: 0, newOrders: 0 }

  const credential = Deno.env.get(`LINISCO_${shop.key}`)
  if (!credential) {
    console.log(`⚠️ No credentials for ${shop.name}`)
    return result
  }

  const token = await getAuthToken(credential)
  if (!token) {
    console.log(`❌ Auth failed for ${shop.name}`)
    return result
  }

  let email = shop.email
  try {
    const credData = JSON.parse(credential)
    if (credData.user?.email) {
      email = credData.user.email
    }
  } catch {}

  // ---- ÓRDENES ----
  const orders = await fetchData('sale_orders', email, token, params)
  
  if (orders.length > 0) {
    const ordersFiltered = orders.map(order => {
      const filtered = filterColumns(order, ALLOWED_ORDER_COLUMNS)
      filtered.shopNumber = shop.code
      filtered.shopName = shop.name
      // Convertir fecha a hora Argentina
      if (filtered.orderDate) {
        filtered.orderDate = convertToArgentinaTime(filtered.orderDate)
      }
      return filtered
    })

    try {
      // Usar upsert para evitar duplicados
      const { data, error } = await supabase
        .from('sale_orders')
        .upsert(ordersFiltered, { 
          onConflict: 'idSaleOrder',
          ignoreDuplicates: false 
        })
        .select('idSaleOrder')
      
      if (error) {
        console.error('❌ Error inserting orders:', error.message)
      } else {
        result.orders = orders.length
        result.newOrders = data?.length || 0
        console.log(`✅ ${shop.name}: ${orders.length} orders (${result.newOrders} new/updated)`)
      }
    } catch (e) {
      console.error('❌ Orders exception:', e)
    }
  }

  // ---- PRODUCTOS (solo si hay órdenes nuevas o modo manual) ----
  if (orders.length > 0) {
    const products = await fetchData('sale_products', email, token, params)
    
    if (products.length > 0) {
      const productsFiltered = products.map(product => {
        const filtered = filterColumns(product, ALLOWED_PRODUCT_COLUMNS)
        filtered.shopName = shop.name
        return filtered
      })

      try {
        // Para productos, verificar si ya existen por idSaleOrder + idProduct
        const { error } = await supabase
          .from('sale_products')
          .upsert(productsFiltered, {
            onConflict: 'idSaleOrder,idProduct',
            ignoreDuplicates: true
          })
        
        if (error) {
          // Si falla el upsert, intentar insert ignorando duplicados
          const { error: insertError } = await supabase
            .from('sale_products')
            .insert(productsFiltered)
          
          if (!insertError) {
            result.products = products.length
          }
        } else {
          result.products = products.length
        }
      } catch (e) {
        console.error('❌ Products exception:', e)
      }
    }
  }

  // ---- SESIONES (en todos los modos) ----
  const sessions = await fetchData('psessions', email, token, params)
  
  if (sessions.length > 0) {
    const sessionsFiltered = sessions.map(session => {
      const filtered = filterColumns(session, ALLOWED_SESSION_COLUMNS)
      filtered.shopName = shop.name
      // Convertir fechas a hora Argentina
      if (filtered.date) filtered.date = convertToArgentinaTime(filtered.date)
      if (filtered.openingDate) filtered.openingDate = convertToArgentinaTime(filtered.openingDate)
      if (filtered.closingDate) filtered.closingDate = convertToArgentinaTime(filtered.closingDate)
      return filtered
    })

    try {
      // Usar upsert para evitar duplicados
      const { error } = await supabase
        .from('psessions')
        .upsert(sessionsFiltered, {
          onConflict: 'idSession',
          ignoreDuplicates: true
        })
      
      if (!error) {
        result.sessions = sessions.length
      }
    } catch (e) {
      console.error('❌ Sessions exception:', e)
    }
  }

  // Actualizar checkpoint
  if (isAutoMode && result.orders > 0) {
    try {
      await supabase
        .from('migration_checkpoints')
        .upsert({
          shop_key: shop.key,
          shop_name: shop.name,
          last_order_date: params.toDate,
          last_sync_at: new Date().toISOString(),
          orders_count: result.orders,
          products_count: result.products
        }, { onConflict: 'shop_key' })
    } catch {}
  }

  return result
}

// ============================================================
// HANDLER PRINCIPAL
// ============================================================

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()
  let logId: number | null = null

  // Crear cliente Supabase
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    let body: { fromDate?: string; toDate?: string; shops?: string[]; mode?: string } = {}
    
    try {
      const text = await req.text()
      console.log(`📥 Raw body: ${text}`)
      if (text && text.trim()) {
        body = JSON.parse(text)
        console.log(`📦 Parsed body: ${JSON.stringify(body)}`)
      }
    } catch (parseError) {
      console.log(`⚠️ Body parse error, using auto mode: ${parseError}`)
    }

    // SIEMPRE usar modo auto si no hay fechas válidas
    const hasValidDates = body.fromDate && body.toDate && 
                          typeof body.fromDate === 'string' && 
                          typeof body.toDate === 'string'
    const isAutoMode = body.mode === 'auto' || !hasValidDates
    
    console.log(`🔍 Mode check: mode=${body.mode}, hasValidDates=${hasValidDates}, isAutoMode=${isAutoMode}`)
    
    // Determinar rango de fechas
    let fromDate: string
    let toDate: string
    
    if (isAutoMode) {
      const autoRange = getAutoDateRange()
      fromDate = autoRange.fromDate
      toDate = autoRange.toDate
      console.log(`🤖 AUTO MODE: Syncing last 24h (${fromDate} - ${toDate})`)
    } else {
      fromDate = body.fromDate!
      toDate = body.toDate!
      console.log(`📝 MANUAL MODE: ${fromDate} - ${toDate}`)
    }

    // Registrar inicio de migración
    try {
      const { data } = await supabase
        .from('migration_logs')
        .insert({
          migration_type: isAutoMode ? 'scheduled' : 'manual',
          from_date: fromDate,
          to_date: toDate,
          status: 'running'
        })
        .select('id')
        .single()
      
      if (data) logId = data.id
    } catch {}

    const shopsToMigrate = body.shops 
      ? SHOPS.filter(s => body.shops!.includes(s.key))
      : SHOPS

    console.log(`\n${'='.repeat(50)}`)
    console.log(`🚀 Starting migration (${isAutoMode ? 'AUTO' : 'MANUAL'})`)
    console.log(`📅 From: ${fromDate} To: ${toDate}`)
    console.log(`🏪 Shops: ${shopsToMigrate.map(s => s.key).join(', ')}`)
    console.log(`${'='.repeat(50)}\n`)

    const params = { fromDate, toDate }
    let totalOrders = 0
    let totalProducts = 0
    let totalSessions = 0
    let totalNewOrders = 0
    const shopResults: Record<string, any> = {}

    // Migrar cada local
    for (const shop of shopsToMigrate) {
      console.log(`🏪 Processing: ${shop.name}`)
      const result = await migrateShop(shop, params, supabase, isAutoMode)
      totalOrders += result.orders
      totalProducts += result.products
      totalSessions += result.sessions
      totalNewOrders += result.newOrders
      shopResults[shop.key] = result
    }

    const duration = Date.now() - startTime

    console.log(`\n${'='.repeat(50)}`)
    console.log(`📊 MIGRATION COMPLETE in ${duration}ms`)
    console.log(`📦 Orders: ${totalOrders} (${totalNewOrders} new)`)
    console.log(`🛒 Products: ${totalProducts}`)
    console.log(`💰 Sessions: ${totalSessions}`)
    console.log(`${'='.repeat(50)}\n`)

    // Actualizar log
    if (logId) {
      try {
        await supabase
          .from('migration_logs')
          .update({
            finished_at: new Date().toISOString(),
            status: 'success',
            orders_migrated: totalOrders,
            products_migrated: totalProducts,
            sessions_migrated: totalSessions,
            details: { shopResults, duration_ms: duration, new_orders: totalNewOrders }
          })
          .eq('id', logId)
      } catch {}
    }

    return new Response(
      JSON.stringify({
        success: true,
        mode: isAutoMode ? 'auto' : 'manual',
        orders: totalOrders,
        newOrders: totalNewOrders,
        products: totalProducts,
        sessions: totalSessions,
        duration_ms: duration,
        message: isAutoMode 
          ? `Sync automático: ${totalNewOrders} órdenes nuevas en ${duration}ms`
          : `Migración completada: ${totalOrders} órdenes, ${totalProducts} productos`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Migration error:', error)
    
    // Registrar error
    if (logId) {
      try {
        await supabase
          .from('migration_logs')
          .update({
            finished_at: new Date().toISOString(),
            status: 'error',
            error_message: error.message || 'Error desconocido'
          })
          .eq('id', logId)
      } catch {}
    }

    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Error desconocido'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
