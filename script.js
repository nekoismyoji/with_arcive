(function() {
    const performersList = ["セラス", "泉", "吟子", "小鈴", "姫芽", "花帆", "さやか", "瑠璃乃", "梢", "綴理", "慈"];

    // 【ここにあなたの1500件のデータを貼り付けてください】
    const archiveData = [
        { filename: "001_103_0417.jpg", title: "配信 001", performers: [], summary: "" },
        // ... (中略) ...
        { filename: "129_105_megu.jpg", title: "配信 129", performers: [], summary: "" }
    ];

    window.addEventListener('DOMContentLoaded', () => {
        const grid = document.getElementById('archiveGrid');
        const perfContainer = document.getElementById('performerFilters');
        if (!grid || !perfContainer) return;

        perfContainer.innerHTML = performersList.map(p => 
            `<label style="margin-right:10px; cursor:pointer;"><input type="checkbox" class="filter-perf" value="${p}"> ${p}</label>`
        ).join('');

        function getInfo(filename) {
            const parts = filename.split('_');
            let gen = "103"; // デフォルト
            if (parts.includes("105")) gen = "105";
            else if (parts.includes("104")) gen = "104";
            
            // 拡張子を除去して日付を特定
            const lastPart = parts[parts.length - 1].split('.')[0];
            const date = lastPart.replace("jpg", "").replace("jpeg", "");
            
            return { gen, date, folder: `${gen}期サムネ` };
        }

        function render(data) {
            grid.innerHTML = data.map(item => {
                const info = getInfo(item.filename);
                return `
                    <div class="card" onclick="openModal('${item.filename}')">
                        <div class="card-img-wrapper">
                            <img src="${info.folder}/${item.filename}" loading="lazy" onerror="this.src='https://via.placeholder.com/160x90?text=No+Image'">
                        </div>
                        <div class="card-info">
                            <div class="card-title">${item.title}</div>
                            <div class="card-date">${info.date}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        window.openModal = function(filename) {
            const item = archiveData.find(d => d.filename === filename);
            if (!item) return;
            
            const info = getInfo(filename);
            const modalImg = document.getElementById('modalImage');
            
            // 画像の設定
            modalImg.src = `${info.folder}/${filename}`;
            modalImg.onerror = function() { this.src = 'https://via.placeholder.com/400x225?text=Image+Not+Found'; };

            // テキスト情報の設定
            document.getElementById('modalTitle').innerText = item.title;
            document.getElementById('modalDate').innerText = `配信日: ${info.date} (${info.gen}期)`;
            document.getElementById('modalPerformers').innerText = "出演: " + (item.performers.length > 0 ? item.performers.join(', ') : "（出演者データ未登録）");
            document.getElementById('modalSummary').innerText = item.summary || "（配信の概要データはまだありません）";
            
            document.getElementById('detailModal').style.display = "block";
            document.body.style.overflow = "hidden"; // 背景スクロール防止
        };

        function filterData() {
            const searchText = document.getElementById('searchInput').value.toLowerCase().split(/\s+/).filter(t => t);
            const searchLogic = document.getElementById('searchLogic').value;
            const selectedGens = Array.from(document.querySelectorAll('.filter-gen:checked')).map(el => el.value);
            const selectedPerfs = Array.from(document.querySelectorAll('.filter-perf:checked')).map(el => el.value);
            const filterLogic = document.getElementById('filterLogic').value;

            const filtered = archiveData.filter(item => {
                const info = getInfo(item.filename);
                const fullText = (item.title + item.summary + item.performers.join('')).toLowerCase();
                
                let matchSearch = true;
                if (searchText.length > 0) {
                    matchSearch = (searchLogic === 'AND') 
                        ? searchText.every(t => fullText.includes(t)) 
                        : searchText.some(t => fullText.includes(t));
                }

                const matchGen = selectedGens.length === 0 || selectedGens.includes(info.gen);
                const matchPerf = selectedPerfs.length === 0 || (
                    filterLogic === 'AND' 
                        ? selectedPerfs.every(p => item.performers.includes(p)) 
                        : selectedPerfs.some(p => item.performers.includes(p))
                );

                return matchSearch && matchGen && matchPerf;
            });
            render(filtered);
        }

        document.querySelectorAll('input, select').forEach(el => el.addEventListener('change', filterData));
        document.getElementById('searchInput').addEventListener('input', filterData);
        document.querySelector('.close').onclick = () => {
            document.getElementById('detailModal').style.display = "none";
            document.body.style.overflow = "auto";
        };
        window.onclick = (e) => { 
            if(e.target.id === 'detailModal') {
                document.getElementById('detailModal').style.display = "none";
                document.body.style.overflow = "auto";
            }
        };

        render(archiveData);
    });
})();
