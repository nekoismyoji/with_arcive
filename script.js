(function() {
    const performersList = ["セラス", "泉", "吟子", "小鈴", "姫芽", "花帆", "さやか", "瑠璃乃", "梢", "綴理", "慈"];
    let archiveData = []; 
    let currentFilteredData = [];
    let displayCount = 0;
    const BATCH_SIZE = 30; // 1回に表示する件数

    // 取得結果のメモリキャッシュ
    const fileInfoCache = new Map();

    // 外部通信を使わずに即座に描画する「画像読み込み失敗用」SVGデータ
    const NO_IMAGE_SVG = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='180' viewBox='0 0 320 180'%3E%3Crect width='100%25' height='100%25' fill='%232e2e38'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23a0a0b0' font-size='14' font-family='sans-serif'%3E⚠️ 画像が読み込めません%3C/text%3E%3C/svg%3E";

    function getFileInfo(filename) {
        if (fileInfoCache.has(filename)) {
            return fileInfoCache.get(filename);
        }

        const parts = filename.split('_');
        let gen = parts[1] || "103"; 

        const folder = gen + "期サムネ";
        const lastPart = parts[parts.length - 1];
        let rawDate = lastPart.replace('.webp', '').replace('.jpg', '').replace('.jpeg', '').replace('.', '');
        
        let date = rawDate;
        if (/^\d{4}$/.test(rawDate)) {
            date = rawDate.substring(0, 2) + "/" + rawDate.substring(2, 4);
        } else if (rawDate === "megu") {
            date = "特別配信";
        }
        
        const res = { gen, folder, date };
        fileInfoCache.set(filename, res);
        return res;
    }

    // 入力頻度制限（デバウンス）用タイマー
    let debounceTimer = null;
    function debounceFilter() {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(filterData, 150);
    }
    
    function render(data, isAppend = false) {
        const grid = document.getElementById('archiveGrid');
        if (!grid) return;

        if (!isAppend) {
            grid.innerHTML = '';
            displayCount = 0;
            currentFilteredData = data;
        }

        if (currentFilteredData.length === 0) {
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #888;">該当する配信アーカイブが見つかりませんでした。</div>';
            return;
        }

        const nextBatch = currentFilteredData.slice(displayCount, displayCount + BATCH_SIZE);
        if (nextBatch.length === 0) return;

        const html = nextBatch.map(item => {
            const info = getFileInfo(item.filename);
            const titleText = item.title ? item.title : '（タイトル未設定）';
            
            return `
                <div class="card" onclick="openModal('${item.filename}')">
                    <div class="card-img-wrapper" style="background-color: #222;">
                        <img src="${info.folder}/${item.filename}" 
                             loading="lazy" 
                             decoding="async" 
                             width="320" 
                             height="180" 
                             onerror="this.onerror=null; this.src='${NO_IMAGE_SVG}';">
                    </div>
                    <div class="card-info">
                        <div class="card-title">${titleText}</div>
                        <div class="card-date">${info.date}</div>
                    </div>
                </div>
            `;
        }).join('');

        grid.insertAdjacentHTML('beforeend', html);
        displayCount += nextBatch.length;
    }

    // スクロール時の追加読み込み
    window.addEventListener('scroll', () => {
        const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
        if (scrollTop + clientHeight >= scrollHeight - 300) {
            render(currentFilteredData, true);
        }
    });

    window.openModal = function(filename) {
        const item = archiveData.find(d => d.filename === filename);
        if (!item) return;
        const info = getFileInfo(filename);
        
        const originalJpg = filename.replace('.webp', '.jpg');
        const modalImg = document.getElementById('modalImage');
        
        modalImg.src = `${info.folder}/${originalJpg}`;
        modalImg.onerror = function() { 
            this.src = `${info.folder}/${filename}`;
            this.onerror = function() {
                this.onerror = null;
                this.src = NO_IMAGE_SVG;
            };
        };

        document.getElementById('modalTitle').innerText = item.title || "（タイトル未設定）";
        document.getElementById('modalDate').innerText = `配信日: ${info.date} (${info.gen}期)`;
        
        if (item.performers && item.performers.length > 0) {
            document.getElementById('modalPerformers').innerText = "出演: " + item.performers.join(', ');
        } else {
            document.getElementById('modalPerformers').innerText = "出演: （出演者情報はありません）";
        }

        if (item.summary && item.summary.trim() !== "") {
            document.getElementById('modalSummary').innerText = item.summary;
        } else {
            document.getElementById('modalSummary').innerText = "（この配信の概要文・トピック情報はありません）";
        }
        
        document.getElementById('detailModal').style.display = "block";
    };

    function filterData() {
        const searchText = document.getElementById('searchInput').value.toLowerCase().split(/\s+/).filter(t => t);
        const searchLogic = document.getElementById('searchLogic').value;
        const selectedGens = Array.from(document.querySelectorAll('.filter-gen:checked')).map(el => el.value);
        const selectedPerfs = Array.from(document.querySelectorAll('.filter-perf:checked')).map(el => el.value);
        const filterLogic = document.getElementById('filterLogic').value;

        const filtered = archiveData.filter(item => {
            // キャッシュ済みの基本情報を参照
            const info = getFileInfo(item.filename);

            // 1. 期フィルターチェック
            if (selectedGens.length > 0 && !selectedGens.includes(info.gen)) {
                return false;
            }

            // 2. 出演者フィルターチェック
            if (selectedPerfs.length > 0) {
                if (!item.performers) return false;
                if (filterLogic === 'AND') {
                    const hasAll = selectedPerfs.every(p => item.performers.some(full => full.includes(p)));
                    if (!hasAll) return false;
                } else {
                    const hasAny = selectedPerfs.some(p => item.performers.some(full => full.includes(p)));
                    if (!hasAny) return false;
                }
            }

            // 3. 単語検索チェック（事前キャッシュされたsearchKeyを使用）
            if (searchText.length > 0) {
                if (searchLogic === 'AND') {
                    return searchText.every(t => item.searchKey.includes(t));
                } else {
                    return searchText.some(t => item.searchKey.includes(t));
                }
            }

            return true;
        });

        render(filtered);
    }

    window.addEventListener('DOMContentLoaded', async () => {
        const perfContainer = document.getElementById('performerFilters');
        if (perfContainer) {
            perfContainer.innerHTML = performersList.map(p => 
                `<label style="margin-right:10px; cursor:pointer;"><input type="checkbox" class="filter-perf" value="${p}"> ${p}</label>`
            ).join('');
        }

        const jsonFiles = ['data_103.json', 'data_104.json', 'data_105.json'];
        
        const loadPromises = jsonFiles.map(async (file) => {
            try {
                const res = await fetch(file);
                if (!res.ok) throw new Error("File not found");
                return await res.json();
            } catch (err) {
                console.warn(`${file} の読み込みに失敗しました:`, err);
                return [];
            }
        });

        const dataSets = await Promise.all(loadPromises);
        archiveData = dataSets.flat();

        // 検索時の文字結合コストを避けるため、読み込み時に検索用文字列（searchKey）を一括事前生成
        archiveData.forEach(item => {
            item.searchKey = ((item.title || "") + " " + (item.summary || "") + " " + (item.performers ? item.performers.join(' ') : "")).toLowerCase();
        });

        render(archiveData);

        // イベントバインドの最適化
        document.querySelectorAll('.filter-gen, .filter-perf, select').forEach(el => {
            el.addEventListener('change', filterData);
        });

        // リアルタイムテキスト入力にはデバウンスを適用
        document.getElementById('searchInput').addEventListener('input', debounceFilter);

        document.querySelector('.close').onclick = () => document.getElementById('detailModal').style.display = "none";
        window.onclick = (e) => { if(e.target.id === 'detailModal') document.getElementById('detailModal').style.display = "none"; };
    });
})();