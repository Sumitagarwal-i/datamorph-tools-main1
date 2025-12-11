import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const action = url.searchParams.get('action') || 'health'

  try {
    if (action === 'health') {
      // Health check endpoint
      return new Response(
        JSON.stringify({
          status: 'ok',
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          services: {
            database: 'ok',
            llm: Deno.env.get('GROQ_API_KEY') ? 'configured' : 'not_configured',
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    } else if (action === 'analytics') {
      // Log analytics event
      const body = await req.json()

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseKey)

      const { data, error } = await supabase.from('analytics').insert({
        event_type: body.event_type || 'unknown',
        event_data: body.event_data || {},
        user_agent: req.headers.get('user-agent'),
        ip_address: req.headers.get('x-forwarded-for') || 'unknown',
        created_at: new Date().toISOString(),
      })

      if (error) {
        console.error('[system] Analytics error:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to log analytics', details: error.message }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Analytics logged' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    } else if (action === 'explain') {
      // Explain an error with AI assistance
      const body = await req.json()

      if (!body.error_message) {
        return new Response(
          JSON.stringify({ error: 'Missing error_message field' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      // Simple explanation (can be enhanced with LLM call)
      const explanation = generateExplanation(body.error_message, body.file_type)

      return new Response(
        JSON.stringify({
          error_message: body.error_message,
          explanation,
          suggestions: explanation.suggestions,
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

function generateExplanation(errorMessage: string, fileType?: string) {
  // Simple rule-based explanation (can be enhanced with LLM)
  const lowerError = errorMessage.toLowerCase()

  if (lowerError.includes('unexpected token')) {
    return {
      explanation: 'This error indicates invalid syntax in your JSON. Check for missing commas, brackets, or quotes.',
      suggestions: [
        'Validate your JSON structure',
        'Check for trailing commas',
        'Ensure all quotes are properly closed',
      ],
    }
  } else if (lowerError.includes('missing')) {
    return {
      explanation: 'A required element or character is missing from your file.',
      suggestions: [
        'Check for unclosed brackets or parentheses',
        'Verify all required fields are present',
        'Look for incomplete structures',
      ],
    }
  } else if (lowerError.includes('duplicate')) {
    return {
      explanation: 'A key or identifier appears more than once where it should be unique.',
      suggestions: [
        'Search for duplicate keys',
        'Rename conflicting identifiers',
        'Consider using an array if multiple values are intended',
      ],
    }
  } else {
    return {
      explanation: 'An error was detected in your file. Review the indicated location for potential issues.',
      suggestions: [
        'Check the syntax around the error location',
        'Verify data types match expectations',
        'Consult file format documentation',
      ],
    }
  }
}
