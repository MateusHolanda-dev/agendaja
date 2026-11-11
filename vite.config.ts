import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],build:{rollupOptions:{output:{manualChunks:{charts:['recharts'],supabase:['@supabase/supabase-js'],forms:['react-hook-form','@hookform/resolvers/zod','zod']}}}}});
