import os
import json
import re

# パス設定（benri_python 内から実行されても、with_arcive 直下から実行されても対応）
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.abspath(os.path.join(CURRENT_DIR, '..')) if os.path.basename(CURRENT_DIR) == 'benri_python' else CURRENT_DIR

GENS = ['103', '104', '105']

def get_fiscal_sort_key(item):
    """
    4/1〜翌3/31（年度順）で並べ替えるためのソートキー
    グループ 0:  4月〜12月 (当年)
    グループ 1:  1月〜 3月 (翌年)
    グループ 2: megu などの特殊配信
    """
    filename = item['filename']
    base = os.path.splitext(os.path.basename(filename))[0]
    parts = base.split('_')
    raw_date = parts[2] if len(parts) >= 3 else parts[-1]
    
    if re.match(r'^\d{4}$', raw_date):
        month = int(raw_date[:2])
        day = int(raw_date[2:])
        group = 0 if month >= 4 else 1
        return (group, month, day, filename)
    else:
        return (2, 99, 99, filename)

def process_gen(gen):
    folder_name = f"{gen}期サムネ"
    folder_path = os.path.join(BASE_DIR, folder_name)
    json_path = os.path.join(BASE_DIR, f"data_{gen}.json")
    
    if not os.path.exists(folder_path) or not os.path.exists(json_path):
        print(f"⚠️ {folder_name} または data_{gen}.json が存在しません。スキップします。")
        return

    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    # 年度順（4/1 〜 翌3/31）にソート
    data_sorted = sorted(data, key=get_fiscal_sort_key)
    
    # 名前の衝突を防ぐ2フェーズリネーム処理
    temp_rename_map = {}
    final_rename_map = {}
    new_data = []
    
    for idx, item in enumerate(data_sorted, start=1):
        old_filename = item['filename']
        ext = os.path.splitext(old_filename)[1]
        base = os.path.splitext(old_filename)[0]
        parts = base.split('_')
        rest = "_".join(parts[2:]) if len(parts) >= 3 else parts[-1]
        
        new_filename = f"{idx:03d}_{gen}_{rest}{ext}"
        temp_filename = f"__temp_{idx:03d}_{gen}_{rest}{ext}"
        
        old_file_path = os.path.join(folder_path, old_filename)
        temp_file_path = os.path.join(folder_path, temp_filename)
        final_file_path = os.path.join(folder_path, new_filename)
        
        if os.path.exists(old_file_path):
            temp_rename_map[old_file_path] = temp_file_path
            final_rename_map[temp_file_path] = final_file_path
            
        item_copy = dict(item)
        item_copy['filename'] = new_filename
        new_data.append(item_copy)

    # フェーズ1: 一時ファイル名へ退避（リネーム時の同名上書き衝突防止）
    for old_p, temp_p in temp_rename_map.items():
        if os.path.exists(old_p):
            os.rename(old_p, temp_p)

    # フェーズ2: 最終的な 001_ 〜 の年度順連番へ確定
    renamed_count = 0
    for temp_p, final_p in final_rename_map.items():
        if os.path.exists(temp_p):
            os.rename(temp_p, final_p)
            renamed_count += 1

    # JSON データの同期保存
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(new_data, f, ensure_ascii=False, indent=2)

    print(f"・ [{folder_name}] {renamed_count} 件の画像を年度順 (4/1〜翌3/31) に一括整形リネームしました。")
    print(f"・ [{folder_name}] data_{gen}.json を同期更新しました（全 {len(new_data)} 件）。")

def main():
    print("=" * 50)
    print("  【実施した修正・更新項目 (年度順ソート: 4/1〜翌3/31)】")
    print("=" * 50)
    for gen in GENS:
        process_gen(gen)
    print("=" * 50)
    print("  処理が完了しました！")
    print("=" * 50)

if __name__ == '__main__':
    main()