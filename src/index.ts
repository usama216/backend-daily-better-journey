import express, { Request, Response } from 'express'
import cors from 'cors'
import morgan from 'morgan'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}))
app.use(express.json())
app.use(morgan('dev'))

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    message: 'Daily Better Journey API is running',
    timestamp: new Date().toISOString()
  })
})

// Blog Posts Routes
app.get('/api/posts', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    res.json({ success: true, data })
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch posts',
      error: error.message 
    })
  }
})

app.get('/api/posts/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    
    res.json({ success: true, data })
  } catch (error: any) {
    res.status(404).json({ 
      success: false, 
      message: 'Post not found',
      error: error.message 
    })
  }
})

// Newsletter Routes
app.post('/api/newsletter/subscribe', async (req: Request, res: Response) => {
  try {
    const { email } = req.body
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      })
    }
    
    const { data, error } = await supabase
      .from('newsletter_subscribers')
      .insert([{ email }])
      .select()
    
    if (error) throw error
    
    res.json({ 
      success: true, 
      message: 'Successfully subscribed to newsletter',
      data 
    })
  } catch (error: any) {
    console.error('Newsletter subscription error:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Failed to subscribe',
      error: error.message 
    })
  }
})

// Quotes Routes
app.get('/api/quotes/daily', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('quotes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
    
    if (error) throw error
    
    res.json({ success: true, data: data?.[0] || null })
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch daily quote',
      error: error.message 
    })
  }
})

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`)
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`)
})

