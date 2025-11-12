import express, { Request, Response } from 'express'
import cors from 'cors'
import morgan from 'morgan'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import multer from 'multer'
import path from 'path'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)
// Admin client for storage ops
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

const UPLOAD_BUCKET = process.env.SUPABASE_BUCKET || 'images'

// Multer for multipart parsing (memory storage)
const upload = multer({ storage: multer.memoryStorage() })

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
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
// Categories Routes
app.get('/api/categories', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true })

    if (error) throw error
    res.json({ success: true, data })
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch categories', error: error.message })
  }
})

app.post('/api/categories', async (req: Request, res: Response) => {
  try {
    const { name, slug, description } = req.body
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' })
    const generatedSlug = (slug || name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

    const { data, error } = await supabase
      .from('categories')
      .insert([{ name, slug: generatedSlug, description: description || null }])
      .select()
      .single()

    if (error) throw error
    res.json({ success: true, message: 'Category created', data })
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to create category', error: error.message })
  }
})

app.put('/api/categories/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { name, slug, description } = req.body
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (slug !== undefined) updateData.slug = slug
    if (description !== undefined) updateData.description = description

    const { data, error } = await supabase
      .from('categories')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    res.json({ success: true, message: 'Category updated', data })
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update category', error: error.message })
  }
})

app.delete('/api/categories/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) throw error
    res.json({ success: true, message: 'Category deleted' })
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to delete category', error: error.message })
  }
})

// Posts by category slug (published only by default)
app.get('/api/categories/:slug/posts', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params
    // Find category
    const { data: category, error: catErr } = await supabase
      .from('categories')
      .select('*')
      .eq('slug', slug)
      .single()
    if (catErr) throw catErr

    // Get posts
    const { data: posts, error: postsErr } = await supabase
      .from('posts')
      .select('*')
      .eq('category_id', category.id)
      .order('created_at', { ascending: false })

    if (postsErr) throw postsErr
    res.json({ success: true, category, data: posts })
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch posts by category', error: error.message })
  }
})

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

// Create new post
app.post('/api/posts', async (req: Request, res: Response) => {
  try {
    const { title, slug, excerpt, content, featured_image, is_featured, status, category_id, tags, meta_description, meta_keywords } = req.body
    
    if (!title || !content) {
      return res.status(400).json({ 
        success: false, 
        message: 'Title and content are required' 
      })
    }

    // Generate slug if not provided
    const generatedSlug = slug || title.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
    
    const postData: any = {
      title,
      slug: generatedSlug,
      excerpt: excerpt || content.substring(0, 200),
      content,
      featured_image: featured_image || null,
      is_featured: !!is_featured,
      status: status || 'draft',
      author_id: 'admin', // TODO: Get from auth middleware
      views: 0,
      meta_description: meta_description || null,
      meta_keywords: meta_keywords || null,
      category_id: category_id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    const { data, error } = await supabase
      .from('posts')
      .insert([postData])
      .select()
      .single()
    
    if (error) throw error
    
    res.json({ 
      success: true, 
      message: 'Post created successfully',
      data 
    })
  } catch (error: any) {
    console.error('Create post error:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create post',
      error: error.message 
    })
  }
})

// Update post
app.put('/api/posts/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { title, slug, excerpt, content, featured_image, is_featured, status, category_id, tags, meta_description, meta_keywords } = req.body
    
    const updateData: any = {
      updated_at: new Date().toISOString()
    }
    
    if (title) updateData.title = title
    if (slug) updateData.slug = slug
    if (excerpt !== undefined) updateData.excerpt = excerpt
    if (content) updateData.content = content
    if (featured_image !== undefined) updateData.featured_image = featured_image
    if (is_featured !== undefined) updateData.is_featured = !!is_featured
    if (status) updateData.status = status
    if (category_id !== undefined) updateData.category_id = category_id
    if (meta_description !== undefined) updateData.meta_description = meta_description
    if (meta_keywords !== undefined) updateData.meta_keywords = meta_keywords
    
    const { data, error } = await supabase
      .from('posts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    
    if (!data) {
      return res.status(404).json({ 
        success: false, 
        message: 'Post not found' 
      })
    }
    
    res.json({ 
      success: true, 
      message: 'Post updated successfully',
      data 
    })
  } catch (error: any) {
    console.error('Update post error:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update post',
      error: error.message 
    })
  }
})

// Delete post
app.delete('/api/posts/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', id)
    
    if (error) throw error
    
    res.json({ 
      success: true, 
      message: 'Post deleted successfully' 
    })
  } catch (error: any) {
    console.error('Delete post error:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete post',
      error: error.message 
    })
  }
})

// Update post status
app.patch('/api/posts/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { status } = req.body
    
    if (!status || !['draft', 'published'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid status (draft or published) is required' 
      })
    }
    
    const { data, error } = await supabase
      .from('posts')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    
    res.json({ 
      success: true, 
      message: 'Post status updated successfully',
      data 
    })
  } catch (error: any) {
    console.error('Update status error:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update post status',
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

// Comments Routes
// Get comments for a specific post (only approved)
app.get('/api/comments/:postId', async (req: Request, res: Response) => {
  try {
    const { postId } = req.params
    
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', postId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    res.json(data || [])
  } catch (error: any) {
    console.error('Fetch comments error:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch comments',
      error: error.message 
    })
  }
})

// Create new comment
app.post('/api/comments', async (req: Request, res: Response) => {
  try {
    const { post_id, author_name, author_email, comment_text } = req.body
    
    // Validation
    if (!post_id || !author_name || !author_email || !comment_text) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields are required' 
      })
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(author_email)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid email format' 
      })
    }
    
    const commentData = {
      post_id: post_id, // UUID, no need to parse
      author_name: author_name.trim(),
      author_email: author_email.trim().toLowerCase(),
      comment_text: comment_text.trim(),
      status: 'approved', // Auto-approve for testing (change to 'pending' for moderation)
      created_at: new Date().toISOString()
    }
    
    const { data, error } = await supabase
      .from('comments')
      .insert([commentData])
      .select()
      .single()
    
    if (error) throw error
    
    res.json({ 
      success: true, 
      message: 'Comment submitted successfully. It will appear after approval.',
      data 
    })
  } catch (error: any) {
    console.error('Create comment error:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Failed to submit comment',
      error: error.message 
    })
  }
})

// Admin: Get all comments (with status filter)
app.get('/api/admin/comments', async (req: Request, res: Response) => {
  try {
    const { status } = req.query
    
    let query = supabase
      .from('comments')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (status) {
      query = query.eq('status', status)
    }
    
    const { data, error } = await query
    
    if (error) throw error
    
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Fetch all comments error:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch comments',
      error: error.message 
    })
  }
})

// Admin: Update comment status (approve/spam/pending)
app.patch('/api/admin/comments/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { status } = req.body
    
    if (!status || !['pending', 'approved', 'spam'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid status (pending, approved, or spam) is required' 
      })
    }
    
    const { data, error } = await supabase
      .from('comments')
      .update({ status })
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    
    res.json({ 
      success: true, 
      message: `Comment ${status}`,
      data 
    })
  } catch (error: any) {
    console.error('Update comment status error:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update comment status',
      error: error.message 
    })
  }
})

// Admin: Delete comment
app.delete('/api/admin/comments/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', id)
    
    if (error) throw error
    
    res.json({ 
      success: true, 
      message: 'Comment deleted successfully' 
    })
  } catch (error: any) {
    console.error('Delete comment error:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete comment',
      error: error.message 
    })
  }
})

// Image upload endpoint (multipart/form-data)
app.post('/api/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file provided' })
    }

    const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg'
    const filePath = `posts/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`

    const { error } = await supabaseAdmin.storage
      .from(UPLOAD_BUCKET)
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype || 'image/jpeg',
        upsert: false,
      })

    if (error) throw error

    const { data: pub } = supabaseAdmin.storage.from(UPLOAD_BUCKET).getPublicUrl(filePath)
    return res.json({ success: true, url: pub.publicUrl })
  } catch (error: any) {
    console.error('Upload error:', error)
    return res.status(500).json({ success: false, message: 'Failed to upload image', error: error.message })
  }
})

// Ensure storage bucket exists (best-effort)
const initializeBucket = async () => {
  try {
    const { data: buckets } = await supabaseAdmin.storage.listBuckets()
    const exists = buckets?.some((b) => b.name === UPLOAD_BUCKET)
    if (!exists) {
      await supabaseAdmin.storage.createBucket(UPLOAD_BUCKET, { public: true })
      console.log(`✅ Created bucket: ${UPLOAD_BUCKET}`)
    } else {
      console.log(`✅ Bucket '${UPLOAD_BUCKET}' already exists`)
    }
  } catch (e) {
    console.warn('⚠️  Bucket check/create skipped:', (e as Error).message)
  }
}

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Server is running on port ${PORT}`)
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`)
  await initializeBucket()
})

