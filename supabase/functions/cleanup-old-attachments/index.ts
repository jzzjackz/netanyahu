// Supabase Edge Function to delete attachments older than 30 days
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    console.log('Looking for messages older than:', thirtyDaysAgo.toISOString())
    
    // Find messages with attachments older than 30 days
    const { data: oldMessages, error: messagesError } = await supabase
      .from('messages')
      .select('id, attachments, created_at')
      .lt('created_at', thirtyDaysAgo.toISOString())
      .not('attachments', 'is', null)
    
    if (messagesError) {
      console.error('Error fetching messages:', messagesError)
      return new Response(JSON.stringify({ error: messagesError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // Also check direct messages
    const { data: oldDMs, error: dmsError } = await supabase
      .from('direct_messages')
      .select('id, attachments, created_at')
      .lt('created_at', thirtyDaysAgo.toISOString())
      .not('attachments', 'is', null)
    
    if (dmsError) {
      console.error('Error fetching DMs:', dmsError)
    }
    
    const allOldMessages = [...(oldMessages || []), ...(oldDMs || [])]
    console.log(`Found ${allOldMessages.length} messages with attachments to clean up`)
    
    let deletedCount = 0
    let errorCount = 0
    
    // Delete attachments from storage
    for (const message of allOldMessages) {
      if (!message.attachments || !Array.isArray(message.attachments)) continue
      
      for (const attachment of message.attachments) {
        if (!attachment.url) continue
        
        try {
          // Extract file path from URL
          // URL format: https://{project}.supabase.co/storage/v1/object/public/attachments/{path}
          const urlParts = attachment.url.split('/attachments/')
          if (urlParts.length < 2) continue
          
          const filePath = urlParts[1]
          
          // Delete from storage
          const { error: deleteError } = await supabase.storage
            .from('attachments')
            .remove([filePath])
          
          if (deleteError) {
            console.error(`Error deleting ${filePath}:`, deleteError)
            errorCount++
          } else {
            console.log(`Deleted: ${filePath}`)
            deletedCount++
          }
        } catch (err) {
          console.error('Error processing attachment:', err)
          errorCount++
        }
      }
      
      // Update message to remove attachment references
      const table = message.id.includes('-') ? 'messages' : 'direct_messages'
      await supabase
        .from(table)
        .update({ attachments: [] })
        .eq('id', message.id)
    }
    
    const result = {
      success: true,
      messagesProcessed: allOldMessages.length,
      attachmentsDeleted: deletedCount,
      errors: errorCount,
      timestamp: new Date().toISOString()
    }
    
    console.log('Cleanup complete:', result)
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('Function error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
