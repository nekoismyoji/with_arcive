(function () {
    const performersList = ["セラス", "泉", "吟子", "小鈴", "姫芽", "花帆", "さやか", "瑠璃乃", "梢", "綴理", "慈"];
    let archiveData = [];
    let currentFilteredData = [];
    let displayCount = 0;
    const BATCH_SIZE = 30;

    /* ------------------------------------------------------------------
     * ファイル名 → 期 / 年月日 / 時系列ソートキー 情報抽出
     *   例) 029_103_0417.webp -> 2023/04/17 (103期春)
     *       001_103_0111.webp -> 2024/01/11 (103期冬: 4/1〜3/31の年度跨ぎ補正)
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

        let dateStr = rawDate;
        let year = null;
        let month = null;
        let day = null;
        let sortKey = 0;

        const genNum = parseInt(gen, 10) || 103;
        // 103期=2023年度, 104期=2024年度, 105期=2025年度
        const baseYear = 2023 + (genNum - 103);

        if (/^\d{4}$/.test(rawDate)) {
            month = parseInt(rawDate.substring(0, 2), 10);
            day = parseInt(rawDate.substring(2, 4), 10);

            // 4月〜12月は当年(baseYear)、1月〜3月は翌年(baseYear + 1)
            year = (month >= 1 && month <= 3) ? baseYear + 1 : baseYear;

            const mStr = String(month).padStart(2, '0');
            const dStr = String(day).padStart(2, '0');
            dateStr = `${year}/${mStr}/${dStr}`;

            const numVal = m ? parseInt(numStr, 10) : 0;
            // 時系列ソート用キー: YYYYMMDD * 1000 + 連番
            sortKey = year * 1000000 + month * 10000 + day * 100 + (numVal % 100);
        } else if (rawDate === "megu") {
            dateStr = "特別配信";
            year = baseYear + 1;
            sortKey = (baseYear + 1) * 1000000 + 123199;
        } else {
            sortKey = baseYear * 1000000;
        }

        const res = {
            gen, base, rest, date: dateStr, rawDate, year, month, day, sortKey,
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
     *   - 期フォルダ（103期サムネ、104期サムネ、105期サムネ）を厳格に限定して探す
     * ------------------------------------------------------------------ */
    const IMAGE_EXTS = ['webp', 'jpg', 'jpeg'];
    const EXTRA_FOLDERS = ['WSサムネ'];
    const NUMBER_OFFSETS = [0, -1, 1, -2, 2];

    const resolvedCache = new Map();   // filename -> string | null
    const pendingCache = new Map();    // filename -> Promise<string|null>
    const offsetHint = new Map();      // gen -> 直前に当たった連番ずれ

    function probeImage(url) {
        return new Promise(resolve => {
            const probe = new Image();
            probe.onload = () => resolve(true);
            probe.onerror = () => resolve(false);
            probe.src = url;
        });
    }

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

        // 当該「期フォルダ」内のみで連番ズレ(0, -1, 1, -2, 2)を試す（他期フォルダへの混同防止）
        if (hint !== undefined) spots.push({ folder: info.folder, offset: hint });
        for (const offset of NUMBER_OFFSETS) {
            if (offset === hint) continue;
            spots.push({ folder: info.folder, offset });
        }

        // 予備フォルダ（WSサムネ等）がある場合のみ最後に追加
        for (const folder of EXTRA_FOLDERS) {
            spots.push({ folder, offset: 0 });
        }
        return spots;
    }

    async function findImage(info) {
        const spots = info.num === null
            ? [{ folder: info.folder, offset: 0 }, ...EXTRA_FOLDERS.map(folder => ({ folder, offset: 0 }))]
            : buildSpots(info);

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
                if (url || navigator.onLine !== false) resolvedCache.set(filename, url);
                return url;
            })
            .finally(() => pendingCache.delete(filename));

        pendingCache.set(filename, task);
        return task;
    }

    function applyImage(img) {
        const filename = img.dataset.filename;
        if (!filename || img.dataset.state) return;
        img.dataset.state = 'loading';

        resolveImage(filename).then(url => {
            if (!img.isConnected) return;
            const wrapper = img.parentElement;
            if (url) {
                img.src = url;
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
                        <div class="card-date">${info.date} (${info.gen}期)</div>
                    </div>
                </div>
            `;
        }).join('');

        const before = grid.children.length;
        grid.insertAdjacentHTML('beforeend', html);
        displayCount += nextBatch.length;

        Array.from(grid.children).slice(before).forEach(card => {
            const img = card.querySelector('img');
            if (img) watchImage(img);
        });

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
        const token = ++modalToken;
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

        // ★ 4/1〜翌3/31（年度跨ぎ考慮）の正順（時系列）でソート
        archiveData.sort((a, b) => {
            const infoA = getFileInfo(a.filename);
            const infoB = getFileInfo(b.filename);
            return infoA.sortKey - infoB.sortKey;
        });

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