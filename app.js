
:root {
  color-scheme: light dark;
  --bg: #ffffff;
  --text: #222;
  --muted: #666;
  --primary: #1f7a8c;
  --primary-contrast: #fff;
  --secondary: #e2e8f0;
  --border: #d7d7d7;
  --panel: #f8fafc;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0f1216;
    --text: #eaeaea;
    --muted: #9ba1a6;
    --primary: #43b0f1;
    --secondary: #1f2937;
    --border: #2b3240;
    --panel: #111827;
  }
}

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, 'Noto Sans', 'Helvetica Neue', Arial, 'Apple Color Emoji', 'Segoe UI Emoji'; }

header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px; border-bottom: 1px solid var(--border); background: var(--panel);
}
h1 { margin: 0; font-size: 1.4rem; }
.badge {
  display: inline-block; margin-left: 8px; padding: 2px 8px; border-radius: 999px;
  background: var(--secondary); color: var(--muted); font-size: 0.8rem;
}
#auth button { margin-left: 8px; }

main { padding: 16px; max-width: 1200px; margin: 0 auto; }

.panel {
  background: var(--panel); border: 1px solid var(--border); border-radius: 12px;
  padding: 16px; margin-bottom: 16px;
}
.panel.secondary { background: transparent; }

.grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px;
}
label { display: flex; flex-direction: column; gap: 6px; font-size: 0.95rem; }
input, select, textarea, button {
  font: inherit; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--border);
  background: var(--bg); color: var(--text);
}
textarea { resize: vertical; }
button { cursor: pointer; background: var(--primary); color: var(--primary-contrast); border: none; }
button.secondary { background: var(--secondary); color: var(--text); border: 1px solid var(--border); }
button:disabled { opacity: 0.6; cursor: not-allowed; }

.actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 8px; }

table { width: 100%; border-collapse: collapse; }
thead th {
  text-align: left; padding: 8px; border-bottom: 1px solid var(--border); background: rgba(0,0,0,0.03);
}
tbody td { padding: 8px; border-bottom: 1px solid var(--border); }

.hidden { display: none !important; }
.admin-only.hidden { display: none !important; }

/* Acciones solo visibles para Admin */
body.role-user .acciones-admin { display: none !important; }

.file-label {
  display: inline-flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px dashed var(--border);
  border-radius: 8px; background: var(--bg); color: var(--text);
}
.file-label input[type=file] { display: none; }

footer { padding: 16px; text-align: center; color: var(--muted); }

/* Lista Admin de Hanes/Grupos */
#hanList li, #grupoList li {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px; border-bottom: 1px solid var(--border);
}
