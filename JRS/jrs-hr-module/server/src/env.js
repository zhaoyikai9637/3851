import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
// Resolve local secrets relative to the server package, not the caller's cwd.
dotenv.config({path:fileURLToPath(new URL('../.env',import.meta.url)),quiet:true});
