(function() {
    const performersList = ["セラス", "泉", "吟子", "小鈴", "姫芽", "花帆", "さやか", "瑠璃乃", "梢", "綴理", "慈"];
    let archiveData = []; 

    function getFileInfo(filename) {
        const parts = filename.split('_');
        
        // [通し番号]_[期]_[日付].jpg の「期」にあたる2番目を取得
        let gen = parts[1] || "103"; 

        const folder = gen + "期サムネ";
        const lastPart = parts[parts.length - 1];
        let date = lastPart.split('.')[0].replace('jpg', '').replace('jpeg', '');
        
        if (date.length === 4) {
            date = date.substring(0, 2) + "/" + date.substring(2, 4);
        }
        
        return { gen, folder, date };
    }
    
    function render(data) {
        const grid = document.getElementById('archiveGrid');
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
        modalImg.onerror = function() { this.src = 'https://via.placeholder.com/400x225?text=Image+Not+Found'; };

        document.getElementById('modalTitle').innerText = item.title;
        document.getElementById('modalDate').innerText = `配信日: ${info.date} (${info.gen}期)`;
        document.getElementById('modalPerformers').innerText = "出演: " + (item.performers.length > 0 ? item.performers.join(', ') : "（未設定）");
        document.getElementById('modalSummary').innerText = item.summary || "概要はありません。";
        
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
                matchSearch = (searchLogic === 'AND') 
                    ? searchText.every(t => fullText.includes(t)) 
                    : searchText.some(t => fullText.includes(t));
            }

            const matchGen = selectedGens.length === 0 || selectedGens.includes(info.gen);

            const matchPerf = selectedPerfs.length === 0 || (
                filterLogic === 'AND' 
                    ? selectedPerfs.every(p => item.performers.some(full => full.includes(p))) 
                    : selectedPerfs.some(p => item.performers.some(full => full.includes(p)))
            );

            return matchSearch && matchGen && matchPerf;
        });
        render(filtered);
    }

    window.addEventListener('DOMContentLoaded', async () => {
        const perfContainer = document.getElementById('performerFilters');
        perfContainer.innerHTML = performersList.map(p => 
            `<label style="margin-right:10px; cursor:pointer;"><input type="checkbox" class="filter-perf" value="${p}"> ${p}</label>`
        ).join('');

        try {
            // 読み込むファイルリスト
            const jsonFiles = ['data_103.json', 'data_104.json', 'data_105.json'];
            
            // 全ファイルを並列で取得
            const responses = await Promise.all(jsonFiles.map(file => fetch(file)));
            
            // 全てをJSONとして展開
            const dataSets = await Promise.all(responses.map(res => {
                if (!res.ok) throw new Error(`${res.url} が読み込めません`);
                return res.json();
            }));

            // 全ての配列を1つに統合
            archiveData = dataSets.flat();
            render(archiveData);
        } catch (e) {
            console.error("データの読み込みに失敗しました:", e);
        }

        document.querySelectorAll('input, select').forEach(el => el.addEventListener('change', filterData));
        document.getElementById('searchInput').addEventListener('input', filterData);
        document.querySelector('.close').onclick = () => document.getElementById('detailModal').style.display = "none";
        window.onclick = (e) => { if(e.target.id === 'detailModal') document.getElementById('detailModal').style.display = "none"; };
    });
})();
