import { Low } from 'lowdb';
import { log, getAppInstance } from 'main';
import { Notice } from 'obsidian';
import { CardSchedule, scheduleData } from 'schedule';
import { GlobalSettings, defaultDbPath, resolveDbPath } from 'setting';
import { ActivityCounts, activityDate } from 'learningActivity';

// 存储文档的数据结构
export interface CardDoc {
    ID: string;
    CardSchedules: scheduleData[];
}

const pathSep = '/';

class ObsidianAdapter {
    private basePath: string;
    private fileName: string;

    constructor(basePath: string, fileName: string) {
        this.basePath = basePath;
        this.fileName = fileName;
    }

    async read(): Promise<Data> {
        try {
            const filePath = this.basePath + this.fileName;
            log(() => `Reading from file: ${filePath}`);
            if (await getAppInstance().vault.adapter.exists(filePath)) {
                const data = await getAppInstance().vault.adapter.read(filePath);
                return JSON.parse(data) as Data;
            }
            return { docs: [], activity: {} };
        } catch (error) {
            new Notice(`[Obsidanki] read error: ${error}`);
            throw error;
        }
    }


    async write(data: Data) {
        const filePath = this.basePath + this.fileName;
        const content = JSON.stringify(data, null, 1);
        if (!await getAppInstance().vault.adapter.exists(this.basePath)) {
            const noTrailingSeparatorPath = this.basePath.endsWith(pathSep)
                ? this.basePath.substring(0, this.basePath.length - 1)
                : this.basePath;
            await getAppInstance().vault.adapter.mkdir(
                noTrailingSeparatorPath
            );
        }
        await getAppInstance().vault.adapter.write(filePath, content);
    }
}

type Data = {
    docs: CardDoc[];
    activity?: Record<string, number>;
}

export class DatabaseHelper {
    private static instance: DatabaseHelper;
    private db: Low<Data>;
    public readonly ready: Promise<void>;
    private writes: Promise<void> = Promise.resolve();
    private activity: ActivityCounts = {};
    private listeners = new Set<() => void>();

    public static getInstance(): DatabaseHelper {
        if (!DatabaseHelper.instance) {
            try {
                DatabaseHelper.instance = new DatabaseHelper(resolveDbPath(GlobalSettings.ObsidankiDbPath));
            } catch (error) {
                console.error(error);
                DatabaseHelper.instance = new DatabaseHelper(defaultDbPath());
                new Notice(`[Obsidanki] Database initialization error by path: ${GlobalSettings.ObsidankiDbPath} using deafult one.`);
            }
            
        }
        return DatabaseHelper.instance;
    }

    constructor(dbPath: string) {
        const slashIndex = dbPath.lastIndexOf("/");
        const dir = slashIndex !== -1 ? dbPath.slice(0, slashIndex) : "";
        const filename = slashIndex !== -1 ? dbPath.slice(slashIndex + 1) : dbPath;
        
        const adapter = new ObsidianAdapter(
            dir.length > 0 ? dir + '/' : '',
            filename
        );
        this.db = new Low<Data>(adapter, { docs: [] });
        this.ready = this.init();
    }

    private async init() {
        await this.db.read();
        this.db.data.docs ??= [];
        this.activity = { ...this.db.data.activity };
    }

    public getActivity = (): ActivityCounts => this.activity;

    public subscribeActivity = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    }

    // Serialize writes so completed grades never lose daily counts.
    public saveReview(cardID: string, cardSchedule: CardSchedule): Promise<void> {
        const day = activityDate(new Date());
        const schedules = cardSchedule.cardScheduleToPatternData().map(schedule => ({ ...schedule }));
        const write = this.writes.then(async () => {
            await this.ready;
            const previous = this.db.data;
            const docs = previous.docs.slice();
            const index = docs.findIndex(doc => doc.ID === cardID);
            const doc = { ID: cardID, CardSchedules: schedules };
            if (index < 0) docs.push(doc);
            else docs[index] = doc;
            const activity = { ...this.activity, [day]: (this.activity[day] ?? 0) + 1 };
            this.db.data = { ...previous, docs, activity };
            try {
                await this.db.write();
            } catch (error) {
                this.db.data = previous;
                throw error;
            }
            this.activity = activity;
            for (const listener of this.listeners) listener();
        });
        this.writes = write.catch(() => {});
        return write;
    }

    public query(cardID: string): CardDoc | null {
        if (!this.db.data.docs) {
            return null;
        }
        return this.db.data.docs.find((pattern) => pattern.ID === cardID) || null;
    }

}
