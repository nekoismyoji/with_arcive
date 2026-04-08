(function() {
    const performersList = ["セラス", "泉", "吟子", "小鈴", "姫芽", "花帆", "さやか", "瑠璃乃", "梢", "綴理", "慈"];

    // 【ここに先ほどの1500件のデータを貼り付けてください】
    const archiveData = [
        { filename: "001_103_0417.jpg", title: "配信 001", performers: [], summary: "" },
        // ... 中略 ...
        { filename: "129_105_megu.jpg", title: "配信 129", performers: [], summary: "" },
    ];

    window.addEventListener('DOMContentLoaded', () => {
        const grid = document.getElementById('archiveGrid');
        const perfContainer = document.getElementById('performerFilters');
        if (!grid || !perfContainer) return;

        // 1. 出演者フィルター生成
        perfContainer.innerHTML = performersList.map(p => 
            `<label style="margin-right:10px; cursor:pointer;"><input type="checkbox" class="filter-perf" value="${p}"> ${p}</label>`
        ).join('');

        // 2. 描画関数
        function render(data) {
            grid.innerHTML = data.map(item => {
                const parts = item.filename.split('_');
                
                // フォルダ名の判定ロジックを強化
                let gen = "103"; // デフォルト
                if (parts.includes("105")) gen = "105";
                else if (parts.includes("104")) gen = "104";
                
                const folder = `${gen}期サムネ`;
                // 日付部分は末尾から取得（拡張子を除去）
                const datePart = parts[parts.length - 1].replace(/\.[^/.]+$/, "").replace("jpg", "");
                
                return `
                    <div class="card" onclick="openModal('${item.filename}')">
                        <img src="${folder}/${item.filename}" loading="lazy" onerror="this.src='https://via.placeholder.com/160x90?text=No+Image'">
                        <div class="card-info">
                            <div>${item.title}</div>
                            <small style="color:#666">${datePart}</small>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // 3. 詳細表示
        window.openModal = function(filename) {
            const item = archiveData.find(d => d.filename === filename);
            if (!item) return;
            
            const parts = filename.split('_');
            let gen = "103";
            if (parts.includes("105")) gen = "105";
            else if (parts.includes("104")) gen = "104";
            
            const folder = `${gen}期サムネ`;
            const datePart = parts[parts.length - 1].replace(/\.[^/.]+$/, "").replace("jpg", "");

            document.getElementById('modalImage').src = `${folder}/${filename}`;
            document.getElementById('modalTitle').innerText = item.title;
            document.getElementById('modalDate').innerText = `日付: ${datePart}`;
            document.getElementById('modalPerformers').innerText = "出演: " + (item.performers.length > 0 ? item.performers.join(', ') : "未設定");
            document.getElementById('modalSummary').innerText = item.summary || "概要はまだありません。";
            document.getElementById('detailModal').style.display = "block";
        };

        // 4. 検索・フィルター
        function filterData() {
            const searchText = document.getElementById('searchInput').value.toLowerCase().split(/\s+/).filter(t => t);
            const searchLogic = document.getElementById('searchLogic').value;
            const selectedGens = Array.from(document.querySelectorAll('.filter-gen:checked')).map(el => el.value);
            const selectedPerfs = Array.from(document.querySelectorAll('.filter-perf:checked')).map(el => el.value);
            const filterLogic = document.getElementById('filterLogic').value;

            const filtered = archiveData.filter(item => {
                const fullText = (item.title + item.summary + item.performers.join('')).toLowerCase();
                
                // 単語検索
                let matchSearch = true;
                if (searchText.length > 0) {
                    matchSearch = (searchLogic === 'AND') 
                        ? searchText.every(t => fullText.includes(t)) 
                        : searchText.some(t => fullText.includes(t));
                }

                // 期フィルター
                const parts = item.filename.split('_');
                let itemGen = "103";
                if (parts.includes("105")) itemGen = "105";
                else if (parts.includes("104")) itemGen = "104";
                const matchGen = selectedGens.length === 0 || selectedGens.includes(itemGen);

                // 出演者フィルター
                const matchPerf = selectedPerfs.length === 0 || (
                    filterLogic === 'AND' 
                        ? selectedPerfs.every(p => item.performers.includes(p)) 
                        : selectedPerfs.some(p => item.performers.includes(p))
                );

                return matchSearch && matchGen && matchPerf;
            });
            render(filtered);
        }

        // イベント登録
        document.querySelectorAll('input, select').forEach(el => el.addEventListener('change', filterData));
        document.getElementById('searchInput').addEventListener('input', filterData);
        document.querySelector('.close').onclick = () => document.getElementById('detailModal').style.display = "none";
        window.onclick = (e) => { if(e.target.id === 'detailModal') document.getElementById('detailModal').style.display = "none"; };

        render(archiveData);
    });
})();
