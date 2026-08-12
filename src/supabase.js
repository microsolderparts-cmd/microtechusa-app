import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase environment variables.");
}

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);

export async function testSupabaseConnection() {
  const { data, error } = await supabase
    .from("repairs")
    .select("id")
    .limit(1);

  if (error) {
    console.error("Supabase connection error:", error);
    return false;
  }

  console.log("Supabase connected successfully!", data);
  return true;
}