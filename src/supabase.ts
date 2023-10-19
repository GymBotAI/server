const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase env vars not found");
  process.exit(1);
}

import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(supabaseUrl, supabaseKey);