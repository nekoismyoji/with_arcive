import os
import glob
from PIL import Image

folders = ["103期サムネ", "104期サムネ", "105期サムネ"]

print("=== 画像のピクセル縮小＆上書き処理を開始します ===")

for folder in folders:
    if not os.path.exists(folder):
        continue
    
    # 高画質な元画像(JPG)を元にして、小さいWebPを作り直す
    files = glob.glob(os.path.join(folder, "*.jpg")) + glob.glob(os.path.join(folder, "*.jpeg"))
    for filepath in files:
        base, _ = os.path.splitext(filepath)
        webp_path = base + ".webp"
        
        try:
            with Image.open(filepath) as img:
                # 縦横比を維持しながら横幅最大400pxに物理的に縮小
                img.thumbnail((400, 400))
                # 既存のWebPを極小サイズで上書き
                img.save(webp_path, "WEBP", quality=80)
                
            print(f"[極小化完了] {webp_path}")
        except Exception as e:
            print(f"[エラー] {filepath}: {e}")

print("\nすべてのサムネイル画像の極小化が完了しました！")