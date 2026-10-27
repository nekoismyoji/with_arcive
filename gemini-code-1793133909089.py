import json
import os
import re

# 画像拡張子のリスト
EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".JPG", ".JPEG", ".PNG"]


def sync_json_filenames_by_date(base_dir="."):
    json_files = [
        f for f in os.listdir(base_dir) if re.match(r"^data_\d+\.json$", f)
    ]
    json_files.sort()

    if not json_files:
        print("data_*.json ファイルが見つかりませんでした。")
        return

    print("=== 日付部分(MMDD)による画像ファイル名の全自動同期を開始します ===")

    total_updated = 0

    for json_file in json_files:
        gen_match = re.search(r"\d+", json_file)
        if not gen_match:
            continue
        gen = gen_match.group(0)
        img_folder_name = f"{gen}期サムネ"
        img_folder_path = os.path.join(base_dir, img_folder_name)
        json_path = os.path.join(base_dir, json_file)

        if not os.path.exists(img_folder_path):
            continue

        with open(json_path, "r", encoding="utf-8") as f:
            try:
                data = json.load(f)
            except Exception as e:
                print(f"[エラー] {json_file} の読み込み失敗: {e}")
                continue

        # フォルダ内の実際の画像ファイルを一覧取得
        actual_files = os.listdir(img_folder_path)

        # 実際の画像を { "105_0612": "025_105_0612.jpg" } のような辞書マップにする
        # パターン: [任意数字]_[期]_[日付MMDD].[拡張子]
        actual_map = {}
        for fname in actual_files:
            # 形式: xxx_105_0612.jpg や xxx_105_0612.png など
            m = re.search(r"(\d+)_(\d{4})\.(jpg|jpeg|png|webp)$", fname, re.I)
            if m:
                key = f"{m.group(1)}_{m.group(2)}"  # 例: "105_0612"
                actual_map[key] = fname

        modified = False
        print(f"\n--- {json_file} ({img_folder_name}) の同期処理中 ---")

        for item in data:
            orig_filename = item.get("filename", "")
            if not orig_filename:
                continue

            # 現在のパスが存在すればそのままOK
            if os.path.exists(os.path.join(img_folder_path, orig_filename)):
                continue

            # JSON側のファイル名から 「期_日付」を抽出 (例: 024_105_0612.jpg -> 期: 105, 日付: 0612)
            m = re.search(r"(\d+)_(\d{4})\.", orig_filename)
            if m:
                json_key = f"{m.group(1)}_{m.group(2)}"  # "105_0612"

                # 日付が一致する実際の画像ファイルが存在するかチェック
                if json_key in actual_map:
                    matched_actual_file = actual_map[json_key]
                    item["filename"] = matched_actual_file
                    modified = True
                    total_updated += 1
                    print(
                        f"  [連番ズレ修正] {orig_filename}  -->  {matched_actual_file}"
                    )
                else:
                    print(
                        f"  [未検出] 日付({json_key}) に一致する画像が見つかりません: {orig_filename}"
                    )

        if modified:
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"  --> {json_file} を更新しました。")
        else:
            print(f"  --> 変更はありませんでした。")

    print("\n==========================================")
    print(f" 処理完了: 連番・拡張子を更新した項目数 = {total_updated} 件")
    print("==========================================")


if __name__ == "__main__":
    sync_json_filenames_by_date()