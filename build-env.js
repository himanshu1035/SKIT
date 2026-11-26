const fs = require("fs");

const envData = {
  SUPABASE_URL: process.env.SUPABASE_URL || "",
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || ""
};

fs.writeFileSync("js/env.json", JSON.stringify(envData));
console.log("Generated js/env.json for deployment.");
