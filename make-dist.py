#!/usr/bin/env python3
import argparse
import zipfile
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent

FILES = [
    "index.html",
    "favicon.svg",
    "serve.py",
    "start.sh",
    "start.command",
    "start.bat",
    "install.sh",
    "install.bat",
    "make-dist.py",
    "README.md",
]

DIRS = [
    "css",
    "js",
    "vendor",
]


def add_file(archive, path, arcname=None):
    arcname = arcname or path.relative_to(ROOT).as_posix()
    mode = path.stat().st_mode & 0o777
    info = zipfile.ZipInfo.from_file(str(path), arcname)
    info.external_attr = (mode & 0xFFFF) << 16
    info.compress_type = zipfile.ZIP_DEFLATED
    with path.open("rb") as source, archive.open(info, "w") as target:
        while True:
            chunk = source.read(1024 * 1024)
            if not chunk:
                break
            target.write(chunk)


def main():
    parser = argparse.ArgumentParser(description="Собрать переносимый архив приложения")
    parser.add_argument("--with-samples", action="store_true", help="включить CSV-логи из корня проекта")
    parser.add_argument("--output", help="путь к итоговому ZIP-архиву")
    args = parser.parse_args()

    output = Path(args.output) if args.output else (
        ROOT / "dist" / ("engine-log-analyzer-%s.zip" % datetime.now().strftime("%Y%m%d-%H%M"))
    )
    if not output.is_absolute():
        output = ROOT / output
    output.parent.mkdir(parents=True, exist_ok=True)

    missing = [name for name in FILES if not (ROOT / name).is_file()]
    if missing:
        raise SystemExit("Не найдены файлы: " + ", ".join(missing))

    added = []
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for name in FILES:
            path = ROOT / name
            add_file(archive, path)
            added.append(path.relative_to(ROOT).as_posix())

        for dirname in DIRS:
            directory = ROOT / dirname
            if not directory.is_dir():
                continue
            for path in sorted(directory.rglob("*")):
                if not path.is_file() or "__pycache__" in path.parts:
                    continue
                add_file(archive, path)
                added.append(path.relative_to(ROOT).as_posix())

        if args.with_samples:
            for path in sorted(ROOT.glob("*.csv")):
                add_file(archive, path)
                added.append(path.relative_to(ROOT).as_posix())

    print("Архив: %s" % output)
    print("Файлов: %d" % len(added))
    print("Размер: %.1f МБ" % (output.stat().st_size / (1024 * 1024)))


if __name__ == "__main__":
    main()
