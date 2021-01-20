declare module "node-web-bluetooth";

interface Window {
    api: any;
}

declare module "miband" {
    declare class MiBand extends events.EventEmitter {
        constructor(peripheral: BluetoothRemoteGATTServer);
        static advertisementService(): number;
        static optionalServices(): number[];
        async init(): void;
        waitButton(timeout?: number): Promise<boolean, string>;
        async showNotification(type?: string): void | Error;
        async hrmRead(): promise<number, string>;
        async hrmStart(): void;
        async hrmStop(): boolean;
        async getPedometerStats(): {
            calories: number,
            distance: number,
            steps: number
        };
        async getBatteryInfo(): {
            level: number,
            charging: boolean,
            off_date: number,
            charge_date: number,
            charge_level: number,
        };
        async getTime(): Promise<string>;
        async getSerial(): string;
        async getHwRevision(): string;
        async getSwRevision(): string;
        async setUserInfo(user: {
            born: Date,
            sex: string,
            height: number,
            weight: number,
            id: string
        }): void;
        on(event: "heart_rate", listener: (rate: number) => void): this;
    }
    export = MiBand;
}