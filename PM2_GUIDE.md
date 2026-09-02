# Madigun Inventory — PM2 Offline Background Guide 🚀

This system is fully optimized to run offline in the background as a self-hosted desktop or network utility without needing VS Code, terminals, or PowerShell to remain open.

Follow these simple steps to set up and manage the application in the background using **PM2 (Process Manager 2)**.

---

## 1. One-Time Setup & Prerequisites

Ensure you have [Node.js](https://nodejs.org) installed on your computer.

### Step A: Install PM2 Globally
Open your PowerShell or Command Prompt (on Windows) or Terminal (on macOS/Linux) and run the following command to install PM2:
```bash
npm install -g pm2
```

### Step B: Build the Application
For maximum speed, efficiency, and flawless offline performance, compile the source files into a production build:
```bash
npm run build
```
*(This creates a high-performance, compressed static `dist/` bundle inside the directory).*

---

## 2. Start the Background Server

To launch the system in the background under PM2 management, simply run:
```bash
pm2 start ecosystem.config.cjs
```

🎉 **That's it!** The application is now running securely in the background on **http://localhost:3001**.
You can safely close your PowerShell, Terminal, and VS Code. The app will continue running silently in the background.

> 💡 **Custom Port:** If you want to use a different port (e.g., `3000`, `5000`, or `8080`), simply edit the `PORT` number inside the `ecosystem.config.cjs` file before starting the process!

---

## 3. Managing the Background Process

Use these simple commands in your terminal anytime to manage the system:

*   **Check Status:** See if the app is active and monitor its CPU/Memory usage:
    ```bash
    pm2 status
    ```
*   **View Real-Time Logs:** See access, startup, and background syncing logs:
    ```bash
    pm2 logs madigun-inventory
    ```
*   **Stop the Server:** Turn off the background server completely:
    ```bash
    pm2 stop madigun-inventory
    ```
*   **Restart the Server:** Apply code updates or reboot the background process:
    ```bash
    pm2 restart madigun-inventory
    ```
*   **Completely Remove from PM2:** Remove the server process from PM2 management:
    ```bash
    pm2 delete madigun-inventory
    ```

---

## 4. Launch on Computer Boot (Optional but Recommended)

If you want the inventory system to **automatically start** whenever you turn on or reboot your computer:

1.  Generate and configure startup scripts:
    ```bash
    pm2 startup
    ```
    *(Follow any on-screen commands displayed after running this).*
2.  Save the current active list of processes (so PM2 remembers to restart them):
    ```bash
    pm2 save
    ```
