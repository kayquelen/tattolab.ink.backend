export const config = {
  port: process.env.PORT || 54976,
  host: process.env.HOST || '0.0.0.0',
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true
  },
  supabase: {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    bucket: process.env.SUPABASE_BUCKET || 'downloads'
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-jwt-secret'
  }
}
