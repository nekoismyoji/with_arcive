import os
import json
import glob
from PIL import Image

# 1. 各期のサムネイルフォルダ内の画像をWebPに一括変換
folders = ["103期サムネ", "104期サムネ", "105期サムネ"]
total_saved = 0

print("=== 画像のWebP変換処理を開始します ===")

for folder in folders:
    if not os.path.exists(folder):
        continue
    
    # jpg, jpeg ファイルを検索
    files = glob.glob(os.path.join(folder, "*.jpg")) + glob.glob(os.path.join(folder, "*.jpeg"))
    for filepath in files:
        base, _ = os.path.splitext(filepath)
        webp_path = base + ".webp"
        
        # すでに変換済みの場合はスキップ（初回のみ実行）
        if not os.path.exists(webp_path):
            try:
                with Image.open(filepath) as img:
                    # リサイズせず高品質なWebPに変換
                    img.save(webp_path, "WEBP", quality=80)
                    
                orig_size = os.path.getsize(filepath)
                webp_size = os.path.getsize(webp_path)
                total_saved += (orig_size - webp_size)
                print(f"[変換完了] {filepath} ({orig_size//1024}KB -> {webp_size//1024}KB)")
            except Exception as e:
                print(f"[エラー] {filepath}: {e}")

print(f"\n画像軽量化完了！合計 約 {total_saved // (1024*1024)} MB 削減されました。")

# 2. JSONファイル内の拡張子を .webp に一括置換
json_files = ["data_103.json", "data_104.json", "data_105.json"]

print("\n=== JSON内のファイル名を .webp に更新します ===")
for jfile in json_files:
    if os.path.exists(jfile):
        with open(jfile, "r", encoding="utf-8") as f:
            content = f.read()
        
        # .jpg / .jpeg を .webp に書き換え
        new_content = content.replace(".jpg", ".webp").replace(".jpeg", ".webp")
        
        with open(jfile, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"[JSON更新] {jfile}")

print("\nすべての最適化が完了しました！")