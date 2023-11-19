import type { Database } from "./types/database";

import { createClient } from "@supabase/supabase-js";

export function makeSupabase(env: Env) {
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase env vars not found");
  }

  return createClient<Database>(supabaseUrl, supabaseKey);
}
