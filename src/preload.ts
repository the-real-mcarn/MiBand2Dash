import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld(
    "api", {
        send: (channel: string, data: unknown) => {
            const validChannels = ["link", "mi"];
            if (validChannels.includes(channel)) {
                ipcRenderer.send(channel, data);
            }
        },
        receive: (channel: string, func: CallableFunction) => {
            const validChannels = ["mi"];
            if (validChannels.includes(channel)) {
                ipcRenderer.on(channel, (event, ...args) => func(...args));
            }
        }
    }
);