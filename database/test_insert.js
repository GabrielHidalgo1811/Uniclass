require('dotenv').config({ path: './frontend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);

async function createTestClass() {
    // 1. Get a user
    const { data: { users }, error: authErr } = await supabase.auth.admin.listUsers();
    // As this is client anon key, auth.admin will fail, let's login
}

createTestClass();
