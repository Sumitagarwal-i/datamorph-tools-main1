import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Simple in-memory cache for demo (replace with Redis/Supabase in production)
const cache = new Map<string, any>()
const cacheTimestamps = new Map<string, number>()
const CACHE_TTL = 3600000 // 1 hour in ms

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const action = url.searchParams.get('action') || 'stats'

  try {
    if (action === 'stats') {
      // Get cache statistics
      const stats = {
        total_entries: cache.size,
        total_size_bytes: Array.from(cache.values()).reduce(
          (sum, val) => sum + JSON.stringify(val).length,
          0
        ),
        oldest_entry: Math.min(...Array.from(cacheTimestamps.values())),
        newest_entry: Math.max(...Array.from(cacheTimestamps.values())),
      }

      return new Response(JSON.stringify(stats), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } else if (action === 'invalidate') {
      // Invalidate cache entries
      const body = await req.json()
      const pattern = body?.pattern || '*'

      let deleted = 0
      if (pattern === '*') {
        deleted = cache.size
        cache.clear()
        cacheTimestamps.clear()
      } else {
        // Delete matching entries
        for (const key of cache.keys()) {
          if (key.includes(pattern)) {
            cache.delete(key)
            cacheTimestamps.delete(key)
            deleted++
          }
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          deleted_entries: deleted,
          message: `Invalidated ${deleted} cache entries`,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    } else if (action === 'get') {
      // Get specific cache entry
      const key = url.searchParams.get('key')
      if (!key) {
        return new Response(
          JSON.stringify({ error: 'Missing key parameter' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      const value = cache.get(key)
      const timestamp = cacheTimestamps.get(key)

      if (!value) {
        return new Response(
          JSON.stringify({ error: 'Cache entry not found' }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      return new Response(
        JSON.stringify({
          key,
          value,
          cached_at: timestamp,
          age_ms: Date.now() - (timestamp || 0),
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    } else if (action === 'set') {
      // Set cache entry
      const body = await req.json()
      const { key, value } = body

      if (!key || !value) {
        return new Response(
          JSON.stringify({ error: 'Missing key or value' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      cache.set(key, value)
      cacheTimestamps.set(key, Date.now())

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Cache entry set successfully',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action parameter' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error?.message || 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
