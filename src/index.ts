import Chart from "chart.js";

let connected: { value: boolean, device: string } = {
    value: false,
    device: ""
};

const deviceList = document.getElementById("settings-device-list");

const fields: {
    [key: string]: Element
} = {};

const buttons: {
    [key: string]: Element
} = {};

document.querySelectorAll("[data-field]").forEach((element) => {
    // element.setAttribute("style", "border: 1px solid black");
    const key = element.getAttribute("data-field");
    if (key != null) {
        fields[key] = element;
    }
});

document.querySelectorAll("[data-button]").forEach((element) => {
    // element.setAttribute("style", "border: 1px solid black");
    const key = element.getAttribute("data-button");
    if (key != null) {
        buttons[key] = element;
    }
});

const canvas = <HTMLCanvasElement>fields.hr_graph?.children[0];
const ctx = canvas.getContext("2d");

const chart = new Chart(ctx!, {
    type: "line",
    data: {
        datasets: [{
            borderColor: "rgb(237, 66, 106)"
        }]
    },
    options: {
        aspectRatio: 2.75,
        legend: {
            display: false
        }
    }
});

const hrData = new Map<number, number | undefined>();
let hr_continuous = false;

let now: Date;
let difference: number;

function clock() {
    now = new Date();
    const miNow = new Date(now.getTime() - difference);

    fields.time.innerHTML = String(`${miNow.getHours()}:${miNow.getMinutes()}`);
    fields.date.innerHTML = String(`${miNow.getDate()}-${miNow.getMonth() + 1}-${miNow.getFullYear()}`);
}

function sendQuery(query: string[]) {
    window.api.send("mi", {
        type: "query",
        data: {
            query: query
        }
    });
}

function handleResponse(result: {
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
    time?: string,
}) {
    if (result != {}) {
        for (const key in result) {
            switch (key) {
                case "battery": {
                    fields.battery.innerHTML = String(`${result[key]?.level}%`);
                    fields.charging.innerHTML = String((result[key]?.charging ? "Yes" : "No"));
                    break;
                }

                case "hr_current": {
                    now = new Date();

                    chart.data.labels?.push(`${now.getHours()}:${now.getMinutes()}`);
                    chart.data.datasets?.forEach((dataset) => {
                        dataset.data?.push(<number>result.hr_current);
                    });
                    chart.update();

                    hrData.set(now.getTime(), result.hr_current);
                    fields.hr_current.innerHTML = String(result.hr_current);
                    break;
                }

                case "hr_continuous": {
                    if (result.hr_continuous != undefined) {
                        hr_continuous = result.hr_continuous;
                    }
                    break;
                }

                case "hwrev": {
                    fields.hwrev.innerHTML = String(result[key]);
                    break;
                }

                case "serial": {
                    fields.serial.innerHTML = String(result[key]);
                    break;
                }

                case "steps": {
                    fields.calories.innerHTML = String(result[key]?.calories);
                    fields.distance.innerHTML = String(result[key]?.distance);
                    fields.steps.innerHTML = String(result[key]?.steps);
                    break;
                }

                case "swrev": {
                    fields.swrev.innerHTML = String(result[key]);
                    break;
                }

                case "time": {
                    now = new Date();
                    const date = new Date(result[key]!);
                    difference = now.getTime() - date.getTime();
                    setInterval(clock, 1000);
                    break;
                }

                default: {
                    break;
                }

            }
        }
    } else {
        notify("danger", "Data packet received is empty.");
    }

}

window.api.receive("mi", (response: { type: string, data: any }) => {
    if (response?.type) {
        switch (response.type) {
            case "discover": {
                const msg = document.getElementById("settings-no-device");
                msg?.classList.replace("is-danger", "is-info");
                msg!.children[0].innerHTML = "Select a device from the list above.";

                const element = document.createElement("div");
                element.classList.add("field");
                element.innerHTML = `
                <button class="button has-icons-left is-fullwidth">
                    <span class="icon is-left is-small">
                        <i class="mdi mdi-18px mdi-bluetooth"></i>
                    </span>
                    <span>${response.data.name}</span>
                </button>
                `;

                element.querySelector("button")?.addEventListener("click", () => {
                    if (!connected.value) {
                        window.api.send("mi", {
                            type: "connect",
                            data: {
                                uuid: response.data.uuid
                            }
                        });
                    } else {
                        notify("warning", `You are already connected to ${connected.device}`);
                    }
                });

                deviceList?.appendChild(element);
                notify("info", `${response.data.name} has been discovered`);
                break;
            }

            case "connected": {
                notify("success", `Connected to ${response.data.name}`);

                connected = {
                    value: true,
                    device: response.data.name
                };

                sendQuery([
                    "time", "steps", "hwrev", "swrev", "serial", "battery", "hr_current", "hr_continuous"
                ]);

                const spans = document.querySelectorAll("#settings-status > span");
                spans[0].children[0].classList.replace("mdi-bluetooth-off", "mdi-bluetooth-connect");
                spans[1].innerHTML = `Connected to ${response.data.name}`;
                break;
            }

            case "disconnected": {
                notify("danger", `${connected.device} disconnected!`);

                connected = {
                    value: false,
                    device: ""
                };

                const spans = document.querySelectorAll("#settings-status > span");
                spans[0].children[0].classList.replace("mdi-bluetooth-connect", "mdi-bluetooth-off");
                spans[1].innerHTML = "Not connected";
                break;
            }

            case "data": {
                handleResponse(response.data);
                break;
            }

            case "info": {
                notify("info", response.data.message);
                break;
            }

            case "error": {
                notify("danger", response.data.message);
                break;
            }

            default: {
                notify("danger", "Unknown data type!");
                break;
            }
        }
    } else {
        notify("danger", "Data received invalid!");
    }
});

buttons["settings_disconnect"]?.addEventListener("click", () => {
    if (connected.value) {
        window.api.send("mi", {
            type: "disconnect",
            data: {}
        });
    } else {
        notify("warning", "You are already not connected to a device.");
    }
});

buttons["settings_scan"]?.addEventListener("click", () => {
    if (!connected.value) {
        deviceList!.innerHTML = "";

        window.api.send("mi", {
            type: "scan",
            data: {}
        });
    } else {
        notify("warning", `You are already connected to ${connected.device}`);
    }
});

buttons["hr_toggle"]?.addEventListener("click", (event) => {
    if (connected.value) {
        event.preventDefault();
        if (buttons["hr_toggle"] != null) {
            if (hr_continuous) {
                // Turn on
                buttons["hr_toggle"].innerHTML = "Turn on";
                fields.hr_current.innerHTML = "0";
            } else {
                // Turn off
                buttons["hr_toggle"].innerHTML = "Turn off";
            }
        }

        sendQuery([
            "hr_continuous"
        ]);
    } else {
        notify("warning", "You are not connected to a device.");
    }
});

const links = document.querySelectorAll("a[href^=\"http\"]");
links.forEach((link) => {
    link.addEventListener("click", (event) => {
        event.preventDefault();
        const url = link.getAttribute("href");
        if (url != null) {
            window.api.send("link", url);
        }
    });
});

const tabs = document.querySelectorAll("div.tabs > ul > li > a");
tabs.forEach((e) => {
    e.addEventListener("click", (event) => {
        event.preventDefault();

        // Hide all tabs
        document.querySelectorAll("body > section.section").forEach((s) => {
            s?.setAttribute("style", "display: none;");
        });
        tabs.forEach((tab) => {
            tab.parentElement?.classList.remove("is-active");
        });

        // Display new tab
        e.parentElement?.classList.add("is-active");
        const target = e.getAttribute("data-target");
        if (target != null) {
            const targetElement = document.getElementById(target);
            targetElement?.setAttribute("style", "display: block;");
        }
    });
});

function notify(type: string, message: string) {
    const notificationArea = document.getElementById("notification-area");

    const notification = document.createElement("div");
    notification.className = `notification is-${type}`;

    const close = document.createElement("div");
    close.className = "delete";

    notification.appendChild(close);
    notification.innerHTML += message;

    if (notificationArea != null) {
        notificationArea.appendChild(notification);

        const delay = setTimeout(() => {
            notificationArea.removeChild(notification);
        }, 5000);

        notification.addEventListener("click", (e) => {
            if (e.target == notification.querySelector("div.notification > div.delete")) {
                clearTimeout(delay);
                notificationArea.removeChild(notification);
            }
        });
    }
}