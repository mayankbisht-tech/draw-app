$env:DATABASE_URL='postgresql://neondb_owner:npg_SjOPamJ75fis@ep-restless-frost-adu78b9j-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
$env:JWT_SECRET='123123'
$env:NEXT_PUBLIC_BACKEND_URL='http://localhost:3000'

.\node_modules\.bin\next dev
