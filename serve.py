#!/usr/bin/env python3
"""Локальный сервер для просмотра логов двигателя.

Запуск:  python3 serve.py [--no-browser] [--port 8765]

Скрипт раздаёт файлы из своего каталога и предоставляет два простых API:
  /api/files          — список доступных CSV-файлов
  /api/data?name=...  — содержимое выбранного CSV-файла
"""

import argparse
import json
import os
import posixpath
import threading
import urllib.parse
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

BASE_DIR = os.path.realpath(os.path.dirname(os.path.abspath(__file__)))


class LogHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/files":
            self._send_json(self._list_files())
            return
        if parsed.path == "/api/data":
            self._send_data(parsed.query)
            return
        super().do_GET()

    def _list_files(self):
        files = []
        try:
            for name in os.listdir(BASE_DIR):
                full = os.path.join(BASE_DIR, name)
                if not os.path.isfile(full):
                    continue
                if not name.lower().endswith((".csv", ".txt")):
                    continue
                stat = os.stat(full)
                files.append({
                    "name": name,
                    "size": stat.st_size,
                    "mtime": stat.st_mtime,
                })
        except OSError:
            pass
        files.sort(key=lambda item: item["mtime"], reverse=True)
        return files

    def _send_data(self, query):
        params = urllib.parse.parse_qs(query)
        name = (params.get("name") or [""])[0]
        safe_name = posixpath.basename(name.replace("\\", "/"))
        if not safe_name or not safe_name.lower().endswith((".csv", ".txt")):
            self._send_error_text(400, "Недопустимое имя файла")
            return
        path = os.path.realpath(os.path.join(BASE_DIR, safe_name))
        if os.path.commonpath([path, BASE_DIR]) != BASE_DIR or not os.path.isfile(path):
            self._send_error_text(404, "Файл не найден")
            return
        try:
            with open(path, "rb") as handle:
                data = handle.read()
        except OSError as error:
            self._send_error_text(500, "Ошибка чтения файла: %s" % error)
            return
        self.send_response(200)
        self.send_header("Content-Type", "text/csv; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def _send_json(self, payload):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def _send_error_text(self, status, message):
        data = message.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def end_headers(self):
        if not self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


def find_server(start_port, attempts=25):
    for port in range(start_port, start_port + attempts):
        try:
            server = ThreadingHTTPServer(("127.0.0.1", port), LogHandler)
            return server
        except OSError:
            continue
    raise SystemExit("Не удалось найти свободный порт.")


def main():
    parser = argparse.ArgumentParser(description="Просмотр логов двигателя")
    parser.add_argument("--port", type=int, default=8765, help="начальный порт (по умолчанию 8765)")
    parser.add_argument("--no-browser", action="store_true", help="не открывать браузер автоматически")
    args = parser.parse_args()

    server = find_server(args.port)
    port = server.server_address[1]
    url = "http://127.0.0.1:%d/" % port

    print("Анализ логов двигателя")
    print("Адрес: %s" % url)
    print("Для остановки нажмите Ctrl+C")

    if not args.no_browser:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nОстановлено.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
