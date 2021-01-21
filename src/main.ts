import { app, BrowserWindow, shell, ipcMain, globalShortcut, dialog } from "electron";
import path from "path";
import MiBand from "miband";
import fs from "fs";

let now: Date;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Bluetooth = require("webbluetooth").Bluetooth;
let bluetoothDevices: { id: string, select: () => void }[] = [];
let device: any;

const hrData = new Map<number, number | undefined>();

const deviceFound = (bluetoothDevice: BluetoothDevice, selectFn: () => void) => {
    const discovered = bluetoothDevices.some((device: { id: string; }) => {
        return (device.id === bluetoothDevice.id);
    });
    if (discovered) return;
    bluetoothDevices.push({ id: bluetoothDevice.id, select: selectFn });

    win.webContents.send("mi", {
        type: "discover",
        data: {
            name: bluetoothDevice.name,
            uuid: bluetoothDevice.id
        }
    });
};

const bluetooth = new Bluetooth({ deviceFound });

let win: BrowserWindow;
app.commandLine.appendSwitch("enable-experimental-web-platform-features");

let miband: MiBand;
let hr_continuous = false;

function handleDisconnect(): void {
    device = undefined;
    bluetoothDevices = [];
    win.webContents.send("mi", {
        type: "disconnected",
        data: {}
    });
}

function exportJson(pretty: boolean): void {
    dialog.showSaveDialog({
        title: "Select path to export to",
        defaultPath: path.join(__dirname, "../export.json"),
        buttonLabel: "Export",
        filters: [
            {
                name: "JSON File",
                extensions: ["json", "txt"]
            },],
        properties: []
    }).then((file: Electron.SaveDialogReturnValue) => {
        if (!file.canceled && file.filePath != undefined) {
            fs.writeFile(file.filePath.toString(),
                (pretty) ? JSON.stringify([...hrData], null, 2) : JSON.stringify([...hrData]), 
                function (err) {
                    if (err) throw err;
                    win.webContents.send("mi", {
                        type: "success",
                        data: {
                            message: "Exported to " + String(file.filePath)
                        }
                    });
                });
        } else {
            win.webContents.send("mi", {
                type: "warning",
                data: {
                    message: "Export canceled"
                }
            });
        }
    }).catch(err => {
        win.webContents.send("mi", {
            type: "error",
            data: {
                message: `Export failed: ${String(err)}`
            }
        });
    });
}

async function handleQuery(query: string[]) {
    return new Promise((resolve, reject) => {
        let result: {
            battery?: {
                level: number,
                charging: boolean,
                off_date: number,
                charge_date: number,
                charge_level: number,
            },
            hr_current?: number,
            hr_continuous?: boolean,
            hwrev?: string,
            serial?: string,
            steps?: {
                calories: number,
                distance: number,
                steps: number
            },
            swrev?: string,
            time?: string
        };

        try {
            result = {};
            query.forEach(async (key, index) => {
                switch (key) {
                    case "battery": {
                        result.battery = await miband.getBatteryInfo();
                        break;
                    }

                    case "hr_current": {
                        result.hr_current = await miband.hrmRead();
                        break;
                    }

                    case "hr_continuous": {
                        if (hr_continuous) {
                            await miband.hrmStop();
                            hr_continuous = false;
                            result.hr_continuous = false;
                        } else {
                            await miband.hrmStart();
                            hr_continuous = true;
                            result.hr_continuous = true;
                        }
                        break;
                    }

                    case "hwrev": {
                        result.hwrev = await miband.getHwRevision();
                        break;
                    }

                    case "serial": {
                        result.serial = await miband.getSerial();
                        break;
                    }

                    case "steps": {
                        result.steps = await miband.getPedometerStats();
                        break;
                    }

                    case "swrev": {
                        result.swrev = await miband.getSwRevision();
                        break;
                    }

                    case "time": {
                        result.time = await miband.getTime();
                        break;
                    }

                    case "export": {
                        exportJson(false);
                        break;
                    }

                    case "exportPretty": {
                        exportJson(true);
                        break;
                    }

                    default: {
                        break;
                    }
                }
                if (index === query.length - 1) {
                    resolve(result);
                }
            });
        } catch (error) {
            reject(error);
        }
    });
}

async function createWindow() {
    win = new BrowserWindow({
        width: 860,
        height: 620,
        // resizable: false,
        icon: path.join(__dirname + "/../res/icon.png"),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, "/preload.js")
        }
    });

    win.removeMenu();
    // win.webContents.openDevTools();

    globalShortcut.register("f5", function () {
        win.reload();
    });
    globalShortcut.register("CommandOrControl+R", function () {
        win.reload();
    });

    const indexHTML = path.join(__dirname + "/../html/index.html");

    win.loadFile(indexHTML).then(async () => {
        ipcMain.on("mi", async (event, args) => {
            switch (args.type) {
                case "scan": {
                    try {
                        win.webContents.send("mi", {
                            type: "info",
                            data: {
                                message: "Starting BLE scan..."
                            }
                        });

                        device = await bluetooth.requestDevice({
                            filters: [
                                { services: [MiBand.advertisementService] }
                            ],
                            optionalServices: MiBand.optionalServices,
                        });

                        device.addEventListener("gattserverdisconnected", handleDisconnect);

                        win.webContents.send("mi", {
                            type: "info",
                            data: {
                                message: `Attempting connection with ${device.name}...`
                            }
                        });

                        const server = await device.gatt.connect();

                        miband = new MiBand(server);
                        await miband.init();

                        win.webContents.send("mi", {
                            type: "connected",
                            data: {
                                name: device.name
                            }
                        });

                        app.on("window-all-closed", () => {
                            if (device != undefined) {
                                device.gatt.disconnect();
                            }
                            app.quit();
                        });

                        miband.on("heart_rate", (rate: number) => {
                            now = new Date();
                            hrData.set(now.getTime(), rate);
                            win.webContents.send("mi", {
                                type: "data",
                                data: {
                                    hr_current: rate
                                }
                            });
                        });
                    } catch (error) {
                        win.webContents.send("mi", {
                            type: "error",
                            data: {
                                message: "No devices found! Make sure your Mi Band can be found and restart this app."
                            }
                        });
                    }
                    break;
                }

                case "connect": {
                    bluetoothDevices.forEach(async (p: { id: string, select: () => void }) => {
                        if (p.id == args.data.uuid) {
                            p.select();
                        }
                    });
                    break;
                }

                case "disconnect": {
                    device.gatt.disconnect();
                    device = undefined;
                    break;
                }

                case "query": {
                    handleQuery(args.data.query).then((result) => {
                        win.webContents.send("mi", {
                            type: "data",
                            data: result
                        });
                    }).catch((error) => {
                        win.webContents.send("mi", {
                            type: "error",
                            data: {
                                message: error
                            }
                        });
                    });
                    break;
                }

                default: {
                    win.webContents.send("mi", {
                        type: "error",
                        data: {
                            message: "Invalid request"
                        }
                    });
                    break;
                }
            }
        });

        ipcMain.on("link", (event, args) => {
            shell.openExternal(args);
        });
    });
}

app.on("ready", createWindow);

app.on("window-all-closed", () => {
    app.quit();
});