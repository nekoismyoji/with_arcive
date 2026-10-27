import json
import os
import re

IMG_DIR = "105期サムネ"
JSON_FILE = "data_105.json"


def extend_and_sync_105():
    if not os.path.exists(IMG_DIR) or not os.path.exists(JSON_FILE):
        print(f"[エラー] {IMG_DIR} または {JSON_FILE} が見つかりません。")
        return

    # 1. 105期サムネ フォルダ内の全画像を昇順ソートして取得
    images = [
        f
        for f in os.listdir(IMG_DIR)
        if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))
    ]
    images.sort()

    # 2. 既存の data_105.json を読み込み
    with open(JSON_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 既存データの「日付 (例: 0612, 0403)」をキーにした検索用辞書を作成
    data_by_date = {}
    for item in data:
        fname = item.get("filename", "")
        # filenameから日付（例: 024_105_0612.jpg -> 0612）を抽出
        m = re.search(r"105_([a-zA-Z0-9]+)\.", fname)
        if m:
            date_key = m.group(1)
            data_by_date[date_key] = item

    new_data = []

    print(
        f"=== {IMG_DIR} 内の全{len(images)}枚の画像に合わせて {JSON_FILE} を再構築します ==="
    )

    # 3. 実際の画像リスト（129枚）をベースにして JSON を構築
    for img_name in images:
        # 画像ファイル名から日付部分（例: 025_105_0612.jpg -> 0612, 129_105_megu.jpg -> megu）を取得
        m_date = re.search(r"105_([a-zA-Z0-9]+)\.", img_name)
        date_key = m_date.group(1) if m_date else ""

        if date_key in data_by_date:
            # 既存のテキストデータ（タイトルや概要等）を引き継ぎ、filename だけ実際の画像名に更新
            item = data_by_date[date_key]
            item["filename"] = img_name
            new_data.append(item)
            print(f"[同期更新] {img_name} <-- タイトル: {item.get('title')}")
        else:
            # まだJSONに項目がない後半などの画像は、新規項目（雛形）を生成
            default_title = (
                "タイトル未設定"
                if date_key != "megu"
                else "特別配信（megu）"
            )
            new_item = {
                "filename": img_name,
                "title": default_title,
                "performers": [],
                "summary": "",
            }
            new_data.append(new_item)
            print(f"[新規追加] {img_name} (雛形を作成)")

    # 4. JSONに上書き保存
    with open(JSON_FILE, "w", encoding="utf-8") as f:
        json.dump(new_data, f, ensure_ascii=False, indent=2)

    print(
        f"\n完了！ {JSON_FILE} を全 {len(new_data)} 件に更新・同期しました。"
    )


if __name__ == "__main__":
    extend_and_sync_105()