document.addEventListener('DOMContentLoaded', () => {
    const performersList = ["セラス", "泉", "吟子", "小鈴", "姫芽", "花帆", "さやか", "瑠璃乃", "梢", "綴理", "慈"];

    // 【重要】ここのfilenameが実際の画像ファイル名と1字1句合っているか確認してください
    const archiveData = [
        { filename: "001_104_0403.jpg", title: "104期初配信", performers: ["花帆", "さやか", "瑠璃乃", "慈"], summary: "104期の活動がここから始まります！" },
        { filename: "004_105_0410.jpg", title: "105期定例配信", performers: ["花帆", "姫芽", "慈"], summary: "新入生を迎えての賑やかな配信。" },
        { filename: "023_105_0604.jpg", title: "雨の日の雑談ライブ", performers: ["梢", "綴理", "慈"], summary: "まったりとした放課後トーク。" }
    ];

    const grid = document.getElementById('archiveGrid');
    const perfContainer = document.getElementById('performerFilters');

    // 出演者フィルター生成
    performersList.forEach(p => {
        const label = document.createElement('label');
        label.style.marginRight = "10px";
        label.innerHTML = `<input type="checkbox" class="filter-perf" value="${p}"> ${p}`;
        perfContainer.appendChild(label);
    });

    function render(data) {
        if (!grid) return;
        grid.innerHTML = data.map(item => {
            const parts = item.filename.split('_');
            if (parts.length < 3) return ''; // ファイル名形式エラー対策
            
            const gen = parts[1]; // "105" など
            const date = parts[2].split('.')[0]; // "0410" など
            const folder = `${gen}期サムネ`; 
            
            return `
                <div class="card" onclick="window.showDetail('${item.filename}')">
                    <img src="${folder}/${item.filename}" loading="lazy" onerror="this.src='https://via.placeholder.com/160x90?text=No+Image'">
                    <div class="card-info">
                        <div>${item.title}</div>
                        <small style="color:#666">${date}</small>
                    </div>
                </div>
            `;
        }).join('');
    }

    window.showDetail = function(filename) {
        const item = archiveData.find(d => d.filename === filename);
        if (!item) return;
        const parts = filename.split('_');
        const folder = `${parts[1]}期サムネ`;
        
        document.getElementById('modalImage').src = `${folder}/${filename}`;
        document.getElementById('modalTitle').innerText = item.title;
        document.getElementById('modalDate').innerText = `日付: ${parts[2].split('.')[0]}`;
        document.getElementById('modalPerformers').innerText = "出演: " + item.performers.join(', ');
        document.getElementById('modalSummary').innerText = item.summary;
        document.getElementById('detailModal').style.display = "block";
    };

    function filterData() {
        const searchText = document.getElementById('searchInput').value.toLowerCase().split(/\s+/).filter(t => t);
        const searchLogic = document.getElementById('searchLogic').value;
        const selectedGens = Array.from(document.querySelectorAll('.filter-gen:checked')).map(el => el.value);
        const selectedPerfs = Array.from(document.querySelectorAll('.filter-perf:checked')).map(el => el.value);
        const filterLogic = document.getElementById('filterLogic').value;

        const filtered = archiveData.filter(item => {
            const fullText = (item.title + item.summary + item.performers.join('')).toLowerCase();
            let matchSearch = true;
            if (searchText.length > 0) {
                matchSearch = searchLogic === 'AND' ? searchText.every(t => fullText.includes(t)) : searchText.some(t => fullText.includes(t));
            }
            const matchGen = selectedGens.length === 0 || selectedGens.includes(item.filename.split('_')[1]);
            const matchPerf = selectedPerfs.length === 0 || (
                filterLogic === 'AND' ? selectedPerfs.every(p => item.performers.includes(p)) : selectedPerfs.some(p => item.performers.includes(p))
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

    // 初回描画
    render(archiveData);
});
