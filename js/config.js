// URL base del backend (Django). Cargar este archivo ANTES que el script de la página.
const API_URL = "http://127.0.0.1:8000";


// Credenciales de Supabase
const SUPABASE_URL = "https://fzfiwitvjqlrqimxxcmt.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6Zml3aXR2anFscnFpbXh4Y210Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNzc1MzUsImV4cCI6MjEwNzY1MzUzNX0.GcQfQLvHzHRW8oRVkROgkyeeNxe1PtukEgQeBa5ex0k";


// Cliente Supabase global (requiere cargar previamente el CDN del SDK de Supabase)
let supabaseClient = null;
if (window.supabase && typeof window.supabase.createClient === 'function') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
