:root { --accent: #00a0e9; --bg: #f5f8fa; }
body { font-family: sans-serif; background: var(--bg); margin: 0; color: #333; }

header { 
    background: white; padding: 15px; position: sticky; top: 0; z-index: 10;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}
.header-top, .filter-area { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 10px; align-items: center; }
#searchInput { flex: 1; padding: 8px; border: 1px solid #ccc; border-radius: 4px; min-width: 200px; }
.filter-group { background: #eee; padding: 5px 12px; border-radius: 20px; font-size: 0.85em; display: flex; gap: 8px; }
.label { font-weight: bold; }

.grid-container {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 15px; padding: 20px;
}
.card { background: white; border-radius: 8px; overflow: hidden; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
.card img { width: 100%; aspect-ratio: 16/9; object-fit: cover; }
.card-info { padding: 10px; font-size: 0.85em; font-weight: bold; }

.modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 100; }
.modal-content { background: white; margin: 50px auto; width: 90%; max-width: 600px; border-radius: 12px; overflow: hidden; }
.modal-text { padding: 20px; }
.close { float: right; font-size: 24px; cursor: pointer; padding: 10px; }
.date-label { background: #333; color: white; display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.8em; }
.perf-list { margin: 10px 0; color: var(--accent); font-weight: bold; }
