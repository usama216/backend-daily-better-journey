export interface BlogPost {
  id: string
  title: string
  slug: string
  excerpt: string
  content: string
  featured_image?: string
  is_featured?: boolean
  author_id: string
  status: 'draft' | 'published'
  views: number
  created_at: string
  updated_at: string
}

export interface NewsletterSubscriber {
  id: string
  email: string
  subscribed_at: string
  unsubscribed_at?: string
  is_active: boolean
}

export interface Quote {
  id: string
  text: string
  author?: string
  created_at: string
}

export interface Category {
  id: string
  name: string
  slug: string
  description?: string
}

export interface Tag {
  id: string
  name: string
  slug: string
}

