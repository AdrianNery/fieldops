# FieldOps 🏗️

**Telecom Field Operations Platform**  
Real-time fiber network installation tracking with satellite maps, crew coordination, QC checklists, and photo documentation.

---

## Setup (One-Time)

### 1. Install dependencies
```bash
cd /Users/iris/.openclaw/workspace/fieldops
npm install
```

### 2. Supabase — Run the schema
1. Go to [supabase.com](https://supabase.com) → your project
2. Click **SQL Editor** in the left sidebar
3. Paste the entire contents of `supabase/schema.sql`
4. Click **Run** (green button)

### 3. Supabase — Create storage bucket
1. Click **Storage** in the left sidebar
2. Click **New bucket**
3. Name it exactly: `fieldops-media`
4. Check **Public bucket** ✓
5. Click **Save**

### 4. Supabase — Allow local dev URL
1. Click **Authentication** → **URL Configuration**
2. Under **Redirect URLs**, add: `http://localhost:5173`
3. Save

### 5. Run the app
```bash
npm run dev
```
Open: http://localhost:5173

---

## First Admin Account

1. Open the app and sign up with your email
2. Go to Supabase → **SQL Editor** and run:
```sql
UPDATE profiles SET role = 'admin' WHERE email = 'your@email.com';
```
3. Refresh the app — you now have admin access

---

## First Steps in the App

### As Admin:
1. Go to **⚙️ Admin Settings**
2. Add **Handhole Types** (e.g., "6x6 Standard", "12x24 Large")
3. Add **Pedestal Types** (e.g., "Mini Pedestal", "Standard Pedestal")
4. Add **Pipe Sizes** (e.g., "1 inch", "2 inch", "4 inch")
5. Create **Checklist Templates** for each item type
6. Go to **Projects** → **New Project** → enter name + GPS coordinates
7. Open the project → enable **✏️ Draw Mode**
8. Draw bore paths (line tool) and place handholes/pedestals (point tool)

### As Crew:
- View assigned projects
- Click any item on the map to open its detail panel
- Check off QC checklist items
- Add notes and attach photos/videos

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite |
| Map | Mapbox GL JS v3 |
| Drawing | Mapbox GL Draw |
| Auth | Supabase Auth |
| Database | Supabase PostgreSQL |
| Storage | Supabase Storage |
| Real-time | Supabase Realtime |
| Styling | Tailwind CSS |

---

## Deploy to Production

```bash
npm run build
```
Upload the `dist/` folder to Vercel, Netlify, or any static host.

Update Supabase redirect URLs to include your production domain.

---

## Status Colors
| Color | Status |
|-------|--------|
| 🔴 Red | Not Started |
| 🟡 Yellow | In Progress |
| 🟠 Orange | Needs Attention |
| 🟢 Green | Complete |
