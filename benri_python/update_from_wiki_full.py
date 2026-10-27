import json
import os
import re

JSON_FILE = "data_105.json"
WIKI_TEXT_FILE = "wiki_paste.txt"


def parse_wiki_data(wiki_text):
    """Wikiのテキストから日付をキーにした詳細データを抽出する"""
    entries = {}

    # 「2025/04/03 「タイトル」」のようなブロックで分割
    # 日付ヘッダーを基準にブロック化
    blocks = re.split(
        r"\n(?=\d{4}/\d{2}/\d{2}\s+[\u3000\s]*[「『])", "\n" + wiki_text
    )

    for block in blocks:
        block = block.strip()
        if not block:
            continue

        lines = [line.strip() for line in block.splitlines() if line.strip()]
        if not lines:
            continue

        header = lines[0]
        # 日付とタイトルの抽出
        m = re.search(r"(\d{4})/(\d{2})/(\d{2})\s+[「『](.+?)[」』]", header)
        if not m:
            continue

        year, month, day, title = (
            m.group(1),
            m.group(2),
            m.group(3),
            m.group(4).strip(),
        )
        date_key = f"{month}{day}"  # 例: "0403"

        performers = []
        summary_lines = []
        topics = ""

        is_summary = False

        for line in lines[1:]:
            if line.startswith("参加メンバー"):
                # 次の行または同括りにあるメンバーを取得
                continue
            elif "配信概要" in line:
                is_summary = True
                continue
            elif line in [
                "サムネイル",
                "配信日時",
                "アーカイブ",
                "YouTube",
            ] or line.startswith("with_"):
                is_summary = False
                continue

            # 参加メンバーの解析 (例: 日野下花帆・村野さやか・大沢瑠璃乃)
            if not is_summary and (
                "・" in line or any(k in line for k in ["花帆", "さやか", "瑠璃乃", "吟子", "小鈴", "姫芽", "セラス", "泉"])
            ):
                if not line.startswith("配信日時"):
                    # ゲスト表記などをクリアにしつつ分離
                    raw_p = re.sub(r"\(ゲスト:?\s*", "・", line)
                    raw_p = re.sub(r"\)", "", raw_p)
                    for p in raw_p.split("・"):
                        p_clean = p.strip()
                        if p_clean and p_clean not in performers:
                            performers.append(p_clean)

            # 概要文の収集
            if is_summary:
                if line.startswith("「") and line.endswith("」"):
                    topics = line  # トピック (例: 「ラブライブ！には〜」)
                else:
                    summary_lines.append(line)

        # 概要文テキストの統合
        summary_text = "\n".join(summary_lines).strip()
        if topics:
            if summary_text:
                summary_text += "\n" + topics
            else:
                summary_text = topics

        entries[date_key] = {
            "title": title,
            "performers": performers,
            "summary": summary_text,
        }

    return entries


def main():
    if not os.path.exists(JSON_FILE):
        print(f"[エラー] {JSON_FILE} が見つかりません。")
        return

    if not os.path.exists(WIKI_TEXT_FILE):
        print(f"[エラー] {WIKI_TEXT_FILE} が見つかりません。")
        return

    with open(WIKI_TEXT_FILE, "r", encoding="utf-8") as f:
        wiki_text = f.read()

    wiki_data = parse_wiki_data(wiki_text)
    print(f"=== Wikiテキストから {len(wiki_data)} 件の配信詳細を判別しました ===")

    with open(JSON_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    updated_count = 0

    for item in data:
        fname = item.get("filename", "")
        # ファイル名から MMDD を抽出
        m_date = re.search(r"105_(\d{4})\.", fname)

        if m_date:
            date_key = m_date.group(1)

            if date_key in wiki_data:
                info = wiki_data[date_key]
                item["title"] = info["title"]
                item["performers"] = info["performers"]
                item["summary"] = info["summary"]
                updated_count += 1
                print(
                    f"[反映完了] {fname} (日付: {date_key[0:2]}/{date_key[2:4]}) | タイトル: {info['title']}"
                )

    with open(JSON_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print("\n==========================================")
    print(
        f" 処理完了: 全 {updated_count} 件のタイトル・出演者・概要文をJSONに更新しました！"
    )
    print("==========================================")


if __name__ == "__main__":
    main()