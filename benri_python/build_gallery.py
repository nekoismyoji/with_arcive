import os
import re
import json
import hashlib
from PIL import Image, ImageChops, ImageStat

def get_target_base_dir():
    """実行場所が 'benri_python' 内であっても画像フォルダがある親階層を自動判定"""
    if any(os.path.isdir(d) and d.endswith("期サムネ") for d in os.listdir(".")):
        return "."
    if os.path.exists("..") and any(os.path.isdir(os.path.join("..", d)) and d.endswith("期サムネ") for d in os.listdir("..")):
        return ".."
    return "."

def parse_wiki_data(wiki_path):
    if not os.path.exists(wiki_path):
        return {}

    with open(wiki_path, "r", encoding="utf-8") as f:
        wiki_text = f.read()

    entries = {}  # date_key -> list of entry dicts (同日複数配信対応)
    pattern = r"(\d{4})/(\d{2})/(\d{2})\s*[\u3000\s]*[「『](.+?)[」』]"
    matches = list(re.finditer(pattern, wiki_text))

    for i, match in enumerate(matches):
        year, month, day, title = match.group(1), match.group(2), match.group(3), match.group(4).strip()
        date_key = f"{month}{day}"

        start_idx = match.end()
        end_idx = matches[i+1].start() if i + 1 < len(matches) else len(wiki_text)
        block = wiki_text[start_idx:end_idx]

        performers = []
        summary_lines = []
        is_summary = False

        for line in block.splitlines():
            line = line.strip()
            if not line or "参加メンバー" in line:
                continue
            if "配信概要" in line:
                is_summary = True
                continue
            if line in ["サムネイル", "配信日時", "アーカイブ", "YouTube"] or line.startswith("with_") or line.startswith("http"):
                is_summary = False
                continue

            if not is_summary and any(k in line for k in ["花帆", "さやか", "瑠璃乃", "吟子", "小鈴", "姫芽", "セラス", "泉", "慈"]):
                raw_p = re.sub(r"\(ゲスト:?\s*", "・", line)
                raw_p = re.sub(r"\)", "", raw_p)
                for p in raw_p.split("・"):
                    p_clean = p.strip()
                    if p_clean and p_clean not in performers:
                        performers.append(p_clean)

            if is_summary:
                summary_lines.append(line)

        entry = {
            "year": year,
            "title": title,
            "performers": performers,
            "summary": "\n".join(summary_lines).strip()
        }
        entries.setdefault(date_key, []).append(entry)

    return entries


def is_substantially_same_image(path1, path2):
    """2つの画像がバイナリ一致、またはピクセルレベルでほぼ同一か判定"""
    try:
        with open(path1, "rb") as f1, open(path2, "rb") as f2:
            if hashlib.md5(f1.read()).hexdigest() == hashlib.md5(f2.read()).hexdigest():
                return True

        with Image.open(path1) as img1, Image.open(path2) as img2:
            if img1.size != img2.size or img1.mode != img2.mode:
                return False

            diff = ImageChops.difference(img1.convert("RGB"), img2.convert("RGB"))
            if not diff.getbbox():
                return True

            stat = ImageStat.Stat(diff)
            mean_diff = sum(stat.mean) / len(stat.mean)
            if mean_diff < 3.0:  # 微細なノイズ差分を許容
                return True
    except Exception:
        pass

    return False


def build_and_check_gallery():
    base_dir = get_target_base_dir()
    
    fix_logs = []      # 1. 実施した修正項目
    issue_logs = []    # 2. 要確認・不整合レポート

    wiki_path = os.path.join(base_dir, "benri_python", "wiki_paste.txt")
    if not os.path.exists(wiki_path):
        wiki_path = os.path.join(base_dir, "wiki_paste.txt")
    if not os.path.exists(wiki_path) and os.path.exists("wiki_paste.txt"):
        wiki_path = "wiki_paste.txt"

    wiki_data = parse_wiki_data(wiki_path)

    folders = [f for f in os.listdir(base_dir) if os.path.isdir(os.path.join(base_dir, f)) and f.endswith("期サムネ")]
    folders.sort()

    for folder_name in folders:
        gen_m = re.search(r"\d+", folder_name)
        if not gen_m:
            continue
        gen = gen_m.group(0)

        folder_path = os.path.join(base_dir, folder_name)
        json_file = os.path.join(base_dir, f"data_{gen}.json")

        # --- STEP 0: 一時ファイル (__temp_) の緊急復元 ---
        for fname in os.listdir(folder_path):
            if fname.startswith("__temp_"):
                dm = re.search(r"(\d{4}|megu)", fname)
                date_k = dm.group(1) if dm else "unknown"
                ext = os.path.splitext(fname)[1]
                rec_name = f"recovered_{date_k}{ext}"
                os.rename(os.path.join(folder_path, fname), os.path.join(folder_path, rec_name))
                fix_logs.append(f"[{folder_name}] 前回エラーで残った一時ファイルを自動復元: {fname} -> {rec_name}")

        # --- STEP 1: WebP変換 & 拡張子誤記補正 ---
        for fname in list(os.listdir(folder_path)):
            if fname.startswith("."):
                continue

            old_path = os.path.join(folder_path, fname)
            if not os.path.isfile(old_path):
                continue

            base_name, ext = os.path.splitext(fname)
            ext_lower = ext.lower()

            if ext_lower == ".ipg":
                new_fname = base_name + ".jpg"
                new_path = os.path.join(folder_path, new_fname)
                os.rename(old_path, new_path)
                fix_logs.append(f"[{folder_name}] 拡張子誤表記を修復: {fname} -> {new_fname}")
                old_path = new_path
                fname = new_fname
                ext_lower = ".jpg"

            if ext_lower in [".jpg", ".jpeg", ".png"]:
                webp_name = base_name + ".webp"
                webp_path = os.path.join(folder_path, webp_name)
                if not os.path.exists(webp_path):
                    try:
                        with Image.open(old_path) as img:
                            img.save(webp_path, "WEBP", quality=80)
                        fix_logs.append(f"[{folder_name}] WebPへ軽量変換: {fname} -> {webp_name}")
                    except Exception as e:
                        issue_logs.append(f"[{folder_name}] 画像変換エラー ({fname}): {e}")

                if os.path.exists(webp_path) and os.path.exists(old_path):
                    os.remove(old_path)

        # --- STEP 2: JSON読み込み (同日複数配信対応) ---
        existing_json_map = {}  # date_key -> list of json items
        if os.path.exists(json_file):
            with open(json_file, "r", encoding="utf-8") as f:
                try:
                    existing_items = json.load(f)
                    for item in existing_items:
                        fname = item.get("filename", "")
                        dm = re.search(r"(\d{4}|megu)", fname)
                        if dm:
                            existing_json_map.setdefault(dm.group(1), []).append(item)
                except Exception as e:
                    issue_logs.append(f"[{folder_name}] JSONファイル読み込みエラー: {e}")

        # --- STEP 3: WebP画像リスト作成 ---
        valid_images = []
        for fname in os.listdir(folder_path):
            if fname.startswith("."):
                continue

            image_path = os.path.join(folder_path, fname)
            if not os.path.isfile(image_path):
                continue

            ext_lower = os.path.splitext(fname)[1].lower()
            if ext_lower != ".webp":
                continue

            date_m = re.search(r"(?:10\d_)?(\d{4}|megu)", fname)
            date_key = date_m.group(1) if date_m else "9999"

            valid_images.append({
                "current_name": fname,
                "current_path": image_path,
                "date_key": date_key,
                "ext": ext_lower
            })

        # --- STEP 3.5: 同一日付の画像同士を比較し、ほぼ同一なら片方を自動削除 ---
        by_date = {}
        for img in valid_images:
            by_date.setdefault(img["date_key"], []).append(img)

        filtered_images = []
        for d_k, img_list in by_date.items():
            if len(img_list) > 1 and d_k != "megu":
                keepers = []
                for img in img_list:
                    duplicate_found = False
                    for keeper in keepers:
                        if is_substantially_same_image(img["current_path"], keeper["current_path"]):
                            os.remove(img["current_path"])
                            fix_logs.append(f"[{folder_name}] 同一日付({d_k})の重複画像を自動削除しました: {img['current_name']} (保持: {keeper['current_name']})")
                            duplicate_found = True
                            break
                    if not duplicate_found:
                        keepers.append(img)
                filtered_images.extend(keepers)

                # Wikiのエントリー数より画像が多い場合のみ確認警告
                wiki_count = len(wiki_data.get(d_k, []))
                if len(keepers) > max(1, wiki_count):
                    issue_logs.append(f"[{folder_name} 重複警告] 日付『{d_k}』に画像が {len(keepers)} 枚存在します（Wiki記載: {wiki_count}件。手動確認推奨）")
            else:
                filtered_images.extend(img_list)

        valid_images = filtered_images

        # ソート（日付順。同日の場合は元ファイルの連番順/名前順を保持）
        def sort_key(img):
            d = img["date_key"]
            seq_m = re.match(r"^(\d{3})_", img["current_name"])
            seq_num = int(seq_m.group(1)) if seq_m else 999
            if d == "megu":
                return (99999, seq_num, img["current_name"])
            try:
                return (int(d), seq_num, img["current_name"])
            except ValueError:
                return (99998, seq_num, img["current_name"])

        valid_images.sort(key=sort_key)

        # --- STEP 4: 一時リネーム ---
        temp_list = []
        for idx, img in enumerate(valid_images, start=1):
            num_str = f"{idx:03d}"
            temp_name = f"__temp_{gen}_{num_str}_{img['date_key']}{img['ext']}"
            temp_path = os.path.join(folder_path, temp_name)
            os.rename(img["current_path"], temp_path)
            temp_list.append({
                "num_str": num_str,
                "date_key": img["date_key"],
                "ext": img["ext"],
                "temp_path": temp_path,
                "orig_name": img["current_name"]
            })

        # --- STEP 5: 最終リネーム & JSON構築 (同日複数配信のインデックス割り当て) ---
        new_json_data = []
        renamed_count = 0
        date_usage = {}  # date_key -> 使用カウンター

        for item in temp_list:
            final_name = f"{item['num_str']}_{gen}_{item['date_key']}{item['ext']}"
            final_path = os.path.join(folder_path, final_name)
            os.rename(item["temp_path"], final_path)

            if item["orig_name"] != final_name:
                renamed_count += 1

            d_key = item["date_key"]
            occ_idx = date_usage.get(d_key, 0)
            date_usage[d_key] = occ_idx + 1

            if d_key in existing_json_map and occ_idx < len(existing_json_map[d_key]):
                entry = existing_json_map[d_key][occ_idx]
                entry["filename"] = final_name
            elif d_key in wiki_data and occ_idx < len(wiki_data[d_key]):
                w_info = wiki_data[d_key][occ_idx]
                entry = {
                    "filename": final_name,
                    "title": w_info["title"],
                    "performers": w_info["performers"],
                    "summary": w_info["summary"]
                }
                fix_logs.append(f"[{folder_name}] Wikiから新規データ補填: 日付 {d_key}(#{occ_idx+1}) (タイトル: {w_info['title']})")
            else:
                title_def = "特別配信（megu）" if d_key == "megu" else "タイトル未設定"
                entry = {
                    "filename": final_name,
                    "title": title_def,
                    "performers": [],
                    "summary": ""
                }
                if d_key != "megu":
                    issue_logs.append(f"[{folder_name}] Wikiに情報が無い画像が存在します: {final_name}")

            new_json_data.append(entry)

        if renamed_count > 0:
            fix_logs.append(f"[{folder_name}] {renamed_count} 件の画像ファイル名を日付連番へ整列リネーム")

        with open(json_file, "w", encoding="utf-8") as f:
            json.dump(new_json_data, f, ensure_ascii=False, indent=2)

        fix_logs.append(f"[{folder_name}] {os.path.basename(json_file)} を同期更新（全 {len(new_json_data)} 件）")

        # --- STEP 6: 不足画像チェック ---
        for w_date, w_info_list in wiki_data.items():
            if gen == "105":
                actual_count = date_usage.get(w_date, 0)
                wiki_count = len(w_info_list)
                if wiki_count > actual_count:
                    for idx in range(actual_count, wiki_count):
                        w_info = w_info_list[idx]
                        w_year = w_info.get("year", "")
                        if w_year == "2025" or (w_year == "2026" and int(w_date[:2]) <= 3):
                            issue_logs.append(f"[105期 画像不足] Wikiに配信情報がありますが画像がありません: 日付 {w_date}(#{idx+1}) 『{w_info['title']}』")

    # ==================================================
    # コンソール出力
    # ==================================================
    print("\n==================================================")
    print("  【1. 実施した修正・更新項目】")
    print("==================================================")
    if fix_logs:
        for log in fix_logs:
            print(f"  ・ {log}")
    else:
        print("  ・ 変更・修正事項はありませんでした。")

    print("\n==================================================")
    print("  【2. 要確認・不整合レポート (Wikiと画像/データの食い違い)】")
    print("==================================================")
    if issue_logs:
        for log in issue_logs:
            print(f"  ⚠️ {log}")
    else:
        print("  🎉 不整合や不足画像は見つかりませんでした！完全に一致しています。")
    print("==================================================\n")

if __name__ == "__main__":
    build_and_check_gallery()