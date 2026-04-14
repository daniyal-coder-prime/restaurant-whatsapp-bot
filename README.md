# Restaurant WhatsApp Ordering Bot

A WhatsApp-based ordering automation SaaS for Pakistani restaurants.

Customer sends **"hi"** on WhatsApp → gets the menu → places order → restaurant owner gets notified on their personal WhatsApp. No app, no dashboard, no complexity.

**Business model:** $50/month per restaurant. ~$7/month infrastructure. 85%+ margin.

---

## Architecture

```
Customer WhatsApp
       ↓
WhatsApp Business API (Meta)
       ↓
N8N Workflow (self-hosted)
       ↓              ↓
PostgreSQL DB    Admin personal WhatsApp
(save order)     (notify owner instantly)
```

**Stack:**
- **Backend:** Node.js + Express (port 3000)
- **Automation:** N8N self-hosted (port 5678)
- **DB:** SQLite (local dev) / PostgreSQL (production)
- **Messaging:** WhatsApp Business API (Meta)
- **Tunnel (dev):** ngrok

---

## Project Structure

```
restaurant-automation/
├── backend/
│   ├── src/
│   │   ├── app.js              # Express server — 3 endpoints only
│   │   ├── db.js               # DB adapter — auto-detects SQLite vs PostgreSQL
│   │   └── routes/
│   │       ├── menu.js         # GET /api/menu/:restaurant_id
│   │       └── orders.js       # POST /api/orders, POST /api/orders/:id/payment-status
│   ├── database/
│   │   ├── schema.sql          # PostgreSQL schema (3 tables)
│   │   ├── schema-sqlite.sql   # SQLite schema (3 tables)
│   │   └── seed.js             # Seeds one restaurant + 10 menu items
│   ├── .env                    # Local env config (USE_SQLITE=true)
│   ├── .env.example            # Template for env vars
│   └── package.json            # Minimal deps: express, pg, better-sqlite3, dotenv
│
├── n8n-workflows/
│   ├── 01-message-receiver-router.json   # Webhook + message parser + router
│   ├── 02-menu-display-bot.json          # Fetches menu, formats, sends to customer
│   ├── 03-order-processing.json          # Full order conversation state machine
│   └── 04-daily-analytics.json           # 11PM cron → daily report to admin WhatsApp
│
├── start-backend.bat           # Starts backend on port 3000
├── start-n8n.bat               # Starts N8N with all env vars set
└── README.md
```

---

## What Each File Does

### `backend/src/app.js`
Entry point. Mounts two route groups and a `/health` endpoint. No JWT, no WebSocket, no Firebase — stripped to the minimum.

### `backend/src/db.js`
Smart database adapter. Reads `USE_SQLITE=true` from `.env`:
- **SQLite mode:** converts `$1,$2` placeholders to `?`, handles `RETURNING` clauses, normalizes booleans
- **PostgreSQL mode:** passes queries directly to `pg` pool

Switching from dev (SQLite) to prod (PostgreSQL) = change one env var.

### `backend/src/routes/menu.js`
Single endpoint: `GET /api/menu/:restaurant_id`
Returns all available menu items ordered by `sort_order`. N8N calls this to build the menu message.

### `backend/src/routes/orders.js`
Three endpoints:
- `POST /api/orders` — saves new order, returns `order_id`
- `POST /api/orders/:id/payment-status` — marks order as `paid` or `rejected`
- `GET /api/orders/:id` — fetches order details (used by N8N for admin notification)

### `backend/database/schema.sql` + `schema-sqlite.sql`
**3 tables only:**
- `restaurants` — name, WhatsApp numbers, bank details
- `menu_items` — items linked to a restaurant
- `orders` — customer orders with JSONB item list, payment + order status

### `backend/database/seed.js`
Seeds **Ahmed Biryani House** with 10 menu items across 5 categories (Biryani, Karahi, BBQ, Bread, Sides). Prints the `RESTAURANT_ID` UUID you need for N8N env vars.

Run: `USE_SQLITE=true node database/seed.js`

### `n8n-workflows/01-message-receiver-router.json`
The main webhook that Meta calls for every incoming WhatsApp message.
- Handles Meta's webhook verification (GET request with `hub.challenge`)
- Parses message: extracts `from`, `type`, `text`, `media_id`
- Routes based on message content:
  - `hi/hello/menu/1` → trigger menu display
  - `done/confirm/2` → trigger order flow
  - image → forward screenshot to admin
  - anything else → send help message

### `n8n-workflows/02-menu-display-bot.json`
Triggered when customer says hi.
1. Calls `GET /api/menu/:restaurant_id`
2. Formats items by category with numbered list
3. Sends formatted menu to customer via WhatsApp
4. Saves customer state in N8N static data: `{ step: 'cart_building', items_list: [...] }`

### `n8n-workflows/03-order-processing.json`
Full conversation state machine. Tracks each customer through:
```
cart_building → awaiting_name → awaiting_address → awaiting_payment → order_placed
```
- Parses cart from input like `1 x2, 3 x1`
- Collects name + address + payment method
- If bank transfer: sends bank account details to customer
- Saves order via `POST /api/orders`
- Sends confirmation to customer + full order notification to admin WhatsApp
- Clears customer state after order placed

### `n8n-workflows/04-daily-analytics.json`
Cron job (11 PM daily). Queries today's orders from PostgreSQL, formats a summary report, sends it to admin's personal WhatsApp:
```
📊 Daily Report — Monday, April 14 2026
Total Orders: 12
Revenue: PKR 18,400
Delivered: 9
Bank Transfer: 5 | COD: 7
```

### `start-n8n.bat`
Runs N8N with all environment variables pre-set (backend URL, restaurant ID, WhatsApp credentials). Edit this file with your Meta credentials before running.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health check |
| GET | `/api/menu/:restaurant_id` | Get available menu items |
| POST | `/api/orders` | Create new order |
| POST | `/api/orders/:id/payment-status` | Update payment status |
| GET | `/api/orders/:id` | Get order details |

### POST `/api/orders` body:
```json
{
  "restaurant_id": "uuid",
  "customer_phone": "+92300XXXXXXX",
  "customer_name": "Ahmed",
  "delivery_address": "House 5, Street 3, Lahore",
  "order_items": [{"name": "Chicken Biryani", "qty": 2, "price": 350}],
  "total_amount": 700,
  "payment_method": "cod"
}
```

---

## Local Setup

```bash
# 1. Clone and install
git clone https://github.com/daniyal-coder-prime/restaurant-whatsapp-bot
cd restaurant-whatsapp-bot/backend
npm install

# 2. Seed database
USE_SQLITE=true node database/seed.js
# → prints RESTAURANT_ID, copy it

# 3. Start backend
node src/app.js
# → Backend running on port 3000

# 4. Test
curl http://localhost:3000/health
curl http://localhost:3000/api/menu/YOUR_RESTAURANT_ID

# 5. Start N8N
cd ..
n8n start
# → Open http://localhost:5678

# 6. Import workflows
# N8N → Workflows → Import from file
# Import all 4 files from n8n-workflows/ folder

# 7. Expose N8N publicly (for Meta webhook)
ngrok http 5678
# → Copy https://xxxx.ngrok-free.app URL
```

---

## Environment Variables

### Backend (`.env`):
```env
PORT=3000
USE_SQLITE=true                          # false for production
SQLITE_PATH=./database/restaurant_bot.db
# DATABASE_URL=postgresql://...          # production only
```

### N8N (`start-n8n.bat`):
```
BACKEND_URL        = http://localhost:3000
RESTAURANT_ID      = (from seed.js output)
WA_PHONE_NUMBER_ID = (from Meta dashboard)
WA_ACCESS_TOKEN    = (from Meta dashboard)
ADMIN_WHATSAPP     = 923XXXXXXXXX
WEBHOOK_URL        = https://xxxx.ngrok-free.app/
```

---

## Database Schema

```sql
restaurants   — id, name, whatsapp_number, admin_whatsapp, bank details
menu_items    — id, restaurant_id, item_name, price, category, sort_order
orders        — id (SERIAL), restaurant_id, customer_phone, order_items (JSONB),
                total_amount, payment_method, payment_status, order_status
```

---

## Customer Flow (WhatsApp Conversation)

```
Customer: hi
Bot: 🍽️ Welcome to Ahmed Biryani House!
     ── Biryani ──
     1. Chicken Biryani — PKR 350
     2. Beef Biryani — PKR 400
     ...
     Reply with item numbers + qty. Example: 1 x2, 3 x1
     Reply DONE when finished.

Customer: 1 x2, 8 x2
Bot: Your Order:
     • Chicken Biryani x2 — PKR 700
     • Naan x2 — PKR 60
     Total: PKR 760
     What's your name?

Customer: Ahmed
Bot: Got it, Ahmed! What's your delivery address?

Customer: House 5 Block B DHA Lahore
Bot: How would you like to pay?
     1) Bank Transfer  2) Cash on Delivery

Customer: 1
Bot: Transfer PKR 760 to:
     Bank: HBL | Account: 1234-5678-9012 | Name: Ahmed Khan
     Send screenshot after transfer.

[Customer sends screenshot]
Bot: Screenshot received ✅ We'll verify and confirm shortly.

[Admin receives on personal WhatsApp:]
🆕 New Order #42
👤 Ahmed | 📞 +92300XXX | 📍 House 5 DHA
• Chicken Biryani x2 — PKR 700
• Naan x2 — PKR 60
💰 Total: PKR 760 | Bank Transfer — awaiting screenshot
```

---

## Production Deployment

```bash
# DigitalOcean $6/month droplet (Ubuntu 22.04)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs postgresql nginx certbot python3-certbot-nginx
npm install -g n8n pm2

# PostgreSQL setup
sudo -u postgres psql -c "CREATE DATABASE restaurant_bot;"
psql -U postgres -d restaurant_bot -f backend/database/schema.sql
USE_SQLITE=false node backend/database/seed.js

# Start services
pm2 start backend/src/app.js --name backend
pm2 start n8n --name n8n
pm2 save

# SSL + nginx
sudo certbot --nginx -d n8n.yourdomain.com
```

---

## Cost Breakdown

| Item | Cost |
|------|------|
| DigitalOcean droplet | $6/month |
| Domain + SSL (Let's Encrypt) | $10/year |
| WhatsApp API (Meta) | Free up to 1,000 conversations/month |
| N8N self-hosted | $0 |
| PostgreSQL self-hosted | $0 |
| **Total** | **~$7/month** |

**10 restaurants = $500/month revenue, $493/month profit.**

---

## What Still Needs To Be Done

### 🔴 Immediate (before first client)

- [ ] **WhatsApp Business API access** — Complete Meta developer account verification (currently blocked on phone verification). Alternative: use Twilio WhatsApp Sandbox for testing.
- [ ] **Set Meta webhook** — Point `https://your-ngrok-url/webhook/whatsapp` to N8N workflow 01, verify token `mytoken123`
- [ ] **Fill `start-n8n.bat`** — Add `WA_PHONE_NUMBER_ID`, `WA_ACCESS_TOKEN`, `ADMIN_WHATSAPP` from Meta dashboard
- [ ] **N8N credentials** — In N8N UI: create `WhatsApp API` credential (Header Auth: `Authorization: Bearer YOUR_TOKEN`)
- [ ] **Activate all 4 workflows** — Toggle ON in N8N UI
- [ ] **End-to-end test** — Send "hi" to WhatsApp test number, complete a full order

### 🟡 Before Production (VPS deploy)

- [ ] **Buy DigitalOcean $6 droplet** — Ubuntu 22.04
- [ ] **Point domain to server** — e.g. `n8n.yourdomain.com`
- [ ] **Install stack on VPS** — Node.js, PostgreSQL, N8N, nginx, certbot
- [ ] **SSL certificate** — `sudo certbot --nginx -d n8n.yourdomain.com`
- [ ] **Switch to PostgreSQL** — Set `USE_SQLITE=false`, provide `DATABASE_URL`
- [ ] **PM2 process manager** — Keep backend + N8N alive after server restart
- [ ] **UFW firewall** — Allow only ports 22, 80, 443

### 🟢 After First Paying Client

- [ ] **Multi-tenant routing** — Add `whatsapp_number_id` column to `restaurants` table, route by incoming phone number ID instead of env var
- [ ] **Menu management** — Simple way for restaurant owner to update menu without DB access
- [ ] **Urdu language support** — Bigger market in Pakistan
- [ ] **Admin web panel** — For managing multiple restaurants (needed at 10+ clients)
- [ ] **Automated payment confirmation** — Admin replies `confirm 42` → N8N auto-updates order status

---

## Onboarding a New Restaurant

```
[ ] Register their WhatsApp Business number with Meta
[ ] INSERT into restaurants table (name, numbers, bank details)
[ ] INSERT menu items
[ ] Set RESTAURANT_ID in N8N env for their workflow instance
[ ] Test one message end-to-end
[ ] Hand over: "New orders come to your personal WhatsApp"
[ ] Charge $50/month
```

---

## Built With

- [Node.js](https://nodejs.org/) + [Express](https://expressjs.com/)
- [N8N](https://n8n.io/) — self-hosted workflow automation
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — local dev database
- [PostgreSQL](https://www.postgresql.org/) — production database
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp) — messaging
- [ngrok](https://ngrok.com/) — local tunnel for webhook testing
