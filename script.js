const performersList = ["セラス", "泉", "吟子", "小鈴", "姫芽", "花帆", "さやか", "瑠璃乃", "梢", "綴理", "慈"];

// サンプルデータ (ここに1500件追加していく)
const archiveData = [
    { filename: "001_104_0403.jpg", title: "104期スタート配信", performers: ["花帆", "さやか", "瑠璃乃", "慈"], summary: "新学期が始まりました！" },
    { filename: "023_105_0604.jpg", title: "6月の雨ライブ", performers: ["梢", "綴理", "慈"], summary: "雨の日でも元気にライブします。" },
    { filename: "005_105_0412.jpg", title: "新入生歓迎会", performers: ["花帆", "姫芽"], summary: "105期の新しい風を感じます。" }
];

// 初期設定
const perfContainer = document.getElementById('performerFilters');
performersList.forEach(p => {
    perfContainer.innerHTML += `<label><input type="checkbox" class="filter-perf" value="${p}"> ${p}</label> `;
});

function render(data) {
    const grid = document.getElementById('archiveGrid');
    grid.innerHTML = data.map(item => {
        const parts = item.filename.split('_');
        const folder = `${parts[1]}期サムネ`; // "104期サムネ" など
        return `
            <div class="archive-card" onclick="showDetail('${item.filename}')">
                <img src="${folder}/${item.filename}" loading="lazy" onerror="this.src='https://via.placeholder.com/160x90?text=No+Image'">
                <div class="card-info">
                    <div>${item.title}</div>
                    <small style="color:#666">${parts[2].replace('.jpg','')}</small>
                </div>
            </div>
        `;
    }).join('');
}

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

function showDetail(filename) {
    const item = archiveData.find(d => d.filename === filename);
    const parts = filename.split('_');
    document.getElementById('modalImage').src = `${parts[1]}期サムネ/${filename}`;
    document.getElementById('modalTitle').innerText = item.title;
    document.getElementById('modalDate').innerText = `日付: ${parts[2].replace('.jpg','')}`;
    document.getElementById('modalPerformers').innerText = "出演: " + item.performers.join(', ');
    document.getElementById('modalSummary').innerText = item.summary;
    document.getElementById('detailModal').style.display = "block";
}

document.querySelectorAll('input, select').forEach(el => el.addEventListener('change', filterData));
document.getElementById('searchInput').addEventListener('input', filterData);
document.querySelector('.close').onclick = () => document.getElementById('detailModal').style.display = "none";
window.onclick = (e) => { if(e.target.className === 'modal') document.getElementById('detailModal').style.display = "none"; };

render(archiveData);
