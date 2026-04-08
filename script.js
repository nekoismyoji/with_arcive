(function() {
    const performersList = ["セラス", "泉", "吟子", "小鈴", "姫芽", "花帆", "さやか", "瑠璃乃", "梢", "綴理", "慈"];

    // 【1500件のデータをここに入れてください】
    const archiveData = [
        { filename: "001_103_0417.jpg", title: "配信 001", performers: [], summary: "" },
        { filename: "007_0506.jpg", title: "配信 007", performers: [], summary: "" },
        // ...残りのデータをここに貼り付け...
        { filename: "129_105_megu.jpg", title: "配信 129", performers: [], summary: "" }
    ];

    window.addEventListener('DOMContentLoaded', () => {
        const grid = document.getElementById('archiveGrid');
        const perfContainer = document.getElementById('performerFilters');
        if (!grid || !perfContainer) return;

        // 出演者フィルター作成
        perfContainer.innerHTML = performersList.map(p => 
            `<label style="margin-right:10px; cursor:pointer;"><input type="checkbox" class="filter-perf" value="${p}"> ${p}</label>`
        ).join('');

        // ファイル名からフォルダと日付を判定する関数
        function getFileInfo(filename) {
            let gen = "103"; // デフォルト
            if (filename.includes("_105_") || filename.includes("_105.")) gen = "105";
            else if (filename.includes("_104_") || filename.includes("_104.")) gen = "104";
            
            const parts = filename.split('_');
            const lastPart = parts[parts.length - 1].split('.')[0];
            const date = lastPart.replace("jpg", "").replace("jpeg", "");
            
            return { gen, date, folder: `${gen}期サムネ` };
        }

        function render(data) {
            grid.innerHTML = data.map(item => {
                const info = getFileInfo(item.filename);
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
            
            const info = getFileInfo(filename);
            const modalImg = document.getElementById('modalImage');
            
            modalImg.src = `${info.folder}/${filename}`;
            modalImg.onerror = function() { this.style.display = 'none'; }; // 画像がない時は隠す
            modalImg.style.display = 'block';

            document.getElementById('modalTitle').innerText = item.title;
            document.getElementById('modalDate').innerText = `配信日: ${info.date} (${info.gen}期)`;
            document.getElementById('modalPerformers').innerText = "出演: " + (item.performers.length > 0 ? item.performers.join(', ') : "未設定");
            document.getElementById('modalSummary').innerText = item.summary || "概要テキストはまだありません。";
            
            document.getElementById('detailModal').style.display = "block";
        };

        function filterData() {
            const searchText = document.getElementById('searchInput').value.toLowerCase().split(/\s+/).filter(t => t);
            const searchLogic = document.getElementById('searchLogic').value;
            const selectedGens = Array.from(document.querySelectorAll('.filter-gen:checked')).map(el => el.value);
            const selectedPerfs = Array.from(document.querySelectorAll('.filter-perf:checked')).map(el => el.value);
            const filterLogic = document.getElementById('filterLogic').value;

            const filtered = archiveData.filter(item => {
                const info = getFileInfo(item.filename);
                const fullText = (item.title + item.summary + item.performers.join('')).toLowerCase();
                
                let matchSearch = true;
                if (searchText.length > 0) {
                    matchSearch = (searchLogic === 'AND') ? searchText.every(t => fullText.includes(t)) : searchText.some(t => fullText.includes(t));
                }
                const matchGen = selectedGens.length === 0 || selectedGens.includes(info.gen);
                const matchPerf = selectedPerfs.length === 0 || (
                    filterLogic === 'AND' ? selectedPerfs.every(p => item.performers.includes(p)) : selectedPerfs.some(p => item.performers.includes(p))
                );
                return matchSearch && matchGen && matchPerf;
            });
            render(filtered);
        }

        document.querySelectorAll('input, select').forEach(el => el.addEventListener('change', filterData));
        document.getElementById('searchInput').addEventListener('input', filterData);
        document.querySelector('.close').onclick = () => document.getElementById('detailModal').style.display = "none";
        window.onclick = (e) => { if(e.target.id === 'detailModal') document.getElementById('detailModal').style.display = "none"; };

        render(archiveData);
    });
})();
