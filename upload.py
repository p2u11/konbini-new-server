import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from tkinter.scrolledtext import ScrolledText
import requests
import os

class AppStoreUploader(tk.Tk):
    def __init__(self):
        super().__init__()

        self.title("App Store Developer Uploader")
        self.geometry("650x650")
        self.minsize(550, 550)

        # Global State Variables
        self.api_url = tk.StringVar(value="http://127.0.0.1:5000")
        self.token = tk.StringVar(value="1:QvzozYKBJMEy_-wPGAJ4abW8CQVfyvcxYtpLf6QB2wg") # Pre-filled from your example
        
        self.setup_ui()

    def setup_ui(self):
        # --- Top Config Frame (API URL & Token) ---
        config_frame = ttk.LabelFrame(self, text=" Configuration & Auth Token ")
        config_frame.pack(fill="x", padx=10, pady=5)

        ttk.Label(config_frame, text="API Base URL:").grid(row=0, column=0, padx=5, pady=5, sticky="w")
        ttk.Entry(config_frame, textvariable=self.api_url, width=30).grid(row=0, column=1, padx=5, pady=5, sticky="ew")

        ttk.Label(config_frame, text="Auth Token:").grid(row=1, column=0, padx=5, pady=5, sticky="w")
        ttk.Entry(config_frame, textvariable=self.token, width=50).grid(row=1, column=1, padx=5, pady=5, sticky="ew")
        
        config_frame.columnconfigure(1, weight=1)

        # --- Main Notebook (Tabs) ---
        self.notebook = ttk.Notebook(self)
        self.notebook.pack(fill="both", expand=True, padx=10, pady=5)

        self.tab_login = ttk.Frame(self.notebook)
        self.tab_upload_app = ttk.Frame(self.notebook)
        self.tab_upload_assets = ttk.Frame(self.notebook)

        self.notebook.add(self.tab_login, text="1. Login")
        self.notebook.add(self.tab_upload_app, text="2. Upload App")
        self.notebook.add(self.tab_upload_assets, text="3. Upload Assets")

        self.build_login_tab()
        self.build_upload_app_tab()
        self.build_upload_assets_tab()

        # --- Bottom Console / Logs Frame ---
        log_frame = ttk.LabelFrame(self, text=" Server Responses / Logs ")
        log_frame.pack(fill="both", expand=True, padx=10, pady=5)

        self.log_text = ScrolledText(log_frame, height=8, bg="#1e1e1e", fg="#ffffff", insertbackground="white")
        self.log_text.pack(fill="both", expand=True, padx=5, pady=5)

    def log(self, message):
        self.log_text.insert(tk.END, f"{message}\n")
        self.log_text.see(tk.END)

    # ==========================================
    # TAB 1: LOGIN
    # ==========================================
    def build_login_tab(self):
        frame = self.tab_login
        
        self.username_var = tk.StringVar(value="paul123")
        self.password_var = tk.StringVar()

        ttk.Label(frame, text="Username:").grid(row=0, column=0, padx=10, pady=10, sticky="e")
        ttk.Entry(frame, textvariable=self.username_var, width=30).grid(row=0, column=1, padx=10, pady=10, sticky="w")

        ttk.Label(frame, text="Password:").grid(row=1, column=0, padx=10, pady=10, sticky="e")
        ttk.Entry(frame, textvariable=self.password_var, show="*", width=30).grid(row=1, column=1, padx=10, pady=10, sticky="w")

        ttk.Button(frame, text="Login & Fetch Token", command=self.handle_login).grid(row=2, column=1, padx=10, pady=20, sticky="w")

    def handle_login(self):
        url = f"{self.api_url.get().strip('/')}/api/auth/login"
        payload = {"name": self.username_var.get(), "password": self.password_var.get()}
        
        self.log(f"POST -> {url}")
        try:
            res = requests.post(url, json=payload, timeout=10)
            self.log(f"Status: {res.status_code}\nResponse: {res.text}\n")
            
            if res.status_code == 200:
                # If your API returns json like {"token": "..."}
                data = res.json()
                if "token" in data:
                    self.token.set(data["token"])
                    messagebox.showinfo("Success", "Logged in and token updated successfully!")
        except Exception as e:
            self.log(f"Error: {str(e)}\n")
            messagebox.showerror("Connection Error", str(e))

    # ==========================================
    # TAB 2: UPLOAD APP (APK)
    # ==========================================
    def build_upload_app_tab(self):
        frame = self.tab_upload_app

        self.app_name_var = tk.StringVar(value="Little File Explorer")
        self.app_author_var = tk.StringVar(value="MGGames")
        self.apk_path_var = tk.StringVar()

        ttk.Label(frame, text="App Name:").grid(row=0, column=0, padx=10, pady=10, sticky="e")
        ttk.Entry(frame, textvariable=self.app_name_var, width=40).grid(row=0, column=1, columnspan=2, padx=10, pady=10, sticky="w")

        ttk.Label(frame, text="Author:").grid(row=1, column=0, padx=10, pady=10, sticky="e")
        ttk.Entry(frame, textvariable=self.app_author_var, width=40).grid(row=1, column=1, columnspan=2, padx=10, pady=10, sticky="w")

        ttk.Label(frame, text="APK File:").grid(row=2, column=0, padx=10, pady=10, sticky="e")
        ttk.Entry(frame, textvariable=self.apk_path_var, width=40).grid(row=2, column=1, padx=10, pady=10, sticky="w")
        ttk.Button(frame, text="Browse...", command=lambda: self.browse_file(self.apk_path_var, [("APK Files", "*.apk")])).grid(row=2, column=2, padx=5, pady=10)

        ttk.Button(frame, text="Upload Package", command=self.handle_upload_app).grid(row=3, column=1, pady=20, sticky="w")

    def handle_upload_app(self):
        url = f"{self.api_url.get().strip('/')}/api/apps/upload"
        filepath = self.apk_path_var.get()

        if not filepath or not os.path.exists(filepath):
            messagebox.showwarning("Missing File", "Please select a valid APK file first.")
            return

        data = {
            "token": self.token.get(),
            "name": self.app_name_var.get(),
            "author": self.app_author_var.get()
        }
        
        self.log(f"POST -> {url} (Uploading App Package...)")
        try:
            with open(filepath, 'rb') as f:
                files = {'file': f}
                res = requests.post(url, data=data, files=files, timeout=60)
                self.log(f"Status: {res.status_code}\nResponse: {res.text}\n")
        except Exception as e:
            self.log(f"Error: {str(e)}\n")

    # ==========================================
    # TAB 3: UPLOAD ASSETS (ICON / SCREENSHOT)
    # ==========================================
    def build_upload_assets_tab(self):
        frame = self.tab_upload_assets

        self.app_id_var = tk.StringVar(value="2") # Pre-filled from your example
        self.screenshot_path_var = tk.StringVar()
        self.icon_path_var = tk.StringVar()

        # App ID row
        ttk.Label(frame, text="Target App ID:").grid(row=0, column=0, padx=10, pady=10, sticky="e")
        ttk.Entry(frame, textvariable=self.app_id_var, width=10).grid(row=0, column=1, padx=10, pady=10, sticky="w")

        # Separator line
        ttk.Separator(frame, orient="horizontal").grid(row=1, column=0, columnspan=3, sticky="ew", pady=10)

        # Icon Row
        ttk.Label(frame, text="App Icon (PNG):").grid(row=2, column=0, padx=10, pady=10, sticky="e")
        ttk.Entry(frame, textvariable=self.icon_path_var, width=40).grid(row=2, column=1, padx=10, pady=10, sticky="w")
        ttk.Button(frame, text="Browse...", command=lambda: self.browse_file(self.icon_path_var, [("PNG Images", "*.png")])).grid(row=2, column=2, padx=5, pady=10)
        ttk.Button(frame, text="Upload Icon", command=lambda: self.handle_upload_asset("icon")).grid(row=3, column=1, pady=5, sticky="w")

        # Separator line
        ttk.Separator(frame, orient="horizontal").grid(row=4, column=0, columnspan=3, sticky="ew", pady=10)

        # Screenshot Row
        ttk.Label(frame, text="Screenshot (PNG):").grid(row=5, column=0, padx=10, pady=10, sticky="e")
        ttk.Entry(frame, textvariable=self.screenshot_path_var, width=40).grid(row=5, column=1, padx=10, pady=10, sticky="w")
        ttk.Button(frame, text="Browse...", command=lambda: self.browse_file(self.screenshot_path_var, [("PNG Images", "*.png")])).grid(row=5, column=2, padx=5, pady=10)
        ttk.Button(frame, text="Upload Screenshot", command=lambda: self.handle_upload_asset("screenshot")).grid(row=6, column=1, pady=5, sticky="w")

    def handle_upload_asset(self, asset_type):
        app_id = self.app_id_var.get().strip()
        if not app_id:
            messagebox.showwarning("Missing ID", "Please specify an App ID.")
            return

        filepath = self.icon_path_var.get() if asset_type == "icon" else self.screenshot_path_var.get()
        if not filepath or not os.path.exists(filepath):
            messagebox.showwarning("Missing File", f"Please select a valid PNG file for the {asset_type}.")
            return

        endpoint = f"upload-icon" if asset_type == "icon" else "upload-screenshot"
        url = f"{self.api_url.get().strip('/')}/api/apps/{app_id}/{endpoint}"
        
        data = {"token": self.token.get()}
        
        self.log(f"POST -> {url} (Uploading {asset_type}...)")
        try:
            with open(filepath, 'rb') as f:
                # Passing a 3-tuple enforces the 'image/png' Content-Type matching your curl syntax
                files = {'file': (os.path.basename(filepath), f, 'image/png')}
                res = requests.post(url, data=data, files=files, timeout=30)
                self.log(f"Status: {res.status_code}\nResponse: {res.text}\n")
        except Exception as e:
            self.log(f"Error: {str(e)}\n")

    # Helper method for file pickers
    def browse_file(self, target_var, filetypes):
        filename = filedialog.askopenfilename(filetypes=filetypes)
        if filename:
            target_var.set(filename)

if __name__ == "__main__":
    app = AppStoreUploader()
    app.mainloop()
