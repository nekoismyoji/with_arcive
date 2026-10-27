(function () {
    const performersList = ["セラス", "泉", "吟子", "小鈴", "姫芽", "花帆", "さやか", "瑠璃乃", "梢", "綴理", "慈"];
    let archiveData = [];
    let currentFilteredData = [];
    let displayCount = 0;
    const BATCH_SIZE = 30;

    /* ------------------------------------------------------------------
     * ファイル名 → 期 / 連番 / 日付 などの情報
     *   例) 024_105_0612.webp -> num=24, gen=105, rest="0612"
     *       130_105_megu.webp -> num=130, gen=105, rest="megu"
     * ------------------------------------------------------------------ */
    const fileInfoCache = new Map();

    function getFileInfo(filename) {
        if (fileInfoCache.has(filename)) return fileInfoCache.get(filename);

        const base = filename.replace(/\.[^.]+$/, '');          // 拡張子を除いた名前
        const m = base.match(/^(\d+)_(\d+)_(.+)$/);
        const numStr = m ? m[1] : "";
        const gen = m ? m[2] : "103";
        const rest = m ? m[3] : base;                          // 日付部分(+サフィックス)
        const rawDate = rest.split('_')[0];

        let date = rawDate;
        if (/^\d{4}$/.test(rawDate)) {
            date = rawDate.substring(0, 2) + "/" + rawDate.substring(2, 4);
        } else if (rawDate === "megu") {
            date = "特別配信";
        }

        const res = {
            gen, base, rest, date,
            num: m ? parseInt(numStr, 10) : null,
            numWidth: numStr.length || 3,
            folder: gen + "期サムネ"
        };
        fileInfoCache.set(filename, res);
        return res;
    }

    function escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, c => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
        ));
    }

    /* ------------------------------------------------------------------
     * 画像の解決ロジック
     *
     *  JSON上のファイル名と実ファイルがずれていても、
     *  「期 + 日付(MMDD)」が同じファイルを探して見つける。
     *
     *  探索順（上から順に、最初に見つかったものを採用）
     *    1. 期フォルダ内で、連番を 0, -1, +1, -2, +2 とずらした名前
     *       （日付部分は必ず一致させるので、別の配信の画像を拾うことはない）
     *    2. 予備フォルダ（WSサムネ）で同じことを行う
     *    まず全候補を WebP で確認し、無ければ全候補を JPG → JPEG で確認（WebP → JPG → JPEG の優先順位は維持）
     *    3. すべて無ければ「画像なし」
     *
     *  - 存在確認は <img> のonerrorではなく Image() で行う
     *  - 結果は resolvedCache に保存（URL文字列 or null）
     *  - 同じ画像への同時リクエストは pendingCache で1本にまとめる
     *  → DOMが何度作り直されても、再探索や要素ごとの状態に依存しない
     * ------------------------------------------------------------------ */
    const IMAGE_EXTS = ['webp', 'jpg', 'jpeg'];
    const EXTRA_FOLDERS = ['WSサムネ'];
    const NUMBER_OFFSETS = [0, -1, 1, -2, 2];

    const resolvedCache = new Map();   // filename -> string | null
    const pendingCache = new Map();    // filename -> Promise<string|null>
    const offsetHint = new Map();      // gen -> 直前に当たった連番ずれ（次の探索を最初にそこから試す）

    function probeImage(url) {
        return new Promise(resolve => {
            const probe = new Image();
            probe.onload = () => resolve(true);
            probe.onerror = () => resolve(false);
            probe.src = url;
        });
    }

    // 1か所(フォルダ+ファイル名)について、指定した拡張子を確認して最初に存在したURLを返す
    async function probeSpot(folder, base, exts) {
        const makeUrl = ext => `${encodeURI(folder)}/${encodeURIComponent(base)}.${ext}`;
        const urls = exts.map(makeUrl);
        const results = await Promise.all(urls.map(probeImage));
        const i = results.indexOf(true);
        return i >= 0 ? urls[i] : null;
    }

    function buildSpots(info) {
        const spots = [];
        const hint = offsetHint.get(info.gen);
        if (hint !== undefined) spots.push({ folder: info.folder, offset: hint });
        for (const folder of [info.folder, ...EXTRA_FOLDERS]) {
            for (const offset of NUMBER_OFFSETS) {
                if (folder === info.folder && offset === hint) continue;
                spots.push({ folder, offset });
            }
        }
        return spots;
    }

    async function findImage(info) {
        const spots = info.num === null
            ? [info.folder, ...EXTRA_FOLDERS].map(folder => ({ folder, offset: 0 }))
            : buildSpots(info);

        // 1周目: WebP だけを全候補で確認（普通はここで見つかる。404も最小限）
        // 2周目: WebP が無かった場合に JPG / JPEG を全候補で確認
        const rounds = [IMAGE_EXTS.slice(0, 1), IMAGE_EXTS.slice(1)];
        for (const exts of rounds) {
            for (const { folder, offset } of spots) {
                const n = info.num === null ? null : info.num + offset;
                if (n !== null && n < 1) continue;
                const base = n === null
                    ? info.base
                    : `${String(n).padStart(info.numWidth, '0')}_${info.gen}_${info.rest}`;
                const url = await probeSpot(folder, base, exts);
                if (url) {
                    if (n !== null && folder === info.folder) offsetHint.set(info.gen, offset);
                    return url;
                }
            }
        }
        return null;
    }

    function resolveImage(filename) {
        if (resolvedCache.has(filename)) return Promise.resolve(resolvedCache.get(filename));
        if (pendingCache.has(filename)) return pendingCache.get(filename);

        const task = findImage(getFileInfo(filename))
            .then(url => {
                // オフライン中の失敗は「画像なし」として覚えない（復帰後に再試行できる）
                if (url || navigator.onLine !== false) resolvedCache.set(filename, url);
                return url;
            })
            .finally(() => pendingCache.delete(filename));

        pendingCache.set(filename, task);
        return task;
    }

    /* 1枚の <img> に画像を適用する。要素が既にDOMから消えていたら何もしない */
    function applyImage(img) {
        const filename = img.dataset.filename;
        if (!filename || img.dataset.state) return;      // loading / done / error のどれかなら二重実行しない
        img.dataset.state = 'loading';

        resolveImage(filename).then(url => {
            if (!img.isConnected) return;                // フィルター切替で破棄された要素
            const wrapper = img.parentElement;
            if (url) {
                img.src = url;                           // 実在確認済み → キャッシュから即表示
                img.dataset.state = 'done';
                if (wrapper) {
                    wrapper.classList.remove('is-loading', 'has-error');
                    wrapper.classList.add('is-loaded');
                }
            } else {
                img.removeAttribute('src');
                img.dataset.state = 'error';
                if (wrapper) {
                    wrapper.classList.remove('is-loading');
                    wrapper.classList.add('has-error');
                }
            }
        });
    }

    /* 画面付近に来たカードだけ解決する（lazy loading の代わり） */
    const imageObserver = ('IntersectionObserver' in window)
        ? new IntersectionObserver(entries => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                imageObserver.unobserve(entry.target);
                applyImage(entry.target);
            }
        }, { rootMargin: '400px 0px' })
        : null;

    function watchImage(img) {
        if (imageObserver) imageObserver.observe(img);
        else applyImage(img);
    }

    /* ------------------------------------------------------------------
     * 描画
     * ------------------------------------------------------------------ */
    let sentinel = null;
    let sentinelObserver = null;

    function render(data, isAppend = false) {
        const grid = document.getElementById('archiveGrid');
        if (!grid) return;

        if (!isAppend) {
            // 前回の描画で監視中の画像をまとめて解除してから作り直す
            if (imageObserver) imageObserver.disconnect();
            grid.innerHTML = '';
            displayCount = 0;
            currentFilteredData = data;

            if (data.length === 0) {
                grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #888;">該当する配信アーカイブが見つかりませんでした。</div>';
                return;
            }
        }

        const nextBatch = currentFilteredData.slice(displayCount, displayCount + BATCH_SIZE);
        if (nextBatch.length === 0) return;

        const html = nextBatch.map(item => {
            const info = getFileInfo(item.filename);
            const titleText = item.title ? escapeHtml(item.title) : '（タイトル未設定）';
            const fname = escapeHtml(item.filename);
            return `
                <div class="card" data-filename="${fname}">
                    <div class="card-img-wrapper is-loading">
                        <img data-filename="${fname}" alt="" width="320" height="180" decoding="async">
                    </div>
                    <div class="card-info">
                        <div class="card-title">${titleText}</div>
                        <div class="card-date">${info.date}</div>
                    </div>
                </div>
            `;
        }).join('');

        const before = grid.children.length;
        grid.insertAdjacentHTML('beforeend', html);
        displayCount += nextBatch.length;

        // 今回追加した <img> だけを監視に登録
        Array.from(grid.children).slice(before).forEach(card => {
            const img = card.querySelector('img');
            if (img) watchImage(img);
        });

        // 追加後もセンチネルが画面内に残っている場合に備えて再判定させる
        if (sentinelObserver && sentinel) {
            sentinelObserver.unobserve(sentinel);
            sentinelObserver.observe(sentinel);
        }
    }

    function setupInfiniteScroll() {
        const grid = document.getElementById('archiveGrid');
        if (!grid) return;

        sentinel = document.createElement('div');
        sentinel.style.height = '1px';
        grid.insertAdjacentElement('afterend', sentinel);

        if ('IntersectionObserver' in window) {
            sentinelObserver = new IntersectionObserver(entries => {
                if (entries.some(e => e.isIntersecting)) render(currentFilteredData, true);
            }, { rootMargin: '600px 0px' });
            sentinelObserver.observe(sentinel);
        } else {
            window.addEventListener('scroll', () => {
                const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
                if (scrollTop + clientHeight >= scrollHeight - 300) render(currentFilteredData, true);
            });
        }
    }

    /* ------------------------------------------------------------------
     * モーダル
     * ------------------------------------------------------------------ */
    let modalToken = 0;

    function openModal(filename) {
        const item = archiveData.find(d => d.filename === filename);
        if (!item) return;
        const info = getFileInfo(filename);

        const modalImg = document.getElementById('modalImage');
        const token = ++modalToken;                      // 連続で開いたとき古い結果を捨てる
        modalImg.removeAttribute('src');
        modalImg.style.display = 'block';
        resolveImage(filename).then(url => {
            if (token !== modalToken) return;
            if (url) modalImg.src = url;
            else modalImg.style.display = 'none';
        });

        document.getElementById('modalTitle').innerText = item.title || "（タイトル未設定）";
        document.getElementById('modalDate').innerText = `配信日: ${info.date} (${info.gen}期)`;

        document.getElementById('modalPerformers').innerText =
            (item.performers && item.performers.length > 0)
                ? "出演: " + item.performers.join(', ')
                : "出演: （出演者情報はありません）";

        document.getElementById('modalSummary').innerText =
            (item.summary && item.summary.trim() !== "")
                ? item.summary
                : "（この配信の概要文・トピック情報はありません）";

        document.getElementById('detailModal').style.display = "block";
    }

    /* ------------------------------------------------------------------
     * フィルター
     * ------------------------------------------------------------------ */
    let debounceTimer = null;
    function debounceFilter() {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(filterData, 100);
    }

    function filterData() {
        const searchText = document.getElementById('searchInput').value.toLowerCase().split(/\s+/).filter(t => t);
        const searchLogic = document.getElementById('searchLogic').value;
        const selectedGens = Array.from(document.querySelectorAll('.filter-gen:checked')).map(el => el.value);
        const selectedPerfs = Array.from(document.querySelectorAll('.filter-perf:checked')).map(el => el.value);
        const filterLogic = document.getElementById('filterLogic').value;

        const filtered = archiveData.filter(item => {
            const info = getFileInfo(item.filename);

            if (selectedGens.length > 0 && !selectedGens.includes(info.gen)) return false;

            if (selectedPerfs.length > 0) {
                if (!item.performers) return false;
                const match = p => item.performers.some(full => full.includes(p));
                const ok = filterLogic === 'AND' ? selectedPerfs.every(match) : selectedPerfs.some(match);
                if (!ok) return false;
            }

            if (searchText.length > 0) {
                return searchLogic === 'AND'
                    ? searchText.every(t => item.searchKey.includes(t))
                    : searchText.some(t => item.searchKey.includes(t));
            }
            return true;
        });

        render(filtered);
    }

    /* ------------------------------------------------------------------
     * 初期化
     * ------------------------------------------------------------------ */
    window.addEventListener('DOMContentLoaded', async () => {
        const perfContainer = document.getElementById('performerFilters');
        if (perfContainer) {
            perfContainer.innerHTML = performersList.map(p =>
                `<label style="margin-right:10px; cursor:pointer;"><input type="checkbox" class="filter-perf" value="${p}"> ${p}</label>`
            ).join('');
        }

        const jsonFiles = ['data_103.json', 'data_104.json', 'data_105.json'];
        const dataSets = await Promise.all(jsonFiles.map(async file => {
            try {
                const res = await fetch(file);
                if (!res.ok) throw new Error("File not found");
                return await res.json();
            } catch (err) {
                console.warn(`${file} の読み込みに失敗しました:`, err);
                return [];
            }
        }));
        archiveData = dataSets.flat();

        archiveData.forEach(item => {
            item.searchKey = ((item.title || "") + " " + (item.summary || "") + " " +
                (item.performers ? item.performers.join(' ') : "")).toLowerCase();
        });

        setupInfiniteScroll();
        render(archiveData);

        document.querySelectorAll('.filter-gen, .filter-perf, select').forEach(el => {
            el.addEventListener('change', filterData);
        });
        document.getElementById('searchInput').addEventListener('input', debounceFilter);

        // カードのクリックは親(グリッド)で一括処理
        document.getElementById('archiveGrid').addEventListener('click', e => {
            const card = e.target.closest('.card');
            if (card && card.dataset.filename) openModal(card.dataset.filename);
        });

        const modal = document.getElementById('detailModal');
        const closeModal = () => { modal.style.display = "none"; };
        document.querySelector('.close').onclick = closeModal;
        window.onclick = e => { if (e.target.id === 'detailModal') closeModal(); };
        document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
    });
})();
