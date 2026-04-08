// サンプルデータ (本来は外部JSON等から読み込むのが理想)
const archiveData = [
    { filename: "001_103_20230417.jpg", title: "新入生紹介配信", performers: ["花帆", "さやか", "瑠璃乃"], summary: "103期の新入生を紹介します。" },
    { filename: "002_103_20230420.jpg", title: "梢センパイを紹介します！", performers: ["梢", "花帆"], summary: "梢センパイの魅力を語ります。" },
    // 追加のデータをここに入れる
];

const performersList = ["セラス", "泉", "吟子", "小鈴", "姫芽", "花帆", "さやか", "瑠璃乃", "梢", "綴理"];
const grid = document.getElementById('archiveGrid');

// 出演者フィルターの生成
const perfContainer = document.getElementById('performerFilters');
performersList.forEach(p => {
    perfContainer.innerHTML += `<label><input type="checkbox" class="filter-perf" value="${p}"> ${p}</label> `;
});

function render(data) {
    grid.innerHTML = data.map(item => `
        <div class="archive-card" onclick="showDetail('${item.filename}')">
            <img src="images/${item.filename}" alt="${item.title}">
            <div class="info">
                <div>${item.title}</div>
                <small>${item.filename.split('_')[2].replace('.jpg','')}</small>
            </div>
        </div>
    `).join('');
}

function filterData() {
    const searchText = document.getElementById('searchInput').value.toLowerCase().split(/\s+/).filter(t => t);
    const searchLogic = document.getElementById('searchLogic').value;
    const selectedGens = Array.from(document.querySelectorAll('.filter-gen:checked')).map(el => el.value);
    const selectedPerfs = Array.from(document.querySelectorAll('.filter-perf:checked')).map(el => el.value);
    const filterLogic = document.getElementById('filterLogic').value;

    const filtered = archiveData.filter(item => {
        // 1. ワード検索
        const fullText = (item.title + item.summary + item.performers.join('')).toLowerCase();
        let matchSearch = true;
        if (searchText.length > 0) {
            matchSearch = searchLogic === 'AND' 
                ? searchText.every(t => fullText.includes(t))
                : searchText.some(t => fullText.includes(t));
        }

        // 2. フィルター (期・出演者)
        const itemGen = item.filename.split('_')[1];
        const matchGen = selectedGens.length === 0 || selectedGens.includes(itemGen);
        
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

// モーダル処理
function showDetail(filename) {
    const item = archiveData.find(d => d.filename === filename);
    document.getElementById('modalImage').src = `images/${filename}`;
    document.getElementById('modalTitle').innerText = item.title;
    document.getElementById('modalPerformers').innerText = "出演: " + item.performers.join(', ');
    document.getElementById('modalSummary').innerText = item.summary;
    document.getElementById('detailModal').style.display = "block";
}

document.querySelector('.close').onclick = () => document.getElementById('detailModal').style.display = "none";

// 初回描画
render(archiveData);
