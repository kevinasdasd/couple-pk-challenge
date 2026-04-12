import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://czlsvhvdmrlhvzdzijve.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6bHN2aHZkbXJsaHZ6ZHppanZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4OTQ4MjEsImV4cCI6MjA5MTQ3MDgyMX0.3e2WFr2p-Du2T5GVcVLtoRt7Eftpukvo0Du186m5v5Y";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
