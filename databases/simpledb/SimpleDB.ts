import { world } from "@minecraft/server";

// Defines the possible types that can be stored in the database
type DatabaseValues = string | 
    boolean | 
    number | 
    null | 
    Array<DatabaseValues> | 
    { [key: string]: DatabaseValues };

// Metadata structure to store database configuration
interface DatabaseMetadata {
    chunkSize: number;   // Maximum size per stored chunk
    totalChunks: number; // Number of chunks used to store the database
}

export class SimpleDB {
    // In-memory cache of the database
    private memory: { [key: string]: DatabaseValues } = {};
    
    // Tracks whether the database has been initialized
    private initialized = false;

    /**
     * Constructs a new database instance.
     * @param name - The unique name of the database.
     * @param chunkSize - The maximum size per chunk when storing data.
     */
    constructor(public name: string, public chunkSize: number = 1000) {
        this.initialize();
    }

    /**
     * Initializes the database by loading existing data from storage.
     * Ensures initialization happens only once.
     */
    private initialize() {
        if (this.initialized) return;
        this.loadMemory();
        this.initialized = true;
    }

    /**
     * Loads stored database data from `world` into memory.
     * Reads metadata and reconstructs the stored JSON.
     */
    private loadMemory() {
        // Retrieve metadata, which contains chunk count
        const metadata = world.getDynamicProperty(`db_${this.name}`) as string;
        if (!metadata) {
            this.memory = {}; // No data found, initialize as empty
            return;
        }

        let config: DatabaseMetadata;
        try {
            // Parse the stored metadata JSON
            config = JSON.parse(metadata);
        } catch {
            this.memory = {}; // If corrupted, reset database
            return;
        }

        const chunks: string[] = [];
        for (let i = 0; i < config.totalChunks; i++) {
            const chunk = world.getDynamicProperty(`db_${this.name}_${i}`) as string;
            if (chunk) chunks.push(chunk); // Add valid chunks
        }

        try {
            // Reconstruct the stored JSON from chunks
            const serializedMemory = chunks.join('');
            this.memory = JSON.parse(serializedMemory);
        } catch {
            this.memory = {}; // Reset if corrupted
        }
    }

    /**
     * Saves the current state of the database to `world`.
     * Data is split into chunks to fit within storage limitations.
     */
    private saveMemory() {
        // Serialize the entire database memory
        const serializedMemory = JSON.stringify(this.memory);
        // Split into manageable chunks
        const chunks = this.sectionString(serializedMemory, this.chunkSize);

        // Create metadata for storage
        const config: DatabaseMetadata = {
            chunkSize: this.chunkSize,
            totalChunks: chunks.length
        };

        // Store metadata
        world.setDynamicProperty(`db_${this.name}`, JSON.stringify(config));

        // Remove old chunks (important to avoid stale data)
        world.getDynamicPropertyIds()
            .filter(id => id.startsWith(`db_${this.name}_`))
            .forEach(id => world.setDynamicProperty(id, undefined)); // Undefined removes property

        // Store new chunks
        chunks.forEach((chunk, i) => {
            world.setDynamicProperty(`db_${this.name}_${i}`, chunk);
        });
    }

    /**
     * Retrieves a value from the database by key.
     * @param key - The key to retrieve.
     * @returns The stored value or `undefined` if not found.
     */
    public get(key: string): DatabaseValues | undefined {
        return this.memory[key];
    }

    /**
     * Stores a value in the database.
     * @param key - The key to store the value under.
     * @param value - The value to store.
     */
    public set(key: string, value: DatabaseValues) {
        this.memory[key] = value;
        this.saveMemory();
    }

    /**
     * Deletes a key from the database.
     * @param key - The key to remove.
     */
    public delete(key: string) {
        if (key in this.memory) {
            delete this.memory[key];
            this.saveMemory();
        }
    }

    /**
     * Clears all stored data from the database.
     * Removes both in-memory and persistent storage data.
     */
    public clear() {
        this.memory = {};
        this.saveMemory();
    }

    /**
     * Checks if a key exists in the database.
     * @param key - The key to check.
     * @returns `true` if the key exists, otherwise `false`.
     */
    public has(key: string): boolean {
        return key in this.memory;
    }

    /**
     * Retrieves all stored key-value pairs from the database.
     * @returns A copy of the database memory.
     */
    public getAll(): { [key: string]: DatabaseValues } {
        return { ...this.memory };
    }

    /**
     * Splits a string into smaller sections of a given length.
     * Used to ensure data fits within storage limitations.
     * @param string - The string to split.
     * @param sectionLength - The maximum length per section.
     * @returns An array of string sections.
     */
    private sectionString(string: string, sectionLength: number): string[] {
        return string.match(new RegExp(`.{1,${sectionLength}}`, 'g')) || [];
    }
}
