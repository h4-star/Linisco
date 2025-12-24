// Edge Function para migrar datos desde POS Linisco a Supabase
// Ejecutar: supabase functions deploy migrate-sales

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Configuración de locales
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
    console.error(`Auth failed: ${response.status}`)
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
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-User-Email': email,
        'X-User-Token': token,
      },
    })

    if (response.status === 200) {
      return await response.json()
    }
    console.error(`Fetch ${endpoint} failed: ${response.status}`)
    return []
  } catch (error) {
    console.error(`Fetch ${endpoint} error:`, error)
    return []
  }
}

async function migrateShop(
  shop: ShopConfig,
  params: { fromDate: string, toDate: string },
  supabase: any
): Promise<{ orders: number, products: number, sessions: number }> {
  const result = { orders: 0, products: 0, sessions: 0 }

  // Obtener credencial desde secret
  const credential = Deno.env.get(`LINISCO_${shop.key}`)
  if (!credential) {
    console.log(`No credentials for ${shop.name}`)
    return result
  }

  // Autenticación
  console.log(`Authenticating ${shop.name}...`)
  const token = await getAuthToken(credential)
  if (!token) {
    return result
  }
  console.log(`Authenticated ${shop.name}`)

  // Extraer email del credential JSON
  let email = shop.email
  try {
    const credData = JSON.parse(credential)
    if (credData.user?.email) {
      email = credData.user.email
    }
  } catch {}

  // Obtener órdenes
  console.log(`Fetching orders from ${shop.name}...`)
  const orders = await fetchData('sale_orders', email, token, params)
  
  if (orders.length > 0) {
    // Agregar info del local
    const ordersWithShop = orders.map(order => ({
      ...order,
      shopNumber: shop.code,
      shopName: shop.name,
    }))

    try {
      const { error } = await supabase
        .from('sale_orders')
        .upsert(ordersWithShop, { onConflict: 'idSaleOrder' })
      
      if (error) {
        console.error('Error inserting orders:', error)
      } else {
        result.orders = orders.length
        console.log(`Inserted ${orders.length} orders`)
      }
    } catch (e) {
      console.error('Orders insert exception:', e)
    }
  }

  // Obtener productos
  console.log(`Fetching products from ${shop.name}...`)
  const products = await fetchData('sale_products', email, token, params)
  
  if (products.length > 0) {
    // Agregar info del local y quitar id
    const productsWithShop = products.map(({ id, ...product }) => ({
      ...product,
      shopName: shop.name,
    }))

    try {
      const { error } = await supabase
        .from('sale_products')
        .insert(productsWithShop)
      
      if (error) {
        console.error('Error inserting products:', error)
      } else {
        result.products = products.length
        console.log(`Inserted ${products.length} products`)
      }
    } catch (e) {
      console.error('Products insert exception:', e)
    }
  }

  // Obtener sesiones
  console.log(`Fetching sessions from ${shop.name}...`)
  const sessions = await fetchData('psessions', email, token, params)
  
  if (sessions.length > 0) {
    const sessionsWithShop = sessions.map(({ id, ...session }) => ({
      ...session,
      shopName: shop.name,
    }))

    try {
      const { error } = await supabase
        .from('psessions')
        .insert(sessionsWithShop)
      
      if (error) {
        console.error('Error inserting sessions:', error)
      } else {
        result.sessions = sessions.length
        console.log(`Inserted ${sessions.length} sessions`)
      }
    } catch (e) {
      console.error('Sessions insert exception:', e)
    }
  }

  return result
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { fromDate, toDate, shops } = await req.json()

    if (!fromDate || !toDate) {
      return new Response(
        JSON.stringify({ error: 'fromDate y toDate son requeridos (formato dd/mm/yyyy)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Crear cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Filtrar locales si se especificaron
    const shopsToMigrate = shops 
      ? SHOPS.filter(s => shops.includes(s.key))
      : SHOPS

    console.log(`Starting migration from ${fromDate} to ${toDate}`)
    console.log(`Shops: ${shopsToMigrate.map(s => s.key).join(', ')}`)

    const params = { fromDate, toDate }
    let totalOrders = 0
    let totalProducts = 0
    let totalSessions = 0

    // Migrar cada local
    for (const shop of shopsToMigrate) {
      console.log(`\nProcessing ${shop.name}...`)
      const result = await migrateShop(shop, params, supabase)
      totalOrders += result.orders
      totalProducts += result.products
      totalSessions += result.sessions
    }

    console.log(`\nMigration complete: ${totalOrders} orders, ${totalProducts} products, ${totalSessions} sessions`)

    return new Response(
      JSON.stringify({
        success: true,
        orders: totalOrders,
        products: totalProducts,
        sessions: totalSessions,
        message: `Migración completada: ${totalOrders} órdenes, ${totalProducts} productos`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Migration error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

