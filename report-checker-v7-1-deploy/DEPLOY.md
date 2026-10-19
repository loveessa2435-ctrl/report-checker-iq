# Report Checker IQ V7.1 — deployment

## Before deploying
1. Use a private GitHub repository. Do NOT commit `.env` or any database.
2. Confirm `npm install`, `npm run check`, and `npm start` locally.
3. Choose a host with an **always-running worker/container** and **persistent disk/volume**. Free tiers may have limitations or expire.
4. Mount a persistent volume at `/data`, then set `DATA_DIR=/data`. **Without a volume SQLite data will be lost during redeploy/restart.**
5. Configure secret environment variables in the hosting dashboard:
   - `BOT_TOKEN` (secret)
   - `ADMIN_ID=7808854789`
   - `CHANNEL_ID=@sisneodbdj`
   - `CHANNEL_URL=https://t.me/sisneodbdj`
   - `DATA_DIR=/data`
   - optional `OPENAI_API_KEY` for AI, only after informing students of external processing.
6. Deploy using Dockerfile; no public HTTP port is required (Telegram long polling). Keep exactly **one replica** and stop the local instance when cloud instance starts.
7. Verify `/start`, membership check, DOCX/PDF, `/stats`, and broadcast preview from admin account.

## Migration
If migrating the existing users, stop both instances and copy the current `data/bot.sqlite` and its `-wal` and `-shm` files consistently to the persistent volume, ideally after a SQLite backup or clean shutdown. Never commit them to Git.

## Notes
`npm start` does not require an `.env` file on the host; dotenv loads it locally when present. Host environment variables take precedence. The `Dockerfile` includes TypeScript dev dependencies because tsx runs source directly. PDF processing may need more memory than small free plans provide.
